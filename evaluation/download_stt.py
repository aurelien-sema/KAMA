"""Telecharge les modeles et donnees utiles a la reconnaissance vocale (STT). Reprend apres une coupure.

Poids : KAMA/models/poids/asr/ (hors depot). Donnees d'essai : datasets/stt/ (hors depot).
"""
import json
import os
import sys
import time
import urllib.request

os.environ["HF_HUB_DISABLE_XET"] = "1"
from huggingface_hub import hf_hub_download, snapshot_download  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DEPOT = os.path.dirname(HERE)
ROOT = os.path.dirname(DEPOT)  # dossier du projet : les donnees restent hors du depot
POIDS = os.path.join(DEPOT, "models", "poids", "asr")
DONNEES = os.path.join(ROOT, "datasets", "stt")
sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

MODELES = [
    ("OpenVoiceOS/omnilingual-asr-ctc-300m-onnx", "omnilingual-ctc-300m-onnx", ["model.int8.onnx", "tokens.txt", "config.json", "LICENSE", "README.md", "test_wavs/*"]),
    ("OpenVoiceOS/omnilingual-asr-ctc-1b-onnx", "omnilingual-ctc-1b-onnx", ["*int8*", "tokens.txt", "config.json", "LICENSE", "README.md"]),
    ("Systran/faster-whisper-small", "faster-whisper-small", None),
    ("asr-nigerian-pidgin/pidgin-wav2vec2-xlsr53", "pidgin-wav2vec2-xlsr53", None),
]
DONNEES_HF = [("asr-nigerian-pidgin/nigerian-pidgin-1.0", "nigerian-pidgin-1.0")]


def net():
    for _ in range(120):
        try:
            urllib.request.urlopen("https://huggingface.co", timeout=10)
            return
        except Exception:
            time.sleep(30)


def essayer(nom, fn):
    for n in range(1, 8):
        net()
        try:
            fn()
            print("OK", nom)
            return True
        except Exception as e:
            print(f"essai {n} {nom}: {type(e).__name__} {str(e)[:150]}")
            time.sleep(20)
    print("ECHEC", nom)
    return False


def soreva_audio():
    """Audio SOREVA pidgin camerounais : on cherche le depot qui porte les fichiers cm_wes_*.wav."""
    r = json.load(urllib.request.urlopen("https://huggingface.co/api/datasets?search=soreva&limit=20", timeout=30))
    ids = [d["id"] for d in r]
    print("depots soreva:", ids)
    for i in ids:
        info = json.load(urllib.request.urlopen(f"https://huggingface.co/api/datasets/{i}", timeout=30))
        fichiers = [s["rfilename"] for s in info.get("siblings", [])]
        cm = [f for f in fichiers if "pcm_cm" in f or "cm_wes" in f]
        print(i, len(fichiers), "fichiers, cameroun pidgin:", cm[:5])
        if cm:
            snapshot_download(i, repo_type="dataset", local_dir=os.path.join(DONNEES, "soreva"), allow_patterns=[f for f in cm])
            return
    raise RuntimeError("audio SOREVA pcm_cm introuvable")


def main():
    os.makedirs(POIDS, exist_ok=True)
    os.makedirs(DONNEES, exist_ok=True)
    for depot, dossier, motifs in MODELES:
        essayer(depot, lambda: snapshot_download(depot, local_dir=os.path.join(POIDS, dossier), allow_patterns=motifs))
    for depot, dossier in DONNEES_HF:
        essayer(depot, lambda: snapshot_download(depot, repo_type="dataset", local_dir=os.path.join(DONNEES, dossier)))
    essayer("soreva audio", soreva_audio)
    print("STT TELECHARGE")


if __name__ == "__main__":
    main()
