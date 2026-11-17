"""Brouillons ghomala pre-calcules par le modele fr->bbj, pour tout ce que Kama affiche (decision de l'equipe, 2026-11-17).

Usage (dans l'image du serveur, qui a ctranslate2 et le code de app/) :
    python scripts/brouillons_ghomala.py <dossier content-data> <dossier du modele CTranslate2> [--refaire]

- Fichiers traites : kama_interface.json, kama_fenetre.json (textes de Kama), safinum_test_page.json (page de test).
- Les montants, nombres et noms sont masques ({xN}) avant le modele et remis a l'identique ensuite.
- Le libelle d'un bouton cite entre « » reste en francais : c'est le texte que la personne voit sur la page.
- Une sortie qui perd ou invente une balise, invente un chiffre ou recopie le francais est rejetee : le texte reste en francais.
- Le champ ecrit est `bbj`, sans `validated_by_bbj` : badge « Traduction automatique » ; une validation de locuteur le remplace.
- Sans --refaire, un `bbj` deja present n'est pas touche.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.engines import M2M100CT2Translator  # noqa: E402
from app.security.guards import output_problem  # noqa: E402
from app.security.masking import SLOT_RE, is_masked, mask  # noqa: E402

CITATION = re.compile(r"«\s*([^«»]+?)\s*»")
# Sortie reprise pour au moins ce nombre de textes francais differents : le modele a degenere (ex. « cú » pour
# « Audio », « Parler a Kama », « Resumer mes transactions »…). Des boutons identiques rendraient Kama inutilisable :
# ces textes restent en francais.
SORTIE_DEGENEREE = 3
FICHIERS = ("kama_interface.json", "kama_fenetre.json", "safinum_test_page.json")


def preparer(fr: str) -> tuple[str, dict[str, str]] | None:
    """Texte masque pour le modele et valeurs a remettre ; None si le masquage n'est pas sur."""
    libres = [int(n) for n in re.findall(r"\{x(\d+)\}", fr)]
    suivant = max(libres, default=0)
    valeurs: dict[str, str] = {}

    def citer(m: re.Match) -> str:
        nonlocal suivant
        suivant += 1
        valeurs[f"x{suivant}"] = m.group(0)
        return "{x%d}" % suivant

    texte = re.sub(r"\{q\d+\}", citer, CITATION.sub(citer, fr))  # {q1} : libelle insere par l'extension
    masque = mask(texte)
    if masque.values:
        # les nouvelles balises du masquage doivent suivre celles deja posees
        renum = {}
        for cle in sorted(masque.values, key=lambda k: int(k[1:])):
            if "{%s}" % cle in texte:  # balise deja presente dans la source
                continue
            suivant += 1
            renum[cle] = f"x{suivant}"
        texte = SLOT_RE.sub(lambda m: "{%s}" % renum.get(m.group()[1:-1], m.group()[1:-1]), masque.text)
        for ancien, nouveau in renum.items():
            valeurs[nouveau] = masque.values[ancien]
    return (texte, valeurs) if is_masked(texte) else None


def remettre(texte: str, valeurs: dict[str, str]) -> str:
    return SLOT_RE.sub(lambda m: valeurs.get(m.group()[1:-1], m.group()), texte)


def ecrire(chemin: Path, donnees: dict, brut: str) -> None:
    if chemin.name == "kama_interface.json":  # une entree par ligne, comme l'original
        lignes = ["{ " + json.dumps(e, ensure_ascii=False)[1:-1] + " }" for e in donnees["entries"]]
        texte = '{\n  "_note": %s,\n  "entries": [\n    %s\n  ]\n}\n' % (
            json.dumps(donnees["_note"], ensure_ascii=False),
            ",\n    ".join(lignes),
        )
    else:
        indent = 1 if brut.startswith('{\n "') else 2
        texte = json.dumps(donnees, ensure_ascii=False, indent=indent) + "\n"
    chemin.write_text(texte, encoding="utf-8")


def main() -> None:
    contenu, modele = Path(sys.argv[1]), Path(sys.argv[2])
    refaire = "--refaire" in sys.argv
    traducteur = M2M100CT2Translator(modele, beam_size=5, threads=4)
    cache: dict[str, str | None] = {}
    for nom in FICHIERS:
        chemin = contenu / nom
        brut = chemin.read_text(encoding="utf-8")
        donnees = json.loads(brut)
        bilan = Counter()
        for entree in donnees.get("entries", []):
            fr = entree.get("fr")
            fr = fr[0] if isinstance(fr, list) else fr
            if not fr or entree.get("validated_by_bbj") or (entree.get("bbj") and not refaire):
                bilan["inchange"] += 1
                continue
            if fr not in cache:
                prepare = preparer(fr)
                if prepare is None:
                    cache[fr] = None
                else:
                    source, valeurs = prepare
                    try:
                        sortie = traducteur.translate(source)
                    except Exception:
                        sortie = None
                    if sortie is None or output_problem(source, sortie):
                        cache[fr] = None
                    else:
                        cache[fr] = remettre(sortie, valeurs)
            if cache[fr]:
                nouvelle = {}
                for cle, valeur in entree.items():
                    if cle != "bbj":
                        nouvelle[cle] = valeur
                    if cle == ("wes" if "wes" in entree else "fr"):
                        nouvelle["bbj"] = cache[fr]
                entree.clear()
                entree.update(nouvelle)
                bilan["brouillon"] += 1
            else:
                entree.pop("bbj", None)
                bilan["reste_en_francais"] += 1
        ecrire(chemin, donnees, brut)
        print(nom, dict(bilan), flush=True)
    nettoyer(contenu)


def nettoyer(contenu: Path) -> None:
    """Retire les brouillons degeneres (meme sortie pour beaucoup de textes differents) ; les validations restent."""
    fichiers = {nom: (contenu / nom).read_text(encoding="utf-8") for nom in FICHIERS}
    donnees = {nom: json.loads(brut) for nom, brut in fichiers.items()}
    sources: dict[str, set[str]] = {}
    for d in donnees.values():
        for e in d.get("entries", []):
            if e.get("bbj") and not e.get("validated_by_bbj"):
                fr = e["fr"][0] if isinstance(e["fr"], list) else e["fr"]
                sources.setdefault(e["bbj"].strip().lower(), set()).add(fr.strip().lower())
    degeneres = {sortie for sortie, frs in sources.items() if len(frs) >= SORTIE_DEGENEREE}
    for nom, d in donnees.items():
        retires = 0
        for e in d.get("entries", []):
            if e.get("bbj") and not e.get("validated_by_bbj") and e["bbj"].strip().lower() in degeneres:
                del e["bbj"]
                retires += 1
        ecrire(contenu / nom, d, fichiers[nom])
        print(nom, "sorties degenerees retirees :", retires, flush=True)


if __name__ == "__main__":
    main()
