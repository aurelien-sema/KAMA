"""Compare deux rapports du test inedit, ligne par ligne.

Usage : python 06_comparer.py data/rapport_inedit.csv data/rapport_inedit_ajuste_v1.csv
"""
import csv
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def lire(chemin):
    return list(csv.DictReader(open(chemin, encoding="utf-8-sig"), delimiter=";"))


def resume(lignes):
    avec = [l for l in lignes if l["valeurs_intactes"] in ("True", "False")]
    probleme = lambda p: sum(p in l["problemes"] for l in lignes)
    return {
        "sans probleme": sum(not l["problemes"] for l in lignes),
        "valeurs perdues": sum(l["valeurs_intactes"] == "False" for l in avec),
        "balises abimees": probleme("balises_changees"),
        "repetitions": probleme("repetition"),
        "recopies": probleme("recopie"),
        "mots absents": probleme("mots_inconnus"),
    }


a, b = lire(sys.argv[1]), lire(sys.argv[2])
assert [l["source"] for l in a] == [l["source"] for l in b], "les deux rapports ne portent pas sur les memes phrases"
ra, rb = resume(a), resume(b)
print(f"{'mesure':<16} {'avant':>6} {'apres':>6}")
for k in ra:
    print(f"{k:<16} {ra[k]:>6} {rb[k]:>6}")
print()
for x, y in zip(a, b):
    print(f"[{x['langue']}] {x['source'][:70]}")
    print(f"   avant : {x['pidgin'][:90]}  {('! ' + x['problemes'][:40]) if x['problemes'] else ''}")
    print(f"   apres : {y['pidgin'][:90]}  {('! ' + y['problemes'][:40]) if y['problemes'] else ''}")
