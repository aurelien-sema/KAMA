"""Prepare les donnees d'ajustement de la voix pidgin (MMS-TTS) a partir de Common Voice pidgin camerounais (a lancer en local, une seule fois).

Usage : python 01_preparer_donnees.py [--limite N]
Entree (hors depot) : datasets/pidgin/common_voice_wes/cv-corpus-27.0-2026-09-11/wes (CC0) et le vocabulaire du modele (models/poids/tts/mms-tts-pcm/vocab.json).
Sortie : datasets/tts/wes_cv/{train,test}/ (format « audiofolder » de Hugging Face : audio/*.flac + metadata.csv) et le zip KAMA_tts_wes_drive.zip a la racine du projet.

Pourquoi ces choix :
  - La voix de base (MMS-TTS pcm) parle pidgin NIGERIAN. On l'ajuste sur du pidgin camerounais pour rapprocher la prononciation.
  - Common Voice est du son de telephone : on ne garde que les meilleurs enregistrements (peu de bruit, pas de saturation), coupes de leurs silences.
  - PLUSIEURS locuteurs, equilibres (au plus MAX_PAR_VOIX chacun) : la voix finale est un MELANGE des voix, pas la voix d'un contributeur
    (les conditions de Common Voice interdisent d'identifier les locuteurs). Les identifiants sont remplaces par une empreinte.
  - Le modele ne connait que 35 caracteres (a-z sans q, ' - et espace) : les phrases avec d'autres lettres ou des chiffres sont ecartees,
    la ponctuation est retiree (le serveur la rend par un silence).
  - 40 phrases sont mises de cote (test) : jamais dans l'entrainement, pour juger la voix sur du texte non appris.
Le zip contient des donnees Common Voice : il va sur ton Drive prive, jamais dans le depot ni sur un espace public.
"""
import argparse
import csv
import hashlib
import json
import random
import re
import sys
import unicodedata
import zipfile
from math import gcd
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ICI = Path(__file__).resolve().parent
DEPOT = ICI.parents[1]
RACINE = DEPOT.parent
CV = RACINE / "datasets" / "pidgin" / "common_voice_wes" / "cv-corpus-27.0-2026-09-11" / "wes"
VOCAB = DEPOT / "models" / "poids" / "tts" / "mms-tts-pcm" / "vocab.json"
SORTIE = RACINE / "datasets" / "tts" / "wes_cv"
ZIP = RACINE / "KAMA_tts_wes_drive.zip"
sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

MAX_PAR_VOIX = 450  # equilibre entre voix : aucune ne domine le melange
MIN_PAR_VOIX = 100  # une voix avec moins d'exemples n'apprend pas son profil
PRE_TIRAGE = 800  # enregistrements decodes au maximum par voix avant la selection par qualite
DUREE_MIN, DUREE_MAX = 1.5, 12.0  # secondes, apres suppression des silences
N_TEST = 40
GRAINE = 13


def lire_tsv(chemin):
    with open(chemin, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE))


def empreinte(valeur):
    return hashlib.sha1(valeur.encode()).hexdigest()[:8]


def nettoyer(texte, lettres):
    t = unicodedata.normalize("NFC", texte).lower().replace("’", "'")
    t = re.sub(r"[.,;:!?\"()«»…]", " ", t)
    if any(c.isdigit() for c in t) or any(c not in lettres and c != " " for c in t):
        return None
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(t.split()) >= 2 else None


