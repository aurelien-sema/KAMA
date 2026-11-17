"""Construit le dataset d'entrainement anglais -> pidgin camerounais (kama_pidgin_v2).

Usage : python 01_nettoyer_donnees.py [--valide_seulement]
Sortie : datasets/pidgin/kama_pidgin_v2/ (train, dev, test_soreva, rapport, README)
Puis : python exporter_drive.py, et mettre le zip dans Mon Drive.
"""
import argparse
import json
import random
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pandas as pd

from simplifier import simplifier

ICI = Path(__file__).resolve().parent
DEPOT = ICI.parents[1]
MT560 = next((DEPOT / "datasets" / "pidgin" / "mt560_en-pidgin").glob("*.parquet"))
CATALOGUE = DEPOT / "content-data" / "safinum_test_page.json"
SOREVA_WES = DEPOT / "datasets" / "soreva" / "pcm_cm.test.tsv"
SOREVA_EN = DEPOT / "evaluation" / "soreva_refs.tsv"
SORTIE = DEPOT / "datasets" / "pidgin" / "kama_pidgin_v2"
SEED = 13
PART_RELIGIEUX = 0.25  # part gardee des phrases religieuses, qui dominent le corpus
PART_BALISES = 0.20  # part des phrases dupliquees avec des balises a recopier
# Poids des phrases bancaires. Tant qu'elles ne sont que des brouillons, un poids fort
# apprendrait au modele nos propres erreurs : 8 fois (environ 4 % du train) au lieu de 20.
REPETITION_BANQUE = {"brouillon": 8, "valide": 20}
LICENCES = {"mt560": "CC BY 4.0", "balises": "CC BY 4.0 (derive de MT560)", "banque": "KAMA (brouillon a valider)", "soreva": "CC BY 4.0"}

REFERENCE_DEBUT = re.compile(r"^\s*(?:\d+[,.\-: ]+)*(?:\([a-z]\)[,.: ]*)*\s*")
PARENTHESE_VERSET = re.compile(r"\s*\([^()]*\d:\d[^()]*\)")
PARENTHESE_DEBUT = re.compile(r"^\([^()]{0,80}\)\s*")
CITATION_FINALE = re.compile(r"\s*[-—]\s*(?:[1-3] ?)?[A-Z][A-Za-z. ]+\d+:\d+.*$")
MOTS_COURANTS = frozenset("See What Why How When Who Where Which Read The This That These Those They There Some Many God Jesus Bible Lord You We He She It In On At For And But If So".split())
RELIGIEUX = re.compile(r"\b(Jehovah|Jesus|Bible|God|Christ|Kingdom|apostle|congregation)\b", re.I)
CANDIDAT = re.compile(r"(?<![A-Za-z0-9])(?:[A-Z][a-z]{2,}|\d[\d,.]*\d|\d)(?![A-Za-z0-9])")


def detokeniser(t):
    """MT560 est decoupe mot par mot : on rend une ponctuation normale."""
    t = t.replace('"', " ")
    t = re.sub(r"(?:(?<=\s)|^)'\s+|\s+'(?=[\s.,;:?!]|$)", " ", t)  # apostrophes utilisees comme guillemets
    t = re.sub(r"\s+([,.;:?!%)\]])", r"\1", t)
    t = re.sub(r"([(\[])\s+", r"\1", t)
    t = re.sub(r"\s+'(s|t|re|ve|ll|d|m)\b", r"'\1", t)
    t = re.sub(r"(?<=\w)\s*-\s*(?=\w)", "-", t)
    return re.sub(r"(?<=\d)\s*:\s*(?=\d)", ":", t)


def normaliser(texte):
    texte = unicodedata.normalize("NFC", str(texte)).replace("’", "'").replace("\u00a0", " ")
    texte = detokeniser(" ".join(texte.split()))
    texte = PARENTHESE_VERSET.sub("", texte)
    texte = CITATION_FINALE.sub("", texte)
    texte = PARENTHESE_DEBUT.sub("", REFERENCE_DEBUT.sub("", texte.lstrip(")] ")))
    return " ".join(REFERENCE_DEBUT.sub("", texte).split()).strip(" -")


def garder(en, wes):
    n_en, n_wes = len(en.split()), len(wes.split())
    if not (3 <= n_en <= 60 and 3 <= n_wes <= 60):
        return False
    if not 0.5 <= len(wes) / max(len(en), 1) <= 2.2:
        return False
    for t in (en, wes):
        if t.count("(") != t.count(")") or "[" in t or "]" in t or re.search(r"\d:\d", t):
            return False
    # Des nombres differents des deux cotes signalent une paire mal alignee, ou une traduction
    # qui change un nombre : exactement ce que le modele ne doit jamais apprendre.
    if sorted(re.findall(r"\d+", en)) != sorted(re.findall(r"\d+", wes)):
        return False
    return en.lower() != wes.lower() and "\ufffd" not in en + wes


def cle_texte(texte):
    """Forme de comparaison pour les doublons : sans casse ni ponctuation."""
    return " ".join(re.sub(r"[^\w']+", " ", unicodedata.normalize("NFC", texte).lower()).split())


def soreva():
    """Test independant : pidgin camerounais de la vie courante, jamais montre a l'entrainement."""
    wes = [l.split("\t")[1].strip() for l in SOREVA_WES.read_text(encoding="utf-8").splitlines()]
    refs = [l.split("\t") for l in SOREVA_EN.read_text(encoding="utf-8").splitlines()[1:]]
    return [{"en": r[2], "wes": w, "source": "soreva", "cat": r[1]} for r, w in zip(refs, wes) if r[1] not in ("nombre", "date", "mot")]


