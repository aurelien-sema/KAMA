"""Prepare les donnees d'entrainement de la reconnaissance vocale pidgin (a lancer en local, une seule fois).

Usage : python 01_preparer_donnees.py [--npa] [--sortie dossier] [--zip chemin.zip] [--limite N]
Entree (hors depot) :
  datasets/pidgin/common_voice_wes/cv-corpus-27.0-2026-09-11/wes   Common Voice pidgin camerounais (CC0)
  datasets/soreva/pcm_cm.test.tsv + datasets/stt/soreva            SOREVA pidgin camerounais (evaluation seulement)
  datasets/stt/nigerian-pidgin-1.0 (option --npa)                  Nigerian Pidgin ASR 1.0 (entrainement en plus)
Sortie : un dossier puis un zip pour Google Drive, avec des FLAC mono 16 kHz et des manifestes jsonl.

Regles de decoupage (pour que la note soit honnete) :
  - test et dev = les phrases de test.tsv et dev.tsv de Common Voice ; leurs phrases ne sont JAMAIS dans l'entrainement ;
  - entrainement = tous les enregistrements valides des phrases de train.tsv (une phrase est dite par une dizaine de voix) ;
  - SOREVA ne sert qu'a evaluer (pas d'entrainement), c'est la voix la plus differente de Common Voice.
Les identifiants de locuteurs de Common Voice sont remplaces par une empreinte : les conditions interdisent de les identifier.
Le zip contient des donnees Common Voice : il va sur ton Drive prive, jamais dans le depot ni sur un espace public.
"""
import argparse
import csv
import hashlib
import io
import json
import sys
import zipfile
from math import gcd
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

DEPOT = Path(__file__).resolve().parents[2]
RACINE = DEPOT.parent
CV = RACINE / "datasets" / "pidgin" / "common_voice_wes" / "cv-corpus-27.0-2026-09-11" / "wes"
SOREVA_TSV = RACINE / "datasets" / "soreva" / "pcm_cm.test.tsv"
SOREVA_AUDIO = RACINE / "datasets" / "stt" / "soreva"
NPA = RACINE / "datasets" / "stt" / "nigerian-pidgin-1.0" / "data"
sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)


def lire_tsv(chemin):
    with open(chemin, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE))


def vers_16k(x, taux):
    x = x.mean(axis=1) if x.ndim > 1 else x
    if taux != 16000:
        g = gcd(taux, 16000)
        x = resample_poly(x, 16000 // g, taux // g)
    return np.clip(x, -1, 1).astype("float32")


def ecrire_flac(onde, chemin):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(chemin), onde, 16000, format="FLAC", subtype="PCM_16")
    return len(onde) / 16000


def empreinte(valeur):
    return hashlib.sha1(valeur.encode()).hexdigest()[:8]


def cv(sortie, limite):
    valides = lire_tsv(CV / "validated.tsv")
    phrases = {nom: {l["sentence"] for l in lire_tsv(CV / f"{nom}.tsv")} for nom in ("train", "dev", "test")}
    assert not (phrases["train"] & (phrases["dev"] | phrases["test"])), "des phrases de train sont dans dev ou test"
    parts = {"train": [], "dev": [], "test": []}
    for l in valides:
        for nom in parts:
            if l["sentence"] in phrases[nom]:
                parts[nom].append(l)
                break
    # dev et test : un seul enregistrement par phrase, ceux de dev.tsv et test.tsv (comme Common Voice) ; train : tous
    for nom in ("dev", "test"):
        voulus = {l["path"] for l in lire_tsv(CV / f"{nom}.tsv")}
        parts[nom] = [l for l in parts[nom] if l["path"] in voulus]
    for nom, lignes in parts.items():
        if limite:
            lignes = lignes[:limite]
        sortie_m, secondes = [], 0.0
        for i, l in enumerate(lignes):
            x, taux = sf.read(str(CV / "clips" / l["path"]), dtype="float32")
            rel = f"audio/cv/{nom}/{Path(l['path']).stem}.flac"
            secondes += ecrire_flac(vers_16k(x, taux), sortie / rel)
            sortie_m.append({"audio": rel, "text": l["sentence"], "speaker": empreinte(l["client_id"]), "source": "common_voice_wes"})
            if i % 500 == 0:
                print(f"  cv {nom}: {i}/{len(lignes)}", flush=True)
        (sortie / f"manifeste_cv_{nom}.jsonl").write_text("\n".join(json.dumps(m, ensure_ascii=False) for m in sortie_m), encoding="utf-8")
        print(f"cv {nom}: {len(sortie_m)} enregistrements, {secondes / 3600:.2f} h, {len({m['speaker'] for m in sortie_m})} voix, "
              f"{len({m['text'] for m in sortie_m})} phrases")


