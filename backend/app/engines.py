"""Moteurs d'IA interchangeables, choisis dans config/routes.json.

Le reste du serveur ne connait que ces interfaces. Pour changer de modele, on remplace
ses fichiers a l'emplacement indique dans routes.json, sans toucher au code.
"""
from __future__ import annotations

import json
import logging
import re
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


FACTORIES: dict[str, Callable[..., Translator]] = {"marian_ct2": MarianCT2Translator}


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
    specs = {k: v for k, v in config.get("translation", {}).items() if v.get("enabled", True)}
    for route, spec in specs.items():
        if spec["engine"] == "pipeline":
            continue
        try:
            built[route] = FACTORIES[spec["engine"]](models_dir / spec["path"])
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
