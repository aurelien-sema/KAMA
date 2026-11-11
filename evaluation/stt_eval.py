"""Mesure la reconnaissance vocale sur des phrases de pidgin dont on connait le texte.

Usage : python stt_eval.py [--limite N] [--modeles omni300,omni1b,w2v_pidgin,whisper_small]
Donnees : audio SOREVA pidgin camerounais (datasets/stt/soreva) avec le texte de datasets/soreva/pcm_cm.test.tsv.
Notes : WER (mots) et CER (lettres), apres mise en minuscules et retrait de la ponctuation. Plus c'est bas, mieux c'est.
Sortie : evaluation/results/stt/<modele>.jsonl et le resume a l'ecran.
"""
import argparse
import csv
import json
import os
import re
import sys
import time
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
DEPOT = HERE.parent  # le depot KAMA
ROOT = DEPOT.parent  # dossier du projet : datasets/ y est range hors du depot
sys.path.insert(0, str(DEPOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
POIDS = DEPOT / "models" / "poids" / "asr"
SOREVA_TSV = ROOT / "datasets" / "soreva" / "pcm_cm.test.tsv"
SOREVA_AUDIO = ROOT / "datasets" / "stt" / "soreva"
SORTIE = HERE / "results" / "stt"


def normaliser(t: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w' ]+", " ", t.lower())).strip()


def distance(a, b) -> int:
    """Distance d'edition (insertions, suppressions, remplacements) entre deux sequences."""
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def lire_wav16k(chemin: Path) -> np.ndarray:
    with wave.open(str(chemin), "rb") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
        x = x.reshape(-1, w.getnchannels()).mean(axis=1)
        taux = w.getframerate()
    if taux != 16000:
        from math import gcd

        from scipy.signal import resample_poly

        g = gcd(taux, 16000)
        x = resample_poly(x, 16000 // g, taux // g).astype(np.float32)
    return x


def pcm16(x: np.ndarray) -> bytes:
    return (np.clip(x, -1, 1) * 32767).astype("<i2").tobytes()


def charger(nom: str):
    """Renvoie une fonction onde (float32, 16 kHz) -> texte."""
    if nom in ("omni300", "omni1b"):
        from app.voice_engines import OnnxCtcRecognizer

        reco = OnnxCtcRecognizer(POIDS / ("omnilingual-ctc-300m-onnx" if nom == "omni300" else "omnilingual-ctc-1b-onnx"), threads=4)
        return lambda x: reco.transcribe(pcm16(x))
    if nom == "w2v_pidgin":
        import torch
        from transformers import AutoModelForCTC, AutoProcessor

        dossier = POIDS / "pidgin-wav2vec2-xlsr53"
        proc, modele = AutoProcessor.from_pretrained(dossier), AutoModelForCTC.from_pretrained(dossier).eval()

        def run(x):
            with torch.inference_mode():
                logits = modele(**proc(x, sampling_rate=16000, return_tensors="pt")).logits
            return proc.batch_decode(logits.argmax(-1))[0]

        return run
    if nom == "whisper_small":
        from faster_whisper import WhisperModel

        m = WhisperModel(str(POIDS / "faster-whisper-small"), device="cpu", compute_type="int8", cpu_threads=4)
        return lambda x: " ".join(s.text for s in m.transcribe(x, language="en", beam_size=5)[0])
    if nom.startswith("hf_ctc:") or nom == "khaya_wbert":  # modele CTC au format transformers (candidat ou ajuste)
        import torch
        from transformers import AutoModelForCTC, AutoProcessor

        dossier = POIDS.parent / "candidats" / "KhayaAI__w2v-bert-pcm" if nom == "khaya_wbert" else Path(nom.split(":", 1)[1])
        proc, modele = AutoProcessor.from_pretrained(dossier), AutoModelForCTC.from_pretrained(dossier).float().eval()
        torch.set_num_threads(4)

        def run_ctc(x):
            with torch.inference_mode():
                logits = modele(**proc.feature_extractor(x, sampling_rate=16000, return_tensors="pt")).logits
            return proc.batch_decode(logits.argmax(-1))[0]

        return run_ctc
    if nom.startswith("whisper_hf:"):  # Whisper ajuste au pidgin nigerian (format transformers), nom du dossier dans candidats/
        import torch
        from transformers import pipeline

        torch.set_num_threads(4)
        asr = pipeline("automatic-speech-recognition", model=str(POIDS.parent / "candidats" / nom.split(":", 1)[1]), device=-1)
        return lambda x: asr({"raw": x, "sampling_rate": 16000}, generate_kwargs={"language": "en", "task": "transcribe"})["text"]
    raise SystemExit(f"modele inconnu : {nom}")


CV = ROOT / "datasets" / "pidgin" / "common_voice_wes" / "cv-corpus-27.0-2026-09-11" / "wes"


def lire_audio(chemin: Path) -> np.ndarray:
    """WAV ou MP3 (Common Voice) -> onde mono 16 kHz."""
    if chemin.suffix.lower() == ".wav":
        return lire_wav16k(chemin)
    from math import gcd

    import soundfile as sf
    from scipy.signal import resample_poly

    x, taux = sf.read(str(chemin), dtype="float32")
    x = x.mean(axis=1) if x.ndim > 1 else x
    if taux == 16000:
        return x
    g = gcd(taux, 16000)
    return resample_poly(x, 16000 // g, taux // g).astype(np.float32)


def phrases(jeu, limite):
    if jeu == "cv":  # Common Voice wes, partie test : voix camerounaises variees (CC0)
        lignes = list(csv.DictReader(open(CV / "test.tsv", encoding="utf-8", newline=""), delimiter="\t", quoting=csv.QUOTE_NONE))
        sortie = [(l["path"], l["sentence"], CV / "clips" / l["path"]) for l in lignes]
    else:
        refs = [r for r in csv.reader(open(SOREVA_TSV, encoding="utf-8", newline=""), delimiter="\t", quoting=csv.QUOTE_NONE) if len(r) >= 3]
        trouves = {p.name: p for p in SOREVA_AUDIO.rglob("*.wav")}
        sortie = [(r[0], r[2], trouves[r[0]]) for r in refs if r[0] in trouves]
    return sortie[:limite] if limite else sortie


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int)
    ap.add_argument("--jeu", default="soreva", choices=["soreva", "cv"], help="soreva : 150 phrases, 1 voix ; cv : Common Voice wes test, 323 clips")
    ap.add_argument("--modeles", default="omni300,w2v_pidgin,whisper_small,omni1b")
    a = ap.parse_args()
    data = phrases(a.jeu, a.limite)
    if not data:
        raise SystemExit("aucun audio trouve (SOREVA : lancer download_stt.py ; cv : datasets/pidgin/common_voice_wes)")
    SORTIE.mkdir(parents=True, exist_ok=True)
    print(f"{len(data)} phrases {a.jeu} (pidgin camerounais)")
    for nom in a.modeles.split(","):
        try:
            run = charger(nom)
        except Exception as e:
            print(f"{nom:<14} indisponible ({type(e).__name__}: {str(e)[:100]})")
            continue
        erreurs_m = mots = erreurs_c = lettres = 0
        duree = audio = 0.0
        lignes = []
        for fichier, ref, chemin in data:
            x = lire_audio(chemin)
            t0 = time.time()
            hyp = run(x)
            duree += time.time() - t0
            audio += len(x) / 16000
            r, h = normaliser(ref), normaliser(hyp)
            erreurs_m += distance(r.split(), h.split())
            mots += len(r.split())
            erreurs_c += distance(r, h)
            lettres += len(r)
            lignes.append({"fichier": fichier, "ref": r, "hyp": h})
        (SORTIE / f"{nom}_{a.jeu}.jsonl").write_text("\n".join(json.dumps(l, ensure_ascii=False) for l in lignes), encoding="utf-8")
        print(f"{nom:<14} WER {100 * erreurs_m / mots:5.1f} %   CER {100 * erreurs_c / lettres:5.1f} %   vitesse x{audio / duree:.1f} le temps reel")


if __name__ == "__main__":
    main()
