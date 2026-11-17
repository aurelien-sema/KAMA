"""Moteurs d'IA interchangeables, choisis dans config/routes.json.

Le reste du serveur ne connait que ces interfaces. Pour changer de modele, on remplace
ses fichiers a l'emplacement indique dans routes.json, sans toucher au code.
"""
from __future__ import annotations

import json
import logging
import re
import threading
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Protocol

from .clips import ClipLibrary
from .security.guards import canonical

log = logging.getLogger("kama.engines")


class Translator(Protocol):
    def translate(self, text: str) -> str: ...


class Recognizer(Protocol):
    def transcribe(self, pcm16: bytes) -> str: ...


class Synthesizer(Protocol):
    def synthesize(self, text: str) -> bytes: ...


class Chatter(Protocol):
    def answer(self, question: str, context: str) -> str: ...


class EngineRefused(Exception):
    """Le moteur a produit une sortie inutilisable : la phrase restera non traduite."""


# Les modeles Marian recopient mieux ZZ1ZZ que {x1} : on traduit la balise a l'entree et a la sortie.
_SLOT = re.compile(r"\{x(\d+)\}")
_MODEL_TAG = re.compile(r"Z\s?Z\s?(\d+)\s?Z\s?Z")


_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-ZÀ-Ý{(\"'])")


def split_sentences(text: str) -> list[str]:
    """Les modeles ont appris sur des phrases seules : un message de deux phrases est traduit en deux fois."""
    return [p for p in _SENTENCE_END.split(text.strip()) if p] or [text]


def to_model_tags(text: str) -> str:
    return _SLOT.sub(r"ZZ\1ZZ", text)


def from_model_tags(text: str) -> str:
    return _MODEL_TAG.sub(r"{x\1}", text)


class MarianCT2Translator:
    """Modele Marian converti en CTranslate2 int8 : rapide et leger sur CPU."""

    def __init__(self, path: Path, beam_size: int = 4, threads: int = 2) -> None:
        import ctranslate2
        import sentencepiece

        self._beam_size = beam_size
        self._source = sentencepiece.SentencePieceProcessor(model_file=str(path / "source.spm"))
        self._target = sentencepiece.SentencePieceProcessor(model_file=str(path / "target.spm"))
        self._model = ctranslate2.Translator(
            str(path), device="cpu", compute_type="int8", inter_threads=1, intra_threads=threads
        )

    def translate(self, text: str) -> str:
        return " ".join(self._sentence(s) for s in split_sentences(text))

    def _sentence(self, text: str) -> str:
        tokens = self._source.encode(to_model_tags(text), out_type=str) + ["</s>"]
        limit = min(256, 3 * len(tokens) + 24)  # un modele qui s'emballe s'arrete vite
        result = self._model.translate_batch(
            [tokens], beam_size=self._beam_size, max_decoding_length=limit, no_repeat_ngram_size=3
        )
        return from_model_tags(self._target.decode(result[0].hypotheses[0]).strip())


class M2M100Translator:
    """Modele M2M100 Hugging Face pour une direction configuree dans ses fichiers locaux."""

    def __init__(
        self,
        path: Path,
        source_lang: str = "fr",
        target_lang: str = "sw",
        threads: int = 2,
        num_beams: int = 1,
        max_new_tokens: int = 128,
    ) -> None:
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        torch.set_num_threads(threads)
        self._torch = torch
        self._tokenizer = AutoTokenizer.from_pretrained(path, local_files_only=True)
        self._tokenizer.src_lang = source_lang
        self._target_id = self._tokenizer.get_lang_id(target_lang)
        self._model = AutoModelForSeq2SeqLM.from_pretrained(
            path, dtype=torch.float16, low_cpu_mem_usage=True, local_files_only=True
        ).eval()
        self._beams = num_beams
        self._max_new_tokens = max_new_tokens
        self._lock = threading.Lock()

        model_config = json.loads((path / "kama_config.json").read_text(encoding="utf-8"))
        self._normalisation = model_config.get("normalisation", {})
        self._substitutions = {
            chr(int(code.removeprefix("U+"), 16)): replacement
            for code, replacement in model_config.get("substitutions", {}).items()
        }

    def translate(self, text: str) -> str:
        return " ".join(self._sentence(sentence) for sentence in split_sentences(text))

    def _sentence(self, text: str) -> str:
        text = unicodedata.normalize("NFC", text)
        if self._normalisation.get("apostrophe") == "'":
            for apostrophe in ("’", "‘", "ʼ", "`", "´"):
                text = text.replace(apostrophe, "'")
        if self._normalisation.get("alpha_vers_a"):
            text = text.replace("ɑ", "a").replace("Ɑ", "A")
        for original, substitute in self._substitutions.items():
            text = text.replace(original, substitute)

        encoded = self._tokenizer(
            to_model_tags(text), return_tensors="pt", truncation=True, max_length=256
        )
        input_length = int(encoded["attention_mask"].sum().item())
        limit = min(self._max_new_tokens, 3 * input_length + 24)
        with self._lock, self._torch.inference_mode():
            output = self._model.generate(
                **encoded,
                num_beams=self._beams,
                max_new_tokens=limit,
                forced_bos_token_id=self._target_id,
                do_sample=False,
            )
        translated = self._tokenizer.batch_decode(output, skip_special_tokens=True)[0].strip()
        if "\ufffd" in translated:
            raise EngineRefused("jeton inconnu")
        for original, substitute in self._substitutions.items():
            translated = translated.replace(substitute, original)
        return unicodedata.normalize("NFC", from_model_tags(translated))


class M2M100CT2Translator:
    """M2M100 ajuste (francais -> Ghomala) converti en CTranslate2 int8 : ~4 fois moins de memoire que torch fp32.

    Reprend les reglages du notebook d'entrainement : substitutions reversibles des caracteres que le
    tokenizer perd (kama_config.json), casse normale pour les sources en majuscules, decodage anti-boucles.
    """

    def __init__(
        self,
        path: Path,
        source_lang: str = "fr",
        target_lang: str = "sw",
        beam_size: int = 2,
        threads: int = 2,
        max_new_tokens: int = 128,
        repetition_penalty: float = 1.2,
        no_repeat_ngram_size: int = 3,
    ) -> None:
        import ctranslate2
        import sentencepiece

        self._sp = sentencepiece.SentencePieceProcessor(model_file=str(path / "sentencepiece.bpe.model"))
        self._model = ctranslate2.Translator(
            str(path), device="cpu", compute_type="int8", inter_threads=1, intra_threads=threads
        )
        self._source_tag = f"__{source_lang}__"
        self._target_tag = f"__{target_lang}__"
        self._beam_size = beam_size
        self._max_new_tokens = max_new_tokens
        self._repetition_penalty = repetition_penalty
        self._no_repeat = no_repeat_ngram_size
        self._lock = threading.Lock()

        model_config = json.loads((path / "kama_config.json").read_text(encoding="utf-8"))
        self._normalisation = model_config.get("normalisation", {})
        self._substitutions = {
            chr(int(code.removeprefix("U+"), 16)): replacement
            for code, replacement in model_config.get("substitutions", {}).items()
        }

    def translate(self, text: str) -> str:
        return " ".join(self._sentence(sentence) for sentence in split_sentences(text))

    @staticmethod
    def _casse_normale(text: str) -> str:
        lettres = [c for c in text if c.isalpha()]
        if len(lettres) < 4 or sum(c.isupper() for c in lettres) / len(lettres) <= 0.7:
            return text
        text = text.lower()  # les balises {x1} sont deja en minuscules
        return text[:1].upper() + text[1:]

    def _sentence(self, text: str) -> str:
        text = unicodedata.normalize("NFC", self._casse_normale(text))
        if self._normalisation.get("apostrophe") == "'":
            for apostrophe in ("’", "‘", "ʼ", "`", "´"):
                text = text.replace(apostrophe, "'")
        if self._normalisation.get("alpha_vers_a"):
            text = text.replace("ɑ", "a").replace("Ɑ", "A")
        for original, substitute in self._substitutions.items():
            text = text.replace(original, substitute)

        pieces = self._sp.encode(to_model_tags(text), out_type=str)[:254]
        tokens = [self._source_tag, *pieces, "</s>"]
        limit = min(self._max_new_tokens, int(2.5 * len(tokens)) + 10)
        with self._lock:
            result = self._model.translate_batch(
                [tokens],
                target_prefix=[[self._target_tag]],
                beam_size=self._beam_size,
                max_decoding_length=limit,
                repetition_penalty=self._repetition_penalty,
                no_repeat_ngram_size=self._no_repeat,
            )
        output = [t for t in result[0].hypotheses[0] if t != self._target_tag]
        if "<unk>" in output:
            raise EngineRefused("jeton inconnu")
        translated = self._sp.decode(output).strip()
        for original, substitute in self._substitutions.items():
            translated = translated.replace(substitute, original)
        return unicodedata.normalize("NFC", from_model_tags(translated))


class PipelineTranslator:
    """Enchaine des etapes : simplification du jargon, passage par l'anglais, puis modele final."""

    def __init__(self, steps: list[tuple[str, Callable[[str], str]]]) -> None:
        self.steps = steps

    def translate(self, text: str) -> str:
        previous = text
        last = len(self.steps) - 1
        for index, (kind, step) in enumerate(self.steps):
            current = step(previous)
            if index == last and kind == "model" and canonical(current) == canonical(previous):
                raise EngineRefused("recopie")  # le modele final a rendu sa phrase d'entree telle quelle
            previous = current
        return previous


FACTORIES: dict[str, Callable[..., Translator]] = {
    "marian_ct2": MarianCT2Translator,
    "m2m100": M2M100Translator,
    "m2m100_ct2": M2M100CT2Translator,
}


@dataclass
class TranslationRoute:
    translator: Translator
    backtranslate: str | None = None
    min_backtranslation: float = 0.0
    lexicon: frozenset[str] | None = None
    max_unknown_ratio: float = 1.0


@dataclass
class EngineSet:
    languages: dict[str, str] = field(default_factory=dict)
    translation: dict[str, TranslationRoute] = field(default_factory=dict)
    asr: dict[str, Recognizer] = field(default_factory=dict)
    tts: dict[str, Synthesizer] = field(default_factory=dict)
    clips: dict[str, ClipLibrary] = field(default_factory=dict)  # voix humaine validee, prioritaire sur le modele
    critical_model_elements: frozenset[str] = field(default_factory=frozenset)
    llm: Chatter | None = None  # modele de langue local, facultatif


def _lexicon(content_dir: Path | None, name: str | None) -> frozenset[str] | None:
    if not name or content_dir is None:
        return None
    path = content_dir / name
    return frozenset(path.read_text(encoding="utf-8").split()) if path.exists() else None


def _load_voice(config: dict, section: str, factories: dict, models_dir: Path) -> dict:
    """Moteurs STT ou TTS declares dans routes.json : un moteur absent ou casse n'empeche pas le serveur de demarrer."""
    loaded = {}
    for lang, spec in config.get(section, {}).items():
        if not spec.get("enabled", True):
            continue
        try:
            loaded[lang] = factories[spec["engine"]](models_dir / spec["path"], **spec.get("options", {}))
        except Exception as exc:
            log.warning("%s %s indisponible (%s)", section, lang, type(exc).__name__)
    return loaded


def load_engines(
    routes_file: Path, models_dir: Path, content_dir: Path | None = None, simplifier=None, clips_dir: Path | None = None
) -> EngineSet:
    """Un moteur absent rend sa route indisponible, sans empecher le serveur de demarrer."""
    config = json.loads(routes_file.read_text(encoding="utf-8"))
    engines = EngineSet(languages={k: v["name"] for k, v in config["languages"].items()})
    built: dict[str, Translator] = {}
    translation_config = config.get("translation", {})
    engines.critical_model_elements = frozenset(translation_config.get("critical_model_elements", []))
    specs = {
        k: v
        for k, v in translation_config.items()
        if isinstance(v, dict) and v.get("enabled", True)
    }
    for route, spec in specs.items():
        if spec["engine"] == "pipeline":
            continue
        try:
            built[route] = FACTORIES[spec["engine"]](
                models_dir / spec["path"], **spec.get("options", {})
            )
        except Exception as exc:  # le message pourrait citer un chemin : seul le type est journalise
            log.warning("route %s indisponible (%s)", route, type(exc).__name__)
    for route, spec in specs.items():
        if spec["engine"] != "pipeline":
            continue
        steps = []
        for step in spec["steps"]:
            if step.startswith("simplify:"):
                if simplifier is None:
                    break
                lang = step.split(":", 1)[1]
                steps.append(("simplify", lambda t, lang=lang: simplifier.simplify(t, lang)))
            elif step in built:
                steps.append(("model", built[step].translate))
            else:
                break
        else:
            built[route] = PipelineTranslator(steps)
            continue
        log.warning("route %s indisponible (etape manquante)", route)
    for route, translator in built.items():
        spec = specs[route]
        if spec.get("internal"):
            continue  # etape d'une autre route, jamais appelee directement
        engines.translation[route] = TranslationRoute(
            translator,
            spec.get("backtranslate"),
            float(spec.get("min_backtranslation", 0.0)),
            _lexicon(content_dir, spec.get("lexicon")),
            float(spec.get("max_unknown_ratio", 1.0)),
        )
    from .voice_engines import ASR_FACTORIES, TTS_FACTORIES

    engines.asr = _load_voice(config, "asr", ASR_FACTORIES, models_dir)
    engines.tts = _load_voice(config, "tts", TTS_FACTORIES, models_dir)

    spec = config.get("llm")
    if spec and spec.get("enabled", True):
        try:
            from .llm_engines import LLM_FACTORIES

            engines.llm = LLM_FACTORIES[spec["engine"]](
                models_dir / spec["path"], sha256=spec.get("sha256"), **spec.get("options", {})
            )
        except Exception as exc:  # empreinte, fichier absent ou bibliotheque : la route restera indisponible
            log.warning("llm indisponible (%s)", type(exc).__name__)
    for lang in engines.languages:
        library = ClipLibrary.load(clips_dir / lang) if clips_dir else ClipLibrary()
        if len(library):
            engines.clips[lang] = library
    return engines
