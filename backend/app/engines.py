"""Moteurs d'IA interchangeables, choisis dans config/routes.json.

Le reste du serveur ne connait que ces interfaces. Quand les tests de modeles
designeront un gagnant, on ajoute son adaptateur ici et une ligne dans routes.json.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Protocol

log = logging.getLogger("kama.engines")


class Translator(Protocol):
    def translate(self, text: str) -> str: ...


class Recognizer(Protocol):
    def transcribe(self, pcm16: bytes) -> str: ...


class Synthesizer(Protocol):
    def synthesize(self, text: str) -> bytes: ...


class MarianCT2Translator:
    """Modele Marian converti en CTranslate2 int8 : rapide et leger sur CPU."""

    def __init__(self, path: Path, beam_size: int = 3, threads: int = 2) -> None:
        import ctranslate2
        import sentencepiece

        self._beam_size = beam_size
        self._source = sentencepiece.SentencePieceProcessor(model_file=str(path / "source.spm"))
        self._target = sentencepiece.SentencePieceProcessor(model_file=str(path / "target.spm"))
        self._model = ctranslate2.Translator(
            str(path), device="cpu", compute_type="int8", inter_threads=1, intra_threads=threads
        )

    def translate(self, text: str) -> str:
        tokens = self._source.encode(text, out_type=str) + ["</s>"]
        result = self._model.translate_batch([tokens], beam_size=self._beam_size, max_decoding_length=128)
        return self._target.decode(result[0].hypotheses[0]).strip()


FACTORIES: dict[str, Callable[..., Translator]] = {"marian_ct2": MarianCT2Translator}


@dataclass
class TranslationRoute:
    translator: Translator
    backtranslate: str | None = None
    min_backtranslation: float = 0.0


@dataclass
class EngineSet:
    languages: dict[str, str] = field(default_factory=dict)
    translation: dict[str, TranslationRoute] = field(default_factory=dict)
    asr: dict[str, Recognizer] = field(default_factory=dict)
    tts: dict[str, Synthesizer] = field(default_factory=dict)


def load_engines(routes_file: Path, models_dir: Path) -> EngineSet:
    """Un moteur absent rend sa route indisponible, sans empecher le serveur de demarrer."""
    config = json.loads(routes_file.read_text(encoding="utf-8"))
    engines = EngineSet(languages={k: v["name"] for k, v in config["languages"].items()})
    for route, spec in config.get("translation", {}).items():
        if not spec.get("enabled", True):
            continue
        try:
            translator = FACTORIES[spec["engine"]](models_dir / spec["path"])
        except Exception as exc:  # le message pourrait citer un chemin : seul le type est journalise
            log.warning("route %s indisponible (%s)", route, type(exc).__name__)
            continue
        engines.translation[route] = TranslationRoute(
            translator, spec.get("backtranslate"), float(spec.get("min_backtranslation", 0.0))
        )
    return engines
