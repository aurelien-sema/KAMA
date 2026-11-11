"""Logique metier : traduction prudente, intention vocale, synthese par segments."""
from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import re
import unicodedata
import wave
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

from .clips import piece_key, split_pieces
from .engines import EngineSet, TranslationRoute, load_engines
from .errors import KamaError, busy, unmasked, unsupported_language
from .memory import TranslationMemory
from .schemas import AudioSegment, IntentResponse, SlotSegment, TranslateRequest, TranslateResponse, TtsResponse
from .security.guards import canonical, is_critical, output_problem, similarity
from .security.masking import SLOT_RE, has_hard_pii, is_masked
from .settings import Settings
from .simplify import Simplifier

log = logging.getLogger("kama.services")

SAMPLE_RATE = 16_000
MAX_AUDIO_SECONDS = 30
MIN_AUDIO_SECONDS = 0.2
FUZZY_MIN = 0.85  # ressemblance minimale pour accepter une phrase approchante
FUZZY_GAP = 0.05  # ecart minimal avec la deuxieme intention


def untranslated(reason: str) -> TranslateResponse:
    return TranslateResponse(text=None, badge="untranslated", origin="none", reason=reason)


_WORD = re.compile(r"[a-zà-ÿ']+")


def unknown_ratio(text: str, lexicon: frozenset[str]) -> float:
    words = _WORD.findall(SLOT_RE.sub(" ", text).lower())
    return sum(w not in lexicon for w in words) / len(words) if words else 1.0


class TranslationService:
    """Ordre impose : memoire validee, memoire proche, modele sous controle, sinon rien."""

    def __init__(self, memory: TranslationMemory, engines: EngineSet, settings: Settings, gate: asyncio.Semaphore) -> None:
        self.memory, self.engines, self.settings, self.gate = memory, engines, settings, gate

    async def translate(self, req: TranslateRequest) -> TranslateResponse:
        if req.target_lang not in self.engines.languages:
            raise unsupported_language()
        if not is_masked(req.text):
            raise unmasked()
        exact = self.memory.find_exact(req.text, req.source_lang, req.target_lang)
        if exact is not None:
            return TranslateResponse(text=exact, badge="verified", origin="memory")
        near = self.memory.find_near(req.text, req.source_lang, req.target_lang)
        if near is not None:
            return TranslateResponse(text=near, badge="machine", origin="near_memory")
        if is_critical(req.text, req.element) and not self.settings.mt_allow_critical:
            return untranslated("critical_content")
        route = self.engines.translation.get(f"{req.source_lang}>{req.target_lang}")
        if route is None:
            return untranslated("engine_unavailable")
        if self.gate.locked():
            return untranslated("busy")
        async with self.gate:
            try:
                return await asyncio.to_thread(self._run_model, req, route)
            except Exception as exc:
                log.warning("moteur en echec (%s)", type(exc).__name__)
                return untranslated("engine_error")

    def _run_model(self, req: TranslateRequest, route: TranslationRoute) -> TranslateResponse:
        output = route.translator.translate(req.text)
        if output_problem(req.text, output):
            return untranslated("guard_failed")
        if route.lexicon is not None and unknown_ratio(output, route.lexicon) > route.max_unknown_ratio:
            return untranslated("guard_failed")  # trop de mots absents des corpus : probablement invente
        if route.backtranslate:
            back = self.engines.translation.get(route.backtranslate)
            if back is None:
                return untranslated("guard_failed")
            if similarity(req.text, back.translator.translate(output)) < route.min_backtranslation:
                return untranslated("guard_failed")
        return TranslateResponse(text=output, badge="machine", origin="model")


class IntentMatcher:
    """Grammaire fermee : l'expression connue la plus longue trouvee dans la phrase l'emporte."""

    def __init__(self, phrases: dict[str, dict[str, list[str]]]) -> None:
        self.index: dict[str, list[tuple[str, str]]] = {}
        for intent, by_lang in phrases.items():
            for lang, items in by_lang.items():
                for phrase in items:
                    self.index.setdefault(lang, []).append((self._norm(phrase), intent))
        for items in self.index.values():
            items.sort(key=lambda x: len(x[0]), reverse=True)

    @classmethod
    def from_file(cls, path: Path) -> "IntentMatcher":
        return cls(json.loads(path.read_text(encoding="utf-8"))["intents"])

    @staticmethod
    def _norm(text: str) -> str:
        return " " + re.sub(r"[^\w']+", " ", canonical(unicodedata.normalize("NFC", text))).strip() + " "

    def match(self, transcript: str, lang: str) -> IntentResponse:
        text = self._norm(transcript)
        for phrase, intent in self.index.get(lang, []):
            if phrase in text:
                return IntentResponse(intent=intent, confidence=1.0)
        return self._approximate(text, lang)

    def _approximate(self, text: str, lang: str) -> IntentResponse:
        """La reconnaissance du pidgin se trompe de quelques lettres : on accepte une phrase proche, jamais une phrase vague.

        Une fenetre de mots du meme nombre que la phrase attendue doit lui ressembler a plus de FUZZY_MIN.
        Egalite entre deux intentions : on ne devine pas, la reponse est unknown.
        """
        words = text.split()
        best: dict[str, float] = {}
        for phrase, intent in self.index.get(lang, []):
            target = phrase.split()
            if len(target) < 2 or len(words) < len(target):
                continue  # un mot seul est trop ambigu pour etre devine
            for i in range(len(words) - len(target) + 1):
                score = SequenceMatcher(None, " ".join(words[i : i + len(target)]), " ".join(target)).ratio()
                if score > best.get(intent, 0.0):
                    best[intent] = score
        ranked = sorted(best.items(), key=lambda kv: kv[1], reverse=True)
        if not ranked or ranked[0][1] < FUZZY_MIN or (len(ranked) > 1 and ranked[0][1] - ranked[1][1] < FUZZY_GAP):
            return IntentResponse(intent="unknown", confidence=0.0)
        return IntentResponse(intent=ranked[0][0], confidence=round(ranked[0][1], 2))


