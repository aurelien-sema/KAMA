"""Essai de bout en bout de « Parler à Kama » sur 10 extraits SOREVA locaux.

Usage (serveur déjà démarré) :
    python evaluation/tools/essai_parler.py --url http://127.0.0.1:8000 --pid <PID_DU_SERVEUR>
Options :
    --limite 10          nombre d'extraits
    --log chemin.log     journal du serveur, pour lire les durées par étape (stt/in/llm/out)
    --contexte ""        contexte de page masqué à envoyer (par défaut, la page de test)

Affiche, pour chaque extrait : le pidgin entendu, la réponse pidgin, la durée totale, puis les
durées par étape lues dans le journal. Le texte anglais intermédiaire N'EST PAS renvoyé par le
serveur (choix de confidentialité : rien de ce que dit la personne ne sort en clair) ; ce script
ne peut donc pas l'afficher.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

DEPOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(DEPOT / "backend"))
sys.path.insert(0, str(DEPOT / "evaluation"))

from stt_eval import lire_audio, phrases  # noqa: E402
from app.security.masking import mask  # noqa: E402


def contexte_masque() -> str:
    page = json.loads((DEPOT / "content-data" / "safinum_test_page.json").read_text(encoding="utf-8"))
    morceaux = [e.get("wes") for e in page["entries"] if isinstance(e.get("wes"), str)][:14]
    return mask("\n".join(morceaux)).text


def wav16k(chemin: Path) -> bytes:
    import numpy as np

    x = lire_audio(chemin)
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2").tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(pcm)
    return buf.getvalue()


def memoire_pic(pid: int | None) -> str:
    if not pid:
        return "?"
    try:
        if os.name == "nt":
            sortie = subprocess.run(
                ["wmic", "process", "where", f"processid={pid}", "get", "PeakWorkingSetSize", "/format:list"],
                capture_output=True, text=True, timeout=20,
            ).stdout
            m = re.search(r"PeakWorkingSetSize=(\d+)", sortie)
        else:
            statut = Path(f"/proc/{pid}/status").read_text(encoding="utf-8")
            m = re.search(r"VmHWM:\s+(\d+) kB", statut)
        return f"{int(m.group(1)) / 1024 / 1024:.2f} Go" if m else "?"
    except Exception:
        return "?"


def nouvelles_durees(log: Path, position: int) -> tuple[str, int]:
    if not log.exists():
        return "", position
    with log.open("r", encoding="utf-8", errors="replace") as f:
        f.seek(position)
        texte = f.read()
        position = f.tell()
    lignes = re.findall(r"ask stt=(\d+)ms(?: in=(\d+)ms)?(?: llm=(\d+)ms)?(?: out=(\d+)ms)?[^\n]*", texte)
    if not lignes:
        return "", position
    stt, entree, llm, sortie = lignes[-1]
    parties = [f"stt {stt} ms"]
    if entree:
        parties.append(f"wes>en {entree} ms")
    if llm:
        parties.append(f"llm {llm} ms")
    if sortie:
        parties.append(f"en>wes {sortie} ms")
    return " · ".join(parties), position


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--limite", type=int, default=10)
    ap.add_argument("--pid", type=int)
    ap.add_argument("--log", type=Path)
    ap.add_argument("--contexte", default=None)
    a = ap.parse_args()

    contexte = a.contexte if a.contexte is not None else contexte_masque()
    data = phrases("soreva", a.limite)
    if not data:
        raise SystemExit("aucun extrait SOREVA local (datasets/stt/soreva)")
    position = a.log.stat().st_size if a.log and a.log.exists() else 0
    total = 0.0
    print(f"{len(data)} extraits · contexte masqué de {len(contexte)} caractères · pic mémoire {memoire_pic(a.pid)}")
    print("(le texte anglais intermédiaire n'est pas renvoyé : confidentialité)\n")
    for i, (_, _, chemin) in enumerate(data, 1):
        corps = wav16k(chemin)
        requete = urllib.request.Request(
            f"{a.url}/v1/voice/ask",
            data=corps,
            method="POST",
            headers={"Content-Type": "audio/wav", "X-Kama-Lang": "wes", "X-Kama-Context-B64": __import__("base64").b64encode(contexte.encode()).decode()},
        )
        debut = time.perf_counter()
        try:
            with urllib.request.urlopen(requete, timeout=60) as r:
                corps_reponse = json.loads(r.read())
        except urllib.error.HTTPError as e:
            print(f"{i:2}. ERREUR HTTP {e.code} : {e.read().decode(errors='replace')[:200]}")
            continue
        duree = time.perf_counter() - debut
        total += duree
        etapes, position = nouvelles_durees(a.log, position) if a.log else ("", position)
        entendu = corps_reponse.get("heard") or "(non affiché : code ou numéro)"
        print(f"{i:2}. entendu : {entendu}")
        print(f"    réponse : {corps_reponse.get('answer')}")
        print(f"    {duree:.1f} s au total · {etapes or corps_reponse.get('reason')}")
    print(f"\nMoyenne : {total / max(1, len(data)):.1f} s · pic mémoire serveur : {memoire_pic(a.pid)}")


if __name__ == "__main__":
    main()
