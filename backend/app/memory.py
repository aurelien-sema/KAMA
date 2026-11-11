"""Memoire de traduction : phrases validees par des locuteurs, en lecture seule.

Deux sources :
- content-data/templates.json : phrases bancaires generales, deja masquees ;
- content-data/safinum_test_page.json : textes de la page officielle de test, avec leurs
  valeurs en clair, masques ici au chargement.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

from .security.guards import canonical, key_terms, negations, same_meaning_words, similarity
from .security.masking import SLOT_RE, is_masked, mask, slots_of

log = logging.getLogger("kama.memory")
SOURCES = ("fr", "en")
TARGETS = ("wes", "bbj")
_GROUP = re.compile(r"(?<!\\)\((?!\?)(?:[^()\\]|\\.)*(?<!\\)\)")


@dataclass(frozen=True)
class Template:
    id: str
    sources: dict[str, tuple[str, ...]]
    translations: dict[str, str]  # uniquement les traductions validees


@dataclass(frozen=True)
class Pattern:
    """Phrase a valeur variable, ex. « Bonjour, {x1} » : chaque groupe doit etre une balise."""

    id: str
    regex: dict[str, re.Pattern]
    translations: dict[str, str] = field(default_factory=dict)


class TemplateError(ValueError):
    pass


def _validator(entry: dict, lang: str) -> str | None:
    return entry.get(f"validated_by_{lang}") or (entry.get("validated_by") if lang == "wes" else None)


def _load_templates(path: Path) -> list[Template]:
    templates = []
    for raw in json.loads(path.read_text(encoding="utf-8"))["templates"]:
        sources = {lang: (raw[lang],) for lang in SOURCES if raw.get(lang)}
        reference = None
        for lang, (text,) in sources.items():
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


def _mask_translation(source_values: dict[str, str], text: str) -> str | None:
    """Remplace chaque valeur de la traduction par la balise de la meme valeur dans la source.

    Rend None si la traduction contient une valeur absente de la source ou en oublie une :
    une traduction qui change un montant n'est jamais chargee.
    """
    same = lambda v: re.sub(r"\s", "", v)  # « 2 % » et « 2% » sont la meme valeur ; « 1,5 » et « 15 » non
    by_value = {same(v): k for k, v in source_values.items()}
    masked = mask(text, known_values=tuple(source_values.values()))
    renumber = {}
    for slot, value in masked.values.items():
        if same(value) not in by_value:
            return None
        renumber[slot] = by_value[same(value)]
    out = SLOT_RE.sub(lambda m: "{" + renumber[m.group()[1:-1]] + "}", masked.text)
    return out if sorted(SLOT_RE.findall(out)) == sorted("{" + s + "}" for s in source_values) else None


def _load_page(path: Path) -> tuple[list[Template], list[Pattern]]:
    """Une entree invalide est ignoree avec un avertissement : une correction de locuteur ne doit pas arreter le serveur."""
    data = json.loads(path.read_text(encoding="utf-8"))
    templates: list[Template] = []
    for entry in data.get("entries", []):
        masked_sources: dict[str, tuple[str, ...]] = {}
        values = None
        for lang in SOURCES:
            variants = entry.get(lang)
            variants = variants if isinstance(variants, list) else [variants] if variants else []
            texts = []
            for variant in variants:
                m = mask(variant)
                values = values if values is not None else m.values
                texts.append(m.text)
            if texts:
                masked_sources[lang] = tuple(texts)
        translations = {}
        for lang in TARGETS:
            text = entry.get(lang)
            if not text or not _validator(entry, lang):
                continue
            masked = _mask_translation(values or {}, text)
            if masked is None:
                log.warning("entree %s ignoree pour %s : valeurs differentes de la source", entry.get("id"), lang)
                continue
            translations[lang] = masked
        templates.append(Template(entry["id"], masked_sources, translations))
    patterns = []
    for raw in data.get("patterns", []):
        regex = {}
        for lang in SOURCES:
            if raw.get(lang):  # chaque groupe de la page devient « exactement une balise »
                regex[lang] = re.compile(_GROUP.sub(r"(\\{x\\d+\\})", raw[lang]))
        translations = {lang: raw[lang] for lang in TARGETS if raw.get(lang) and _validator(raw, lang)}
        patterns.append(Pattern(raw["id"], regex, translations))
    return templates, patterns


class TranslationMemory:
    def __init__(self, templates: list[Template], near_threshold: float, patterns: list[Pattern] | None = None) -> None:
        self.templates = templates
        self.patterns = patterns or []
        self.near_threshold = near_threshold
        # Un meme texte source peut figurer dans plusieurs fichiers (ex. « Frais ») : on garde tous les gabarits,
        # pour qu'un gabarit sans traduction ne cache pas celui qui en a une.
        self.exact: dict[tuple[str, str], list[Template]] = {}
        for t in templates:
            for lang, texts in t.sources.items():
                for text in texts:
                    self.exact.setdefault((lang, canonical(text)), []).append(t)

    @classmethod
    def from_file(cls, path: Path, near_threshold: float, page: Path | list[Path] | None = None) -> "TranslationMemory":
        """`page` : un ou plusieurs fichiers de catalogue (page de test, phrases et interface de Kama), meme format."""
        templates, patterns = _load_templates(path), []
        for fichier in [page] if isinstance(page, Path) else page or []:
            if fichier.exists():
                page_templates, page_patterns = _load_page(fichier)
                templates += page_templates
                patterns += page_patterns
        return cls(templates, near_threshold, patterns)

    def find_exact(self, text: str, source: str, target: str) -> str | None:
        for template in self.exact.get((source, canonical(text)), []):
            if target in template.translations:
                return template.translations[target]
        return self._find_pattern(text, source, target)

    def _find_pattern(self, text: str, source: str, target: str) -> str | None:
        for p in self.patterns:
            regex, translation = p.regex.get(source), p.translations.get(target)
            if regex is None or translation is None:
                continue
            m = regex.fullmatch(" ".join(text.split()))
            if m:
                out = translation
                for n, slot in enumerate(m.groups(), 1):
                    out = out.replace("{x%d}" % n, "\x00%s\x00" % slot)
                return out.replace("\x00", "")
        return None

    def find_near(self, text: str, source: str, target: str) -> str | None:
        """Phrase validee presque identique et de meme portee.

        Memes balises, meme negation, memes termes financiers, et seuls des mots neutres
        peuvent differer : « Les frais sont remboursables » ne recoit jamais la traduction
        de la phrase negative, ni « maximum » celle de « minimum ».
        """
        best, best_score = None, self.near_threshold
        for t in self.templates:
            if target not in t.translations:
                continue
            for candidate in t.sources.get(source, ()):
                if slots_of(candidate) != slots_of(text) or negations(candidate) != negations(text):
                    continue
                if key_terms(candidate) != key_terms(text) or not same_meaning_words(candidate, text):
                    continue
                score = similarity(candidate, text)
                if score >= best_score:
                    best, best_score = t, score
        return best.translations[target] if best else None
