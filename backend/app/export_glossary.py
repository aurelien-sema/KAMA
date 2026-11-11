"""Ecrit le glossaire embarque dans l'extension : python -m app.export_glossary

Le glossaire contient uniquement les traductions VALIDEES par un locuteur (le serveur n'en sert pas d'autres non plus),
avec des balises {xN} a la place des valeurs. L'extension le consulte avant tout appel reseau (securite : « glossaire local d'abord »)
et reste utilisable sans serveur pour ces phrases.

Cle = texte source francais masque, ramene a la forme de comparaison `normalize` (identique a normaliser() de kama_frontend/lib/glossaire.ts).
"""
from __future__ import annotations

import json
import unicodedata

from .memory import TranslationMemory
from .settings import BACKEND_DIR, REPO_DIR, load_settings


def normalize(text: str) -> str:
    """Casse, apostrophes typographiques, espaces et ponctuation finale ignores. Meme algorithme que le glossaire de l'extension."""
    t = unicodedata.normalize("NFC", text).lower().replace("’", "'")
    return " ".join(t.split()).rstrip(".!? ")


def build_glossary(memory: TranslationMemory) -> dict[str, dict[str, dict[str, str]]]:
    glossary: dict[str, dict[str, dict[str, str]]] = {"fr": {}}
    for template in memory.templates:
        for text in template.sources.get("fr", ()):
            for lang, translation in template.translations.items():
                glossary["fr"].setdefault(lang, {})[normalize(text)] = translation
    return {src: dict(sorted((lang, dict(sorted(entries.items()))) for lang, entries in by_lang.items())) for src, by_lang in glossary.items()}


def main() -> None:
    settings = load_settings()
    memory = TranslationMemory.from_file(
        settings.content_dir / "templates.json",
        settings.near_match_threshold,
        [settings.content_dir / "safinum_test_page.json", settings.content_dir / "kama_interface.json", settings.content_dir / "kama_fenetre.json"],
    )
    target = REPO_DIR / "kama_frontend" / "config" / "glossaire.json"
    data = {
        "_note": "Genere par `python -m app.export_glossary` depuis content-data. Traductions validees seulement. Ne pas modifier a la main.",
        **build_glossary(memory),
    }
    target.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    counts = {lang: len(entries) for lang, entries in data["fr"].items()}
    print(target, counts)


if __name__ == "__main__":
    main()
