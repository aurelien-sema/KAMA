"""Compare des traductions pidgin aux documents collectes.

Usage : python 04_verifier_documents.py traductions.json
Un mot absent des documents n'est pas forcement faux : il est a montrer en priorite au locuteur.
"""
import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

ICI = Path(__file__).resolve().parent
DEPOT = ICI.parents[1]
DATA = ICI / "data"
MOT = re.compile(r"[a-zà-ÿ']+")


def mots(texte):
    return MOT.findall(str(texte).lower().replace("’", "'"))


def lexique():
    import pandas as pd
    import pypdf

    base = DEPOT / "datasets" / "pidgin"
    compte = {"mt560": Counter(), "soreva": Counter(), "peace_corps": Counter(), "rosetta": Counter()}
    for phrase in pd.read_parquet(next((base / "mt560_en-pidgin").glob("*.parquet")))["wes"]:
        compte["mt560"].update(mots(phrase))
    for ligne in open(DEPOT / "datasets" / "soreva" / "pcm_cm.test.tsv", encoding="utf-8"):
        compte["soreva"].update(mots(ligne.split("\t")[1]))
    # Les livres sont hors de GitHub : ils restent dans le dossier datasets du projet.
    livres = next(p for p in (base / "dictionnaires", DEPOT.parent / "datasets" / "pidgin" / "dictionnaires") if p.is_dir())
    for page in pypdf.PdfReader(livres / "peace_corps_intro_cameroonian_pidgin_ED255041.pdf").pages:
        compte["peace_corps"].update(mots(page.extract_text() or ""))
    for fichier in livres.glob("rosettaproject_*_ocr.txt"):
        compte["rosetta"].update(mots(fichier.read_text(encoding="utf-8", errors="replace")))
    atteste = {m for m, n in compte["mt560"].items() if n >= 2}
    for source in ("soreva", "peace_corps", "rosetta"):
        atteste |= set(compte[source])
    return atteste, {s: len(c) for s, c in compte.items()}


def main():
    DATA.mkdir(exist_ok=True)
    atteste, tailles = lexique()
    (DATA / "lexique_atteste.txt").write_text("\n".join(sorted(atteste)), encoding="utf-8")
    print("vocabulaire par source", tailles, "| mots attestes", len(atteste))
    for chemin in sys.argv[1:]:
        lignes = json.loads(Path(chemin).read_text(encoding="utf-8"))
        total = connus = 0
        signale = []
        for ligne in lignes:
            liste = mots(ligne["texte"])
            inconnus = sorted({m for m in liste if m not in atteste})
            total += len(liste)
            connus += sum(m in atteste for m in liste)
            ligne["mots_absents"] = inconnus
            if inconnus:
                signale.append(ligne)
        sortie = DATA / (Path(chemin).stem + "_verification.csv")
        with open(sortie, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(["id", "texte", "mots_absents_des_documents"])
            for ligne in lignes:
                w.writerow([ligne.get("id", ""), ligne["texte"], ", ".join(ligne["mots_absents"])])
        Path(chemin).write_text(json.dumps(lignes, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{Path(chemin).name}: {connus}/{total} mots attestes ({100 * connus / max(total, 1):.1f} %), {len(signale)}/{len(lignes)} lignes a verifier")
        for ligne in signale[:60]:
            print("  ", ligne["texte"][:70], "->", ", ".join(ligne["mots_absents"])[:60])


if __name__ == "__main__":
    main()
