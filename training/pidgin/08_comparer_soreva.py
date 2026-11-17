"""Note chrF de plusieurs modeles anglais -> pidgin sur les phrases SOREVA (pidgin camerounais, jamais vues).

Usage : python 08_comparer_soreva.py nom=chemin [nom=chemin ...]
Meme decodage pour tous (celui du serveur : 4 faisceaux, sans repetition de 3 mots).
Sortie : data/soreva_comparaison.csv (une ligne par phrase) et le resume a l'ecran.
"""
import csv
import json
import sys
from pathlib import Path

import sacrebleu

from pipeline import Marian

ICI = Path(__file__).resolve().parent
DEPOT = ICI.parents[1]
TEST = DEPOT / "datasets" / "pidgin" / "kama_pidgin_v2" / "test_soreva.jsonl"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def main():
    modeles = [a.split("=", 1) for a in sys.argv[1:]]
    if not modeles:
        raise SystemExit(__doc__)
    paires = [json.loads(l) for l in TEST.read_text(encoding="utf-8").splitlines() if l.strip()]
    sorties = {}
    for nom, chemin in modeles:
        m = Marian(chemin)
        sorties[nom] = [m.traduire(p["en"]) for p in paires]
        refs = [p["wes"] for p in paires]
        chrf = sacrebleu.corpus_chrf(sorties[nom], [refs], word_order=2).score
        bleu = sacrebleu.corpus_bleu(sorties[nom], [refs]).score
        print(f"{nom:<14} chrF {chrf:5.1f}   BLEU {bleu:5.1f}   ({len(paires)} phrases)", flush=True)
    with open(ICI / "data" / "soreva_comparaison.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["anglais", "reference"] + [n for n, _ in modeles])
        for i, p in enumerate(paires):
            w.writerow([p["en"], p["wes"]] + [sorties[n][i] for n, _ in modeles])


if __name__ == "__main__":
    main()
