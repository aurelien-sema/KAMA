"""Ecrit le glossaire embarque dans l'extension : python -m app.export_glossary

Le glossaire contient uniquement les traductions VALIDEES par un locuteur (le serveur n'en sert pas d'autres non plus),
avec des balises {xN} a la place des valeurs. L'extension le consulte avant tout appel reseau (securite : « glossaire local d'abord »)
et reste utilisable sans serveur pour ces phrases.

Cle = texte source francais masque, ramene a la forme de comparaison `normalize` (identique a cleGlossaire() de kama_frontend/lib/glossaire.ts).

Second fichier, `interface.json` : les textes PAR DEFAUT de Kama (content-data/kama_interface.json : menu, boutons, badges, messages d'etat),
avec leur pidgin. Ils sont affiches meme tant qu'un locuteur ne les a pas valides, parce que ce sont des libelles d'interface sans montant ni
avertissement. Chaque entree porte son `statut` (« valide » ou « brouillon ») : une validation (champ validated_by) le fait passer a « valide »
sans changer le code. Les textes qui expliquent ou repondent (zones `expliquer`, `reponse`, `resume`) ne sont inclus que s'ils sont valides.
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


# Zones de kama_interface.json qui sont du libelle d'interface : un brouillon peut s'afficher. Les autres (explications, reponses avec montants,
# categories d'operations) ne sortent que validees.
ZONES_LIBELLES = frozenset({"popup", "menu", "fenetre", "selection", "badge", "etat", "voix"})


def build_interface(entries: list[dict]) -> dict[str, dict[str, dict[str, dict[str, str]]]]:
    out: dict[str, dict[str, dict[str, str]]] = {}
    for e in entries:
        if not e.get("fr") or not e.get("wes"):
            continue
        valide = bool(e.get("validated_by"))
        if not valide and e.get("zone") not in ZONES_LIBELLES:
            continue
        out.setdefault("wes", {})[normalize(e["fr"])] = {"texte": e["wes"], "statut": "valide" if valide else "brouillon", "zone": e.get("zone", "")}
    return {"fr": {lang: dict(sorted(items.items())) for lang, items in out.items()}}


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

    interface = json.loads((settings.content_dir / "kama_interface.json").read_text(encoding="utf-8"))["entries"]
    cible_interface = REPO_DIR / "kama_frontend" / "config" / "interface.json"
    donnees = {
        "_note": "Genere par `python -m app.export_glossary` depuis content-data/kama_interface.json. statut brouillon = pas encore valide par un locuteur. Ne pas modifier a la main.",
        **build_interface(interface),
    }
    cible_interface.write_text(json.dumps(donnees, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    compte = {s: sum(1 for v in d.values() if v["statut"] == s) for d in donnees["fr"].values() for s in ("valide", "brouillon")}
    print(cible_interface, compte)


if __name__ == "__main__":
    main()
