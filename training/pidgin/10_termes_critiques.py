"""Mesure si les termes importants de la source sont rendus par une forme pidgin attestee (dictionnaire_pidgin.json).

Usage : python 10_termes_critiques.py data/rapport_inedit_final_v2.csv [autre.csv ...]
Un fichier = colonnes 'anglais' (source) et 'pidgin' (sortie du modele), comme les rapports de 03_tester_inedit.py.
Pour chaque terme du dictionnaire present dans la source, la sortie doit contenir la forme attestee ou une de ses variantes.
Une forme manquante n'est pas toujours fausse (une paraphrase est possible) : la liste sert a faire relire les cas par un locuteur.
La liste des termes vient du dictionnaire et reste a valider par des natifs (statuts atteste, emprunt_atteste, a_valider).
"""
import csv
import json
import re
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
DICO = ICI.parents[1] / "content-data" / "dictionnaire_pidgin.json"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def mots(t):
    return re.findall(r"[a-zà-ÿ']+", t.lower())


def contient(sequence, motif):
    n = len(motif)
    return any(sequence[i:i + n] == motif for i in range(len(sequence) - n + 1))


def main():
    termes = json.loads(DICO.read_text(encoding="utf-8"))["termes"]
    if "--avec-ajouts" in sys.argv:  # termes proposes par 13_candidats_banque.py (a valider par un locuteur)
        termes += json.loads((ICI / "dictionnaire_pidgin_ajouts.json").read_text(encoding="utf-8"))["termes"]
    for chemin in [a for a in sys.argv[1:] if not a.startswith("--")]:
        lignes = list(csv.DictReader(open(chemin, encoding="utf-8-sig", newline=""), delimiter=";"))
        applicables = bons = 0
        rates = []
        for l in lignes:
            src, sortie = mots(l["anglais"]), mots(l["pidgin"])
            for t in termes:
                motif = mots(t["en"])
                if not motif or not contient(src, motif):
                    continue
                acceptes = [mots(t["pidgin"])] + [mots(v) for v in t.get("variantes", [])]
                applicables += 1
                if any(contient(sortie, a) for a in acceptes if a):
                    bons += 1
                else:
                    rates.append((t["en"], t["pidgin"], l["pidgin"][:80]))
        print(f"{Path(chemin).name}: {applicables} termes a rendre, {bons} rendus par une forme attestee ({100 * bons / max(applicables, 1):.0f} %)")
        for en, pidgin, sortie in rates[:12]:
            print(f"   {en!r} attendu {pidgin!r} -> {sortie!r}")


if __name__ == "__main__":
    main()
