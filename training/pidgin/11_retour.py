"""Teste les modeles pidgin -> anglais comme garde par retraduction.

Usage : python 11_retour.py nom=chemin [nom=chemin ...]
1. Qualite du modele de retour : chrF du pidgin camerounais de SOREVA retraduit en anglais (data/soreva...).
2. Garde : pour chaque traduction de v2 sur les 60 messages inedits, on retraduit le pidgin en anglais et on mesure sa ressemblance avec
   l'anglais de depart. Une ressemblance basse doit signaler les traductions fausses (ex. « annuler » devenu « close »).
   Le tableau croise cette ressemblance avec nos reperes d'erreurs (balises, mots inconnus, terme critique manquant).
Sortie : data/retour_<nom>.csv et le resume a l'ecran.
"""
import csv
import json
import re
import sys
from pathlib import Path

import sacrebleu

from pipeline import Marian

ICI = Path(__file__).resolve().parent
DEPOT = ICI.parents[1]
TEST = DEPOT / "datasets" / "pidgin" / "kama_pidgin_v2" / "test_soreva.jsonl"
RAPPORT = ICI / "data" / "rapport_inedit_final_v2.csv"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BALISE = re.compile(r"ZZ\s?\d+\s?ZZ")


def main():
    modeles = [a.split("=", 1) for a in sys.argv[1:]]
    if not modeles:
        raise SystemExit(__doc__)
    paires = [json.loads(l) for l in TEST.read_text(encoding="utf-8").splitlines() if l.strip()]
    lignes = [l for l in csv.DictReader(open(RAPPORT, encoding="utf-8-sig", newline=""), delimiter=";") if l["langue"] == "en"]
    for nom, chemin in modeles:
        m = Marian(chemin)
        retour = [m.traduire(p["wes"]) for p in paires]
        chrf = sacrebleu.corpus_chrf(retour, [[p["en"] for p in paires]], word_order=2).score
        print(f"{nom:<10} SOREVA pidgin -> anglais : chrF {chrf:5.1f} ({len(paires)} phrases)", flush=True)

        sorties = []
        for l in lignes:
            sans_balises = BALISE.sub(" ", l["pidgin"])
            back = m.traduire(sans_balises)
            sim = sacrebleu.sentence_chrf(back, [BALISE.sub(" ", l["simplifie"] or l["anglais"])]).score
            sorties.append((sim, l, back))
        sorties.sort(key=lambda x: x[0])
        with open(ICI / "data" / f"retour_{nom}.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(["ressemblance", "anglais", "pidgin_v2", "retour", "problemes"])
            for sim, l, back in sorties:
                w.writerow([round(sim, 1), l["anglais"], l["pidgin"], back, l["problemes"]])
        avec = [s for s, l, _ in sorties if l["problemes"]]
        sans = [s for s, l, _ in sorties if not l["problemes"]]
        moy = lambda x: sum(x) / len(x) if x else float("nan")
        print(f"   ressemblance moyenne : {moy(sans):.1f} pour les {len(sans)} traductions sans probleme, {moy(avec):.1f} pour les {len(avec)} avec probleme")
        print("   les 8 plus basses :")
        for sim, l, back in sorties[:8]:
            print(f"     {sim:4.0f}  {l['anglais'][:55]!r} -> {l['pidgin'][:50]!r} -> {back[:55]!r}")
        cancel = [(s, l, b) for s, l, b in sorties if "cancel" in l["anglais"].lower()]
        for s, l, b in cancel:
            print(f"   cas annuler : {s:4.0f} {l['pidgin'][:55]!r} -> {b[:55]!r}")


if __name__ == "__main__":
    main()