def avec_balises(en, wes):
    """Cache les noms et nombres presents des deux cotes : le modele apprend a recopier les balises."""
    mots_wes = set(CANDIDAT.findall(wes))
    choisis = []
    for i, m in enumerate(CANDIDAT.finditer(en)):
        utilisable = (m.start() > 0 or m.group()[0].isdigit()) and m.group() not in MOTS_COURANTS
        if utilisable and m.group() in mots_wes and m.group() not in choisis and not RELIGIEUX.search(m.group()):
            choisis.append(m.group())
    if not choisis:
        return None
    for n, mot in enumerate(choisis[:3], 1):
        motif = re.compile(rf"(?<![A-Za-z0-9]){re.escape(mot)}(?![A-Za-z0-9])")
        en, wes = motif.sub(f"ZZ{n}ZZ", en), motif.sub(f"ZZ{n}ZZ", wes)
    if sorted(re.findall(r"ZZ\d+ZZ", en)) != sorted(re.findall(r"ZZ\d+ZZ", wes)):
        return None  # une balise qui n'existe que d'un cote apprendrait a en perdre
    return en, wes


def paires_banque(valide_seulement):
    catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    paires, brouillons = [], 0
    for e in catalogue["entries"]:
        if valide_seulement and not e.get("validated_by"):
            continue
        brouillons += not e.get("validated_by")
        for en in e["en"] if isinstance(e["en"], list) else [e["en"]]:
            paires.append((en, e["wes"]))
            simple = simplifier(en, "en")
            if simple != en:
                paires.append((simple, e["wes"]))
    exemples = {"salutation": "Hello, ZZ1ZZ", "numero_compte": "Account number : ZZ1ZZ", "frais_mobile_money": "ZZ1ZZ fee (min. ZZ2ZZ, max. ZZ3ZZ)"}
    for p in catalogue["patterns"]:
        if valide_seulement and not p.get("validated_by"):
            continue
        brouillons += not p.get("validated_by")
        wes = re.sub(r"\{x(\d+)\}", r"ZZ\1ZZ", p["wes"])
        paires.append((exemples[p["id"]], wes))
    return sorted(set(paires)), brouillons


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--valide_seulement", action="store_true", help="n'utilise que les phrases validees par un locuteur")
    a = ap.parse_args()
    random.seed(SEED)
    SORTIE.mkdir(parents=True, exist_ok=True)
    test = soreva()
    # Les phrases de test ne doivent jamais apparaitre a l'entrainement, d'aucun cote.
    interdits = {cle_texte(c["en"]) for c in json.loads((ICI / "cas_inedits.json").read_text(encoding="utf-8"))["cas"]}
    interdits |= {cle_texte(t["en"]) for t in test} | {cle_texte(t["wes"]) for t in test}

    brut = pd.read_parquet(MT560)
    stats = Counter(brut=len(brut))
    vues, paires = set(), []
    for en, wes in zip(brut["eng"], brut["wes"]):
        en, wes = normaliser(en), normaliser(wes)
        if not garder(en, wes):
            stats["rejet_longueur_copie_ou_nombres"] += 1
            continue
        cle = (cle_texte(en), cle_texte(wes))  # doublons a la ponctuation pres
        if cle in vues or cle[0] in interdits or cle[1] in interdits:
            stats["rejet_doublon_ou_test"] += 1
            continue
        vues.add(cle)
        if RELIGIEUX.search(en) and random.random() > PART_RELIGIEUX:
            stats["religieux_retire"] += 1
            continue
        paires.append((en, wes))
    random.shuffle(paires)
    n_dev = max(200, int(len(paires) * 0.05))
    dev = paires[:n_dev]
    sources_dev = {e.lower() for e, _ in dev}
    train = [(e, w) for e, w in paires[n_dev:] if e.lower() not in sources_dev]  # aucune phrase de controle a l'entrainement
    stats["retire_car_deja_au_controle"] = len(paires) - n_dev - len(train)

    def ligne(e, w, source):
        domaine = "banque" if source == "banque" else "religieux" if RELIGIEUX.search(e) else "general"
        return {"en": e, "wes": w, "source": source, "domaine": domaine, "licence": LICENCES[source]}

    lignes = [ligne(e, w, "mt560") for e, w in train]
    for e, w in train:
        if random.random() < PART_BALISES:
            b = avec_balises(e, w)
            if b:
                lignes.append(ligne(b[0], b[1], "balises"))
    banque, brouillons = paires_banque(a.valide_seulement)
    poids = REPETITION_BANQUE["brouillon" if brouillons else "valide"]
    lignes += [ligne(e, w, "banque") for e, w in banque] * poids
    random.shuffle(lignes)

    fichiers = {"train": lignes, "dev": [ligne(e, w, "mt560") for e, w in dev], "test_soreva": [{**t, "licence": LICENCES["soreva"]} for t in test]}
    for nom, contenu in fichiers.items():
        with open(SORTIE / f"{nom}.jsonl", "w", encoding="utf-8", newline="\n") as f:
            for l in contenu:
                f.write(json.dumps(l, ensure_ascii=False) + "\n")
    rapport = {
        **stats, "gardees": len(paires), "dev": len(dev), "test_soreva": len(test), "train": len(lignes),
        "repartition_train": Counter(l["source"] for l in lignes), "domaines_train": Counter(l["domaine"] for l in lignes),
        "paires_banque": len(banque), "poids_banque": poids, "banque_non_validees": brouillons,
    }
    (SORTIE / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(rapport, ensure_ascii=False))
    if brouillons:
        print(f"ATTENTION : {brouillons} textes bancaires sont des brouillons non valides. Relancer avec --valide_seulement apres validation.")


if __name__ == "__main__":
    main()
