"""Teste les modeles francais -> anglais et anglais -> francais sur nos textes.

Usage : python 05_tester_fr_en.py
Sortie : data/rapport_fr_en.csv et un resume.
"""
import csv
import json
import re
from pathlib import Path

ICI = Path(__file__).resolve().parent
DEPOT = ICI.parents[1]

import sacrebleu  # noqa: E402

from pipeline import BALISE, OPUS_EN_FR, OPUS_FR_EN, Marian, controler, mask  # noqa: E402


def preparer(texte):
    m = mask(texte)
    return re.sub(r"\{x(\d+)\}", r"ZZ\1ZZ", m.text), m.values


def lignes_a_tester():
    catalogue = json.loads((DEPOT / "content-data" / "safinum_test_page.json").read_text(encoding="utf-8"))
    for e in catalogue["entries"]:
        en = e["en"][0] if isinstance(e["en"], list) else e["en"]
        yield "page", e["fr"], en
    for c in json.loads((ICI / "cas_inedits.json").read_text(encoding="utf-8"))["cas"]:
        yield "inedit", c["fr"], c["en"]


def main():
    modeles = {"fr>en": Marian(str(OPUS_FR_EN)), "en>fr": Marian(str(OPUS_EN_FR))}
    chrf = sacrebleu.CHRF(word_order=2)
    lignes = []
    for groupe, fr, en in lignes_a_tester():
        for sens, source, reference in (("fr>en", fr, en), ("en>fr", en, fr)):
            entree, valeurs = preparer(source)
            sortie = modeles[sens].traduire(entree)
            motifs = [m for m in controler(entree, sortie) if m != "recopie"]
            rendu = BALISE.sub(lambda m: valeurs.get("x" + m.group(1), m.group()), sortie)
            lignes.append({"groupe": groupe, "sens": sens, "source": source, "sortie": rendu, "reference": reference, "balises": bool(valeurs), "valeurs_ok": all(v in rendu for v in valeurs.values()), "motifs": motifs})
            print(f"[{sens}] {source[:60]} => {rendu[:70]} {motifs or ''}", flush=True)
    with open(ICI / "data" / "rapport_fr_en.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["groupe", "sens", "source", "sortie", "reference", "valeurs_intactes", "problemes"])
        for l in lignes:
            w.writerow([l["groupe"], l["sens"], l["source"], l["sortie"], l["reference"], l["valeurs_ok"], " | ".join(l["motifs"])])
    resume = {}
    for sens in ("fr>en", "en>fr"):
        for groupe in ("page", "inedit"):
            s = [l for l in lignes if l["sens"] == sens and l["groupe"] == groupe]
            valeurs = [l for l in s if l["balises"]]
            resume[f"{sens} {groupe}"] = {
                "phrases": len(s),
                "chrF": round(chrf.corpus_score([l["sortie"] for l in s], [[l["reference"] for l in s]]).score, 1),
                "valeurs_intactes": f"{sum(l['valeurs_ok'] for l in valeurs)}/{len(valeurs)}",
                "problemes": sum(bool(l["motifs"]) for l in s),
            }
    print(json.dumps(resume, ensure_ascii=False))


if __name__ == "__main__":
    main()