def read_pcm(audio: bytes) -> bytes:
    """N'accepte que du WAV PCM 16 bits, 16 kHz, mono : pas de decodeur de formats complexes."""
    invalid = KamaError(415, "invalid_audio", "Format attendu : WAV PCM 16 bits, 16 kHz, mono.")
    try:
        with wave.open(io.BytesIO(audio), "rb") as w:
            if (w.getnchannels(), w.getsampwidth(), w.getframerate()) != (1, 2, SAMPLE_RATE):
                raise invalid
            duration = w.getnframes() / SAMPLE_RATE
            if not MIN_AUDIO_SECONDS <= duration <= MAX_AUDIO_SECONDS:
                raise KamaError(422, "invalid_duration", "Enregistrement trop court ou trop long.")
            return w.readframes(w.getnframes())
    except (wave.Error, EOFError):
        raise invalid from None


class SpeechService:
    def __init__(self, engines: EngineSet, intents: IntentMatcher, gate: asyncio.Semaphore) -> None:
        self.engines, self.intents, self.gate = engines, intents, gate

    async def voice_intent(self, audio: bytes, lang: str) -> IntentResponse:
        """Le texte reconnu et l'audio restent en memoire et ne sortent pas de cette fonction.

        Seule l'intention est renvoyee : l'extension lit ensuite le montant sur la page.
        """
        if lang not in self.engines.languages:
            raise unsupported_language()
        pcm = read_pcm(audio)
        recognizer = self.engines.asr.get(lang)
        if recognizer is None:
            raise KamaError(503, "asr_unavailable", "La reconnaissance vocale n'est pas disponible pour cette langue.")
        if self.gate.locked():
            raise busy()
        async with self.gate:
            try:
                transcript = await asyncio.to_thread(recognizer.transcribe, pcm)
            except Exception as exc:  # le message pourrait citer ce qui a ete dit
                log.warning("reconnaissance en echec (%s)", type(exc).__name__)
                raise KamaError(503, "asr_unavailable", "La reconnaissance vocale a échoué.") from None
        return self.intents.match(transcript, lang)

    async def synthesize(self, text: str, lang: str) -> TtsResponse:
        """Ne synthetise que les morceaux entre les balises.

        Les nombres ne passent jamais par le serveur : chaque balise est rendue telle
        quelle et l'extension y joue ses audios de chiffres embarques.
        """
        if lang not in self.engines.languages:
            raise unsupported_language()
        if not is_masked(text) or has_hard_pii(text):
            raise unmasked()
        synth = self.engines.tts.get(lang)
        library = self.engines.clips.get(lang)
        if synth is None and library is None:
            raise KamaError(503, "tts_unavailable", "La synthèse vocale n'est pas disponible pour cette langue.")
        pieces = split_pieces(text)
        recorded = {p: library.find(p) if library else None for p in pieces}
        if synth is None and any(c is None for c in recorded.values()):
            raise KamaError(503, "tts_unavailable", "Cette phrase n'a pas été enregistrée.")
        if self.gate.locked():
            raise busy()
        segments: list[AudioSegment | SlotSegment] = []
        async with self.gate:
            cursor = 0
            for m in list(SLOT_RE.finditer(text)) + [None]:
                piece = text[cursor : m.start() if m else len(text)].strip()
                if piece and piece_key(piece):
                    clip = recorded.get(piece)
                    if clip is not None:
                        segments.append(AudioSegment(data=base64.b64encode(clip.wav).decode("ascii"), origin=clip.origin))
                    else:
                        try:
                            wav = await asyncio.to_thread(synth.synthesize, piece)
                        except Exception as exc:
                            log.warning("synthese en echec (%s)", type(exc).__name__)
                            raise KamaError(503, "tts_unavailable", "La synthèse vocale a échoué.") from None
                        segments.append(AudioSegment(data=base64.b64encode(wav).decode("ascii"), origin="synthetic"))
                if m:
                    segments.append(SlotSegment(name=m.group()[1:-1]))
                    cursor = m.end()
        return TtsResponse(segments=segments)


@dataclass
class Services:
    engines: EngineSet
    translation: TranslationService
    speech: SpeechService


def build_services(settings: Settings, engines: EngineSet | None = None) -> Services:
    jargon = settings.content_dir / "jargon_simplification.json"
    simplifier = Simplifier.from_file(jargon) if jargon.exists() else None
    if engines is None:
        engines = load_engines(settings.routes_file, settings.models_dir, settings.content_dir, simplifier, settings.clips_path)
    memory = TranslationMemory.from_file(
        settings.content_dir / "templates.json",
        settings.near_match_threshold,
        [settings.content_dir / "safinum_test_page.json", settings.content_dir / "kama_interface.json"],
    )
    intents = IntentMatcher.from_file(settings.content_dir / "intents.json")
    gate = asyncio.Semaphore(settings.max_concurrent_models)
    return Services(engines, TranslationService(memory, engines, settings, gate), SpeechService(engines, intents, gate))
