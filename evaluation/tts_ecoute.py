"""Premiere ecoute de MMS-TTS pcm (pidgin nigerian) sur les phrases pidgin de la page de test.

Les textes pidgin du catalogue sont des brouillons non valides : on juge ici la voix, pas la traduction.
Un {xN} (montant, nom) devient un bip : dans Kama, ces valeurs sont lues par des extraits enregistres.
Sortie : evaluation/tts_ecoute/ (WAV, index.html pour ecouter, notes.csv pour noter).
"""
import csv
import html
import json
import math
import os
import re
import struct
import sys
import time
import wave

import torch
from transformers import AutoTokenizer, VitsModel

HERE = os.path.dirname(os.path.abspath(__file__))
DEPOT = os.path.dirname(HERE)
MODEL = os.path.join(DEPOT, "models", "poids", "tts", "mms-tts-pcm")
PAGE = os.path.join(DEPOT, "content-data", "safinum_test_page.json")
OUT = os.path.join(HERE, "tts_ecoute")
sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

SLOT = re.compile(r"(\{x\d+\})")
PAUSE = {".": 0.35, "!": 0.35, "?": 0.35, ":": 0.3, ";": 0.3, ",": 0.15}


def main():
    os.makedirs(OUT, exist_ok=True)
    tok = AutoTokenizer.from_pretrained(MODEL)
    model = VitsModel.from_pretrained(MODEL).eval()
    rate = model.config.sampling_rate
    allowed = set(json.load(open(os.path.join(MODEL, "vocab.json"), encoding="utf-8")))
    torch.manual_seed(0)

    def silence(sec):
        return torch.zeros(int(rate * sec))

    def bip():
        n = int(rate * 0.25)
        return torch.tensor([0.25 * math.sin(2 * math.pi * 880 * i / rate) for i in range(n)])

    def speak(text):
        clean = "".join(c if c in allowed else " " for c in text.lower())
        clean = re.sub(r"\s+", " ", clean).strip()
        if not clean:
            return None
        with torch.inference_mode():
            return model(**tok(clean, return_tensors="pt")).waveform[0]

    def render(text):
        parts, chars = [], 0
        for piece in SLOT.split(text):
            if SLOT.fullmatch(piece):
                parts += [silence(0.1), bip(), silence(0.1)]
                continue
            # la ponctuation n'existe pas pour le modele : on la remplace par des pauses
            for chunk, mark in re.findall(r"([^.!?:;,]+)([.!?:;,]?)", piece):
                audio = speak(chunk)
                if audio is not None:
                    parts.append(audio)
                    chars += len(chunk)
                if mark:
                    parts.append(silence(PAUSE[mark]))
        return (torch.cat(parts) if parts else silence(0.2)), chars

    page = json.load(open(PAGE, encoding="utf-8"))
    items = [(e["id"], e["fr"], e["wes"]) for e in page["entries"] if e.get("wes")]
    items += [(p["id"], p["fr"], p["wes"]) for p in page["patterns"] if p.get("wes")]

    rows, total_audio, total_time = [], 0.0, 0.0
    for ident, fr, wes in items:
        t0 = time.time()
        audio, _ = render(wes)
        dt = time.time() - t0
        sec = len(audio) / rate
        total_audio, total_time = total_audio + sec, total_time + dt
        pcm = (audio.clamp(-1, 1) * 32767).short().tolist()
        name = f"{ident}.wav"
        with wave.open(os.path.join(OUT, name), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(struct.pack(f"<{len(pcm)}h", *pcm))
        rows.append((ident, fr if isinstance(fr, str) else fr[0], wes, name, sec, dt))
        print(f"{ident}: {sec:.1f} s d'audio en {dt:.2f} s")

    with open(os.path.join(OUT, "notes.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["id", "francais", "pidgin (brouillon)", "fichier", "comprehensible (oui/non)", "naturel (1-5)", "remarque"])
        for ident, fr, wes, name, _, _ in rows:
            w.writerow([ident, fr, wes, name, "", "", ""])

    lines = "".join(
        f"<tr><td>{html.escape(i)}</td><td>{html.escape(fr)}</td><td>{html.escape(wes)}</td>"
        f"<td><audio controls preload=none src='{n}'></audio></td></tr>"
        for i, fr, wes, n, _, _ in rows
    )
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
        f.write(
            "<!doctype html><meta charset=utf-8><title>Ecoute MMS pcm</title>"
            "<style>body{font-family:sans-serif;margin:16px}td{border-bottom:1px solid #ccc;padding:6px;vertical-align:middle}</style>"
            "<h1>Ecoute MMS-TTS pcm</h1><p>Voix : pidgin nigerian, sans ajustement. Textes pidgin : brouillons non valides. "
            "Le bip remplace un montant ou un nom.</p>"
            f"<table><tr><th>id</th><th>Francais</th><th>Pidgin</th><th>Audio</th></tr>{lines}</table>"
        )
    print(f"TERMINE : {len(rows)} phrases, {total_audio:.0f} s d'audio en {total_time:.0f} s "
          f"(facteur temps reel {total_time / total_audio:.2f} sur ce CPU)")


if __name__ == "__main__":
    main()