def soreva(sortie, limite):
    refs = [r for r in csv.reader(open(SOREVA_TSV, encoding="utf-8", newline=""), delimiter="\t", quoting=csv.QUOTE_NONE) if len(r) >= 3]
    trouves = {p.name: p for p in SOREVA_AUDIO.rglob("*.wav")}
    sortie_m = []
    for r in refs[: limite or None]:
        if r[0] not in trouves:
            continue
        x, taux = sf.read(str(trouves[r[0]]), dtype="float32")
        rel = f"audio/soreva/{Path(r[0]).stem}.flac"
        ecrire_flac(vers_16k(x, taux), sortie / rel)
        sortie_m.append({"audio": rel, "text": r[2], "speaker": "soreva", "source": "soreva_pcm_cm"})
    (sortie / "manifeste_soreva_test.jsonl").write_text("\n".join(json.dumps(m, ensure_ascii=False) for m in sortie_m), encoding="utf-8")
    print(f"soreva test: {len(sortie_m)} phrases")


def npa(sortie, limite):
    import pandas as pd

    for nom, motif in (("train", "train-*.parquet"), ("dev", "validation-*.parquet")):
        sortie_m = []
        for fichier in sorted(NPA.glob(motif)):
            df = pd.read_parquet(fichier)
            col_texte = next(c for c in ("text", "sentence", "transcription", "transcript") if c in df.columns)
            for i, ligne in enumerate(df.itertuples(index=False)):
                d = ligne._asdict()
                audio = d["audio"]
                x, taux = sf.read(io.BytesIO(audio["bytes"]), dtype="float32")
                rel = f"audio/npa/{nom}/{fichier.stem}_{i}.flac"
                ecrire_flac(vers_16k(x, taux), sortie / rel)
                sortie_m.append({"audio": rel, "text": str(d[col_texte]), "speaker": "npa", "source": "nigerian_pidgin_asr_1.0"})
                if limite and len(sortie_m) >= limite:
                    break
        (sortie / f"manifeste_npa_{nom}.jsonl").write_text("\n".join(json.dumps(m, ensure_ascii=False) for m in sortie_m), encoding="utf-8")
        print(f"npa {nom}: {len(sortie_m)} enregistrements")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--npa", action="store_true", help="ajoute Nigerian Pidgin ASR 1.0 a l'entrainement")
    ap.add_argument("--sortie", default=str(RACINE / "datasets" / "stt" / "pack_colab"))
    ap.add_argument("--zip", default=str(RACINE / "KAMA_pidgin_stt_drive.zip"))
    ap.add_argument("--limite", type=int, help="essai rapide : N enregistrements par jeu")
    a = ap.parse_args()
    sortie = Path(a.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    cv(sortie, a.limite)
    soreva(sortie, a.limite)
    if a.npa:
        npa(sortie, a.limite)
    # le script d'entrainement part dans le zip pour qu'un seul fichier suffise a Colab
    entrainer = Path(__file__).with_name("entrainer_stt.py")
    with zipfile.ZipFile(a.zip, "w", zipfile.ZIP_STORED) as z:  # les FLAC sont deja compresses
        for p in sorted(sortie.rglob("*")):
            if p.is_file():
                z.write(p, "KAMA/stt/" + p.relative_to(sortie).as_posix())
        if entrainer.exists():
            z.write(entrainer, "KAMA/stt/entrainer_stt.py")
    print(f"zip: {a.zip} ({Path(a.zip).stat().st_size / 1e6:.0f} Mo)")


if __name__ == "__main__":
    main()
