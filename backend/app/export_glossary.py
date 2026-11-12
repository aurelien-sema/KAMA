"""Ecrit le glossaire embarque dans l'extension : python -m app.export_glossary

Le glossaire contient uniquement les traductions VALIDEES par un locuteur (le serveur n'en sert pas d'autres non plus),
avec des balises {xN} a la place des valeurs. L'extension le consulte avant tout appel reseau (securite : « glossaire local d'abord »)
et reste utilisable sans serveur pour ces phrases.

Cle = texte source francais masque, ramene a la forme de comparaison `normalize` (identique a cleGlossaire() de kama_frontend/lib/glossaire.ts).

Second fichier, `interface.json` : tout ce que Kama dit lui-meme, dans la langue choisie (decision de l'equipe, 2026-11-12 : quand une langue
est choisie, toute l'interface de Kama passe dans cette langue).
Sources : content-data/kama_interface.json (menu, boutons, badges, messages d'etat) et content-data/kama_fenetre.json (explications de la
fenetre). Chaque entree porte son `statut` : « valide » (champ validated_by) ou « brouillon ». Un brouillon s'affiche avec le badge
« Traduction automatique », jamais « Verifie » ; une validation le fait passer a « valide » sans changer le code.
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
    glossary: dict[str, dict[str, dict[str, str]]] = {"fr": {}, "en": {}}
    for template in memory.templates:
        for source in ("fr", "en"):
            for text in template.sources.get(source, ()):
                for lang, translation in template.translations.items():
                    glossary[source].setdefault(lang, {})[normalize(text)] = translation
    return {src: dict(sorted((lang, dict(sorted(entries.items()))) for lang, entries in by_lang.items())) for src, by_lang in glossary.items() if by_lang}


def build_patterns(page: dict) -> dict[str, list[dict[str, str]]]:
    """Textes de la page a valeur variable (« Bonjour, Amina »), valides par un locuteur.

    L'extension applique ces modeles LOCALEMENT sur le texte brut : la valeur (nom, numero, montant) est recopiee telle quelle et ne part jamais
    au serveur. Protocole de la page de test : « appliquer patterns, et remettre les valeurs extraites sans les changer ».
    """
    out: dict[str, list[dict[str, str]]] = {}
    for raw in page.get("patterns", []):
        for lang in ("wes", "bbj"):
            validator = raw.get(f"validated_by_{lang}") or (raw.get("validated_by") if lang == "wes" else None)
            if raw.get(lang) and validator and (raw.get("fr") or raw.get("en")):
                entry = {"id": raw["id"], "texte": raw[lang]}
                for source in ("fr", "en"):
                    if raw.get(source):
                        entry[source] = raw[source]
                out.setdefault(lang, []).append(entry)
    return out


def build_interface(entries: list[dict]) -> dict[str, dict[str, dict[str, dict[str, str]]]]:
    """Les entrees validees passent avant les brouillons quand un meme texte francais apparait deux fois."""
    out: dict[str, dict[str, dict[str, str]]] = {}
    for e in sorted(entries, key=lambda e: bool(e.get("validated_by"))):
        if not e.get("fr") or not e.get("wes"):
            continue
        valide = bool(e.get("validated_by"))
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
    page = json.loads((settings.content_dir / "safinum_test_page.json").read_text(encoding="utf-8"))
    data = {
        "_note": "Genere par `python -m app.export_glossary` depuis content-data. Traductions validees seulement. Ne pas modifier a la main.",
        **build_glossary(memory),
        "patterns": build_patterns(page),
    }
    target.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    counts = {f"{src}.{lang}": len(entries) for src in ("fr", "en") for lang, entries in data.get(src, {}).items()}
    counts["modeles"] = sum(len(v) for v in data["patterns"].values())
    print(target, counts)

    interface = [
        e
        for nom in ("kama_interface.json", "kama_fenetre.json")
        for e in json.loads((settings.content_dir / nom).read_text(encoding="utf-8"))["entries"]
    ]
    cible_interface = REPO_DIR / "kama_frontend" / "config" / "interface.json"
    donnees = {
        "_note": "Genere par `python -m app.export_glossary` depuis content-data/kama_interface.json et kama_fenetre.json. statut brouillon = pas encore valide par un locuteur (badge Traduction automatique). Ne pas modifier a la main.",
        **build_interface(interface),
    }
    cible_interface.write_text(json.dumps(donnees, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    compte = {s: sum(1 for v in d.values() if v["statut"] == s) for d in donnees["fr"].values() for s in ("valide", "brouillon")}
    print(cible_interface, compte)


if __name__ == "__main__":
    main()
