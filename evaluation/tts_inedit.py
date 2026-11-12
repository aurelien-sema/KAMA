"""Teste la voix pidgin sur du contenu INEDIT, par la vraie route /v1/tts du serveur.

Usage (depuis KAMA/backend, avec requirements-voice.txt installe) :
    .venv/Scripts/python.exe ../evaluation/tts_inedit.py [--soreva 40]

Ce que fait le script, pour chaque phrase :
  1. la fait dire par le service de parole (enregistrement valide s'il existe, sinon modele MMS) ;
  2. relit l'audio avec la reconnaissance vocale (Omnilingual) : l'ecart entre le texte voulu et le texte entendu
     (CER, en %) mesure si la voix est comprehensible, sans oreille humaine ;
  3. ecrit evaluation/tts_inedit/index.html (ecoute) et notes.csv (a remplir par un locuteur).
Les phrases : training/pidgin/tts_inedit.json (banque, inedites) et quelques phrases SOREVA (vie courante).
Un montant ou un nom ({xN}) est rendu par un bip : dans Kama, ce sont des extraits enregistres.
"""
import argparse
import asyncio
import base64
import csv
import html
import io
import json
import math
import re
import sys
import tempfile
import time
import wave
from pathlib import Path

import numpy as np

DEPOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPOT / "backend"))
from app.clips import SAMPLE_RATE, split_pieces  # noqa: E402
from app.settings import Settings  # noqa: E402

SORTIE = Path(__file__).resolve().parent / "tts_inedit"
CAS = DEPOT / "training" / "pidgin" / "tts_inedit.json"
SOREVA = DEPOT.parent / "datasets" / "soreva" / "pcm_cm.test.tsv"
sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)