def traiter(chemin):
    """Decode, ramene a 16 kHz, coupe les silences, normalise, et mesure la qualite. Renvoie (onde, snr_db, taux_de_saturation)."""
    x, taux = sf.read(str(chemin), dtype="float32")
    x = x.mean(axis=1) if x.ndim > 1 else x
    if taux != 16000:
        g = gcd(taux, 16000)
        x = resample_poly(x, 16000 // g, taux // g).astype("float32")
    x = np.clip(x, -1, 1)
    pas = 320  # 20 ms
    n = len(x) // pas
    if n < 10:
        return None
    # plancher a -70 dB : un silence numerique pur (-100 dB) ferait exploser la mesure sans dire que le son est meilleur
    energie = np.maximum(10 * np.log10((x[: n * pas].reshape(n, pas) ** 2).mean(axis=1) + 1e-10), -70.0)
    actif = np.where(energie > energie.max() - 35)[0]
    debut, fin = max(actif[0] - 5, 0) * pas, min(actif[-1] + 6, n) * pas  # garde 100 ms de marge
    y = x[debut:fin]
    if len(y) == 0 or np.abs(y).max() < 1e-3:
        return None
    snr = float(np.percentile(energie, 95) - np.percentile(energie, 10))  # ecart parole / fond : plus il est grand, plus c'est propre
    sature = float((np.abs(y) >= 0.99).mean())
    return (y * (0.95 / np.abs(y).max())).astype("float32"), snr, sature


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, help="essai rapide : nombre de phrases par voix")
    a = ap.parse_args()
    lettres = set(json.loads(VOCAB.read_text(encoding="utf-8"))) - {"|"} - set("0123457")
    durees = {l["clip"]: int(l["duration[ms]"]) for l in lire_tsv(CV / "clip_durations.tsv")}
    candidats = []
    for l in lire_tsv(CV / "validated.tsv"):
        t = nettoyer(l["sentence"], lettres)
        d = durees.get(l["path"], 0) / 1000
        if t and l["down_votes"] == "0" and DUREE_MIN <= d <= DUREE_MAX + 2:
            candidats.append({"path": l["path"], "text": t, "voix": empreinte(l["client_id"])})
    print(f"{len(candidats)} enregistrements valides au vocabulaire du modele, {len({c['text'] for c in candidats})} phrases")

    # phrases de test : choisies par empreinte (stable), jamais dans l'entrainement
    phrases = sorted({c["text"] for c in candidats}, key=lambda s: hashlib.sha1(s.encode()).hexdigest())
    test_phrases = set(phrases[:N_TEST])
    hasard = random.Random(GRAINE)
    par_voix = {}
    for c in candidats:
        par_voix.setdefault(c["voix"], []).append(c)
    voix_gardees = sorted(v for v, lst in par_voix.items() if len(lst) >= MIN_PAR_VOIX)
    index_voix = {v: i for i, v in enumerate(voix_gardees)}
    print(f"{len(voix_gardees)} voix gardees (au moins {MIN_PAR_VOIX} enregistrements) sur {len(par_voix)}")

    if SORTIE.exists():
        for p in SORTIE.rglob("*"):
            if p.is_file():
                p.unlink()
    train, test = [], []
    for v in voix_gardees:
        lst = [c for c in par_voix[v] if c["text"] not in test_phrases]
        hasard.shuffle(lst)
        lst = lst[: a.limite or PRE_TIRAGE]
        notes = []
        for c in lst:
            r = traiter(CV / "clips" / c["path"])
            if r is None or not DUREE_MIN <= len(r[0]) / 16000 <= DUREE_MAX or r[2] > 0.001:
                continue
            notes.append((r[1], c, r[0]))
        if not notes:
            continue
        seuil = np.percentile([n[0] for n in notes], 25)  # on ecarte le quart le plus bruite de chaque voix
        bons = sorted((n for n in notes if n[0] >= seuil), key=lambda n: -n[0])[: a.limite or MAX_PAR_VOIX]
        print(f"     mesure de qualite de cette voix : quartiles {np.percentile([n[0] for n in notes], [25, 50, 75]).round(0)} dB", flush=True)
        for snr, c, onde in bons:
            nom = f"{v}_{Path(c['path']).stem}"
            chemin = SORTIE / "train" / "audio" / f"{nom}.flac"
            chemin.parent.mkdir(parents=True, exist_ok=True)
            sf.write(str(chemin), onde, 16000, format="FLAC", subtype="PCM_16")
            train.append({"file_name": f"audio/{nom}.flac", "text": c["text"], "speaker_id": index_voix[v], "secondes": len(onde) / 16000})
        print(f"  voix {index_voix[v]:>2} ({v}) : {len(bons)} gardes sur {len(lst)} (SNR median {np.median([n[0] for n in bons]):.0f} dB)")

    # test : un enregistrement par phrase de test, pris parmi les voix gardees
    for t in sorted(test_phrases):
        for c in sorted((c for c in candidats if c["text"] == t and c["voix"] in index_voix), key=lambda c: c["path"]):
            r = traiter(CV / "clips" / c["path"])
            if r is None or not DUREE_MIN <= len(r[0]) / 16000 <= DUREE_MAX:
                continue
            nom = f"test_{Path(c['path']).stem}"
            chemin = SORTIE / "test" / "audio" / f"{nom}.flac"
            chemin.parent.mkdir(parents=True, exist_ok=True)
            sf.write(str(chemin), r[0], 16000, format="FLAC", subtype="PCM_16")
            test.append({"file_name": f"audio/{nom}.flac", "text": t, "speaker_id": index_voix[c["voix"]], "secondes": len(r[0]) / 16000})
            break
    for nom, lignes in (("train", train), ("test", test)):
        with open(SORTIE / nom / "metadata.csv", "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["file_name", "text", "speaker_id"])
            w.writeheader()
            w.writerows({k: l[k] for k in ("file_name", "text", "speaker_id")} for l in lignes)
    heures = sum(l["secondes"] for l in train) / 3600
    print(f"\ntrain : {len(train)} enregistrements, {heures:.2f} h, {len({l['speaker_id'] for l in train})} voix, {len({l['text'] for l in train})} phrases")
    print(f"test : {len(test)} enregistrements ({len({l['text'] for l in test})} phrases jamais vues)")
    assert not ({l["text"] for l in train} & {l["text"] for l in test}), "fuite : une phrase de test est dans l'entrainement"

    # phrases a ecouter apres l'entrainement : textes valides de la page de test (sans chiffres) + phrases de test
    page = json.loads((DEPOT / "content-data" / "safinum_test_page.json").read_text(encoding="utf-8"))["entries"]
    ecoute = [e["wes"] for e in page if "{x" not in e["wes"] and not re.search(r"\d", e["wes"])][:14] + sorted(test_phrases)[:6]
    (SORTIE / "ecoute_phrases.json").write_text(json.dumps(ecoute, ensure_ascii=False, indent=1), encoding="utf-8")

    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_STORED) as z:  # le FLAC est deja compresse
        for p in sorted(SORTIE.rglob("*")):
            if p.is_file():
                z.write(p, f"KAMA/tts_wes/data/{p.relative_to(SORTIE).as_posix()}")
        z.write(ICI / "entrainement_tts_colab.ipynb", "KAMA/tts_wes/entrainement_tts_colab.ipynb")
    with zipfile.ZipFile(ZIP) as z:
        assert z.testzip() is None
        noms = z.namelist()
        assert any(n.endswith("train/metadata.csv") for n in noms) and any(n.endswith("test/metadata.csv") for n in noms)
    print(f"{ZIP} : {ZIP.stat().st_size / 1048576:.0f} Mo")


if __name__ == "__main__":
    main()
