"""Memoire de traduction : phrases validees par des locuteurs, en lecture seule."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from .security.guards import canonical, key_terms, negations, similarity
from .security.masking import is_masked, slots_of

SOURCES = ("fr", "en")


@dataclass(frozen=True)
class Template:
    id: str
    sources: dict[str, str]
    translations: dict[str, str]  # uniquement les traductions validees


class TemplateError(ValueError):
    pass


def _load(path: Path) -> list[Template]:
    templates = []
    for raw in json.loads(path.read_text(encoding="utf-8"))["templates"]:
        sources = {lang: raw[lang] for lang in SOURCES if raw.get(lang)}
        reference = None
        for lang, text in sources.items():
            if not is_masked(text):
                raise TemplateError(f"{raw['id']} : source {lang} mal masquee")
            if reference is None:
                reference = slots_of(text)
            elif reference != slots_of(text):
                raise TemplateError(f"{raw['id']} : balises differentes entre les sources")
        translations = {}
        for lang, entry in raw.get("translations", {}).items():
            if not entry or not entry.get("text"):
                continue
            if slots_of(entry["text"]) != reference:
                raise TemplateError(f"{raw['id']} : balises differentes dans la traduction {lang}")
            if entry.get("validated_by"):  # une traduction non validee n'est jamais servie
                translations[lang] = entry["text"]
        templates.append(Template(raw["id"], sources, translations))
    return templates


class TranslationMemory:
    def __init__(self, templates: list[Template], near_threshold: float) -> None:
        self.templates = templates
        self.near_threshold = near_threshold
        self.exact = {(lang, canonical(text)): t for t in templates for lang, text in t.sources.items()}

    @classmethod
    def from_file(cls, path: Path, near_threshold: float) -> "TranslationMemory":
        return cls(_load(path), near_threshold)

    def find_exact(self, text: str, source: str, target: str) -> str | None:
        template = self.exact.get((source, canonical(text)))
        return template.translations.get(target) if template else None

    def find_near(self, text: str, source: str, target: str) -> str | None:
        """Phrase validee presque identique et de meme portee.

        Memes balises, meme negation et memes termes financiers : « Les frais sont
        remboursables » ne peut donc jamais recevoir la traduction de la phrase negative.
        """
        best, best_score = None, self.near_threshold
        for t in self.templates:
            candidate = t.sources.get(source)
            if candidate is None or target not in t.translations:
                continue
            if slots_of(candidate) != slots_of(text) or negations(candidate) != negations(text):
                continue
            if key_terms(candidate) != key_terms(text):
                continue
            score = similarity(candidate, text)
            if score >= best_score:
                best, best_score = t, score
        return best.translations[target] if best else None
