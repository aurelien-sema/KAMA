"""Prépare les données pidgin -> anglais, dans le sens inverse de pidgin_m2m.

Les paires viennent de training/pidgin_m2m/data (train, dev, test_soreva), déjà filtrées : religieux réduit à 15 %,
dédoublonnées, aucune phrase du test SOREVA dans le train. On inverse seulement le sens :
    entrée (src) = pidgin camerounais (champ wes), sortie (tgt) = anglais (champ en).
Les balises ZZn ZZ sont gardées et doivent être identiques des deux côtés (vérifié ici).

Usage :  python preparer.py --source ../pidgin_m2m/data --sortie data
"""
import argparse
import json
import re
from pathlib import Path

BALISE = re.compile(r"ZZ\s?\d+\s?ZZ")


def lire(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def inverser(lignes, nom):
    sortie, vus = [], set()
    rejets = {"vide": 0, "balises": 0, "doublon": 0}
    for r in lignes:
        src, tgt = r["wes"].strip(), r["en"].strip()
        if not src or not tgt:
            rejets["vide"] += 1
            continue
        if sorted(BALISE.findall(src)) != sorted(BALISE.findall(tgt)):
            rejets["balises"] += 1
            continue
        if (src, tgt) in vus:
            rejets["doublon"] += 1
            continue
        vus.add((src, tgt))
        sortie.append({"src": src, "tgt": tgt, "source": r.get("source", ""), "domaine": r.get("domaine", "")})
    print(f"{nom:<12} {len(sortie):>6} paires ; rejetées : {rejets}")
    return sortie


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="../pidgin_m2m/data")
    ap.add_argument("--sortie", default="data")
    a = ap.parse_args()
    src, out = Path(a.source), Path(a.sortie)
    out.mkdir(parents=True, exist_ok=True)
    jeux = {
        "train": inverser(lire(src / "train.jsonl"), "train"),
        "dev": inverser(lire(src / "dev.jsonl"), "dev"),
        "test_soreva": inverser(lire(src / "test_soreva.jsonl"), "test_soreva"),
    }
    cles = {nom: {(r["src"], r["tgt"]) for r in lignes} for nom, lignes in jeux.items()}
    if cles["train"] & (cles["dev"] | cles["test_soreva"]):
        raise SystemExit("fuite : des paires de dev ou de test sont dans le train")
    for nom, lignes in jeux.items():
        with open(out / f"{nom}.jsonl", "w", encoding="utf-8") as f:
            for r in lignes:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print("écrit dans", out.resolve())


if __name__ == "__main__":
    main()
