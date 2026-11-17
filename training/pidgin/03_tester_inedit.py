"""Teste la chaine de traduction sur des messages jamais vus, en francais et en anglais.

Usage : python 03_tester_inedit.py [--modele chemin_du_modele] [--limite 10]
Sortie : data/rapport_inedit.csv et un resume. Code de sortie 1 si un montant ou une valeur est perdu.
"""
import argparse
import csv
import json
import re
from pathlib import Path

ICI = Path(__file__).resolve().parent

from pipeline import JAMM55, Chaine  # noqa: E402
from simplifier import jargon_restant  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--modele", default=str(JAMM55))
    ap.add_argument("--limite", type=int)
    ap.add_argument("--sortie", default=str(ICI / "data" / "rapport_inedit.csv"))
    a = ap.parse_args()
    cas = json.loads((ICI / "cas_inedits.json").read_text(encoding="utf-8"))["cas"][: a.limite]
    fichier = ICI / "data" / "lexique_atteste.txt"
    lexique = set(fichier.read_text(encoding="utf-8").split()) if fichier.exists() else None
    chaine = Chaine(modele=a.modele, lexique=lexique)
    lignes = []
    for c in cas:
        for langue in ("fr", "en"):
            r = chaine.traduire(c[langue], langue)
            valeurs_ok = all(v in r["pidgin"] for v in r["valeurs"])
            restes = jargon_restant(re.sub(r"\{x\d+\}", " ", r["simplifie"]), langue)
            lignes.append({"cat": c["cat"], "langue": langue, **r, "valeurs_ok": valeurs_ok, "jargon_restant": restes})
            print(f"[{langue}] {c[langue][:62]} => {r['pidgin'][:80]} {r['motifs'] or ''}", flush=True)

    with open(a.sortie, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["categorie", "langue", "source", "simplifie", "anglais", "pidgin", "valeurs_intactes", "problemes", "jargon_restant"])
        for l in lignes:
            w.writerow([l["cat"], l["langue"], l["source"], l["simplifie"], l["anglais"], l["pidgin"], l["valeurs_ok"], " | ".join(l["motifs"]), ", ".join(l["jargon_restant"])])

    n = len(lignes)
    avec_valeurs = [l for l in lignes if l["valeurs"]]
    compter = lambda p: sum(any(m.startswith(p) for m in l["motifs"]) for l in lignes)
    resume = {
        "phrases": n,
        "valeurs_intactes": f"{sum(l['valeurs_ok'] for l in avec_valeurs)}/{len(avec_valeurs)}",
        "sans_aucun_probleme": sum(not l["motifs"] for l in lignes),
        "balises_changees": compter("balises"),
        "recopie": compter("recopie"),
        "repetition": compter("repetition"),
        "mots_inconnus": compter("mots_inconnus"),
        "jargon_non_simplifie": sum(bool(l["jargon_restant"]) for l in lignes),
    }
    print(json.dumps(resume, ensure_ascii=False))
    (Path(a.sortie).with_suffix(".json")).write_text(json.dumps(resume, ensure_ascii=False, indent=1), encoding="utf-8")
    raise SystemExit(0 if all(l["valeurs_ok"] for l in avec_valeurs) else 1)


if __name__ == "__main__":
    main()