def normaliser(t: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w' ]+", " ", t.lower())).strip()


def distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def pcm_de(wav: bytes):
    with wave.open(io.BytesIO(wav)) as w:
        return w.readframes(w.getnframes()), w.getframerate()


def bip() -> bytes:
    n = int(0.25 * SAMPLE_RATE)
    return (np.array([0.25 * math.sin(2 * math.pi * 880 * i / SAMPLE_RATE) for i in range(n)]) * 32767).astype("<i2").tobytes()


def ecrire(chemin: Path, pcm: bytes) -> None:
    with wave.open(str(chemin), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)


def services_voix():
    from app.services import build_services

    config = json.loads((DEPOT / "backend" / "config" / "routes.json").read_text(encoding="utf-8"))
    config["tts"]["wes"]["enabled"] = True  # activation locale pour l'essai ; routes.json du depot reste inchange
    config["asr"]["wes"]["enabled"] = True
    tmp = Path(tempfile.mkdtemp()) / "routes.json"
    tmp.write_text(json.dumps(config), encoding="utf-8")
    return build_services(Settings(routes_file=tmp))


async def essai(services, ident: str, texte: str):
    t0 = time.time()
    r = await services.speech.synthesize(texte, "wes")
    dt = time.time() - t0
    pieces, audio, pcm, origines, entendu = split_pieces(texte), [], b"", [], []
    reco = services.engines.asr.get("wes")
    n = 0
    for s in r.segments:
        if s.type == "slot":
            pcm += bip()
            continue
        morceau, taux = pcm_de(base64.b64decode(s.data))
        pcm += morceau
        origines.append(s.origin)
        audio.append(len(morceau) / 2 / taux)
        if reco is not None and s.origin == "synthetic":
            entendu.append(reco.transcribe(morceau))  # la reconnaissance entend uniquement la voix generee
        n += 1
    voulu = " ".join(p for p, o in zip(pieces, origines) if o == "synthetic")
    heard = " ".join(entendu)
    cer = None
    if voulu and reco is not None:
        v, h = normaliser(voulu), normaliser(heard)
        cer = 100 * distance(v, h) / max(len(v), 1)
    return {"id": ident, "texte": texte, "origines": origines, "duree": sum(audio), "calcul": dt, "voulu": voulu,
            "entendu": heard, "cer": cer, "pcm": pcm}


async def main_async(a):
    services = services_voix()
    if "wes" not in services.engines.tts:
        raise SystemExit("moteur de synthese non charge : installer requirements-voice.txt et verifier models/poids/tts/mms-tts-pcm")
    if "wes" not in services.engines.asr:
        print("ATTENTION : reconnaissance vocale absente, pas de mesure aller-retour")
    cas = json.loads(CAS.read_text(encoding="utf-8"))
    items = [(c["id"], c["texte"], c["usage"]) for c in cas["cas"]]
    items += [(f"controle_{i + 1}", t, "controle catalogue") for i, t in enumerate(cas["controle_catalogue"])]
    if a.soreva and SOREVA.exists():
        lignes = [l.split("\t") for l in SOREVA.read_text(encoding="utf-8").splitlines() if l.count("\t") >= 2]
        items += [(f"soreva_{l[0][-7:-4]}", l[1].strip(), "vie courante (SOREVA)") for l in lignes[: a.soreva]]
    SORTIE.mkdir(exist_ok=True)
    resultats = []
    for ident, texte, usage in items:
        try:
            r = await essai(services, ident, texte)
        except Exception as e:
            print(f"{ident}: ECHEC {type(e).__name__} {str(e)[:80]}")
            continue
        r["usage"] = usage
        ecrire(SORTIE / f"{ident}.wav", r["pcm"])
        resultats.append(r)
        print(f"{ident:<14} {','.join(sorted(set(r['origines']))) or '-':<10} {r['duree']:5.1f} s d'audio en {r['calcul']:5.1f} s   CER {('%.0f %%' % r['cer']) if r['cer'] is not None else '-'}")
    return resultats


def rapport(resultats):
    modele = [r for r in resultats if "synthetic" in r["origines"] and r["cer"] is not None]
    audio = sum(r["duree"] for r in modele)
    calcul = sum(r["calcul"] for r in modele)
    cers = [r["cer"] for r in modele]
    inedites = [r for r in resultats if r["usage"] not in ("controle catalogue",)]
    print("\n=== Resume ===")
    print(f"{len(resultats)} phrases dont {len(inedites)} inedites ; {len(modele)} dites par le modele")
    if cers:
        print(f"CER aller-retour (voix de synthese relue par Omnilingual) : moyenne {np.mean(cers):.0f} %, mediane {np.median(cers):.0f} %, "
              f"{sum(c > 50 for c in cers)} phrase(s) au-dessus de 50 %")
    if audio:
        print(f"Vitesse : {audio:.0f} s d'audio generees en {calcul:.0f} s (facteur {calcul / audio:.2f}, plus petit = plus rapide)")
    for r in resultats:
        if r["usage"] == "controle catalogue":
            print(f"Controle catalogue {r['texte']!r} -> {r['origines']} (attendu : clip valide servi sans calcul, en {r['calcul']:.1f} s ; l'origine reste 'synthetic' car ces clips ont ete generes par MMS)")
    with open(SORTIE / "notes.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["id", "usage", "texte", "fichier", "origine", "entendu par la machine", "CER %", "comprehensible (oui/non)", "naturel (1-5)", "remarque"])
        for r in resultats:
            w.writerow([r["id"], r["usage"], r["texte"], f"{r['id']}.wav", "+".join(sorted(set(r["origines"]))), r["entendu"],
                        "" if r["cer"] is None else round(r["cer"]), "", "", ""])
    lignes = "".join(
        f"<tr><td>{html.escape(r['id'])}</td><td>{html.escape(r['usage'])}</td><td>{html.escape(r['texte'])}</td>"
        f"<td><audio controls preload=none src='{r['id']}.wav'></audio></td><td>{html.escape('+'.join(sorted(set(r['origines']))))}</td>"
        f"<td>{html.escape(r['entendu'])}</td><td>{'' if r['cer'] is None else round(r['cer'])}</td></tr>"
        for r in resultats
    )
    (SORTIE / "index.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Voix pidgin - contenu inedit</title>"
        "<style>body{font-family:sans-serif;margin:16px}td{border-bottom:1px solid #ccc;padding:6px;vertical-align:middle}</style>"
        "<h1>Voix pidgin sur du contenu inedit</h1><p>Voix MMS-TTS pcm (pidgin nigerian), sans ajustement. Textes : propositions non validees. "
        "Un bip remplace un montant ou un nom. La colonne &laquo;entendu&raquo; est ce que la reconnaissance vocale a compris : "
        "plus elle ressemble au texte, plus la voix est nette.</p>"
        f"<table><tr><th>id</th><th>usage</th><th>texte</th><th>audio</th><th>origine</th><th>entendu</th><th>CER %</th></tr>{lignes}</table>",
        encoding="utf-8",
    )
    print(f"\nEcoute : {SORTIE / 'index.html'}\nNotes  : {SORTIE / 'notes.csv'}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--soreva", type=int, default=40, help="nombre de phrases SOREVA (vie courante) a ajouter")
    a = ap.parse_args()
    rapport(asyncio.run(main_async(a)))


if __name__ == "__main__":
    main()
