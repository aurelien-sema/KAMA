"""Aller-retour des commandes vocales : phrase d'intention -> voix de synthese -> reconnaissance -> intention retrouvee ?

Usage (depuis KAMA/backend) : PYTHONPATH=. .venv/Scripts/python.exe ../evaluation/intent_synthese.py
LIMITE : la voix est synthetique et propre, donc l'essai est plus facile qu'une vraie personne dans une rue bruyante.
Il montre seulement que la chaine (voix -> reconnaissance -> correspondance approchee) fonctionne, et quelles phrases sont fragiles.
Il verifie aussi que chaque commande ne declenche QUE son intention.
"""
import asyncio
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from tts_inedit import pcm_de, services_voix  # noqa: E402

DEPOT = HERE.parent
sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)


async def main():
    services = services_voix()
    reco = services.engines.asr.get("wes")
    if reco is None or "wes" not in services.engines.tts:
        raise SystemExit("voix ou reconnaissance non chargee")
    import base64

    intents = json.loads((DEPOT / "content-data" / "intents.json").read_text(encoding="utf-8"))["intents"]
    total = bons = 0
    for intent, par_langue in intents.items():
        for phrase in par_langue.get("wes", []):
            r = await services.speech.synthesize(phrase, "wes")
            audio = b"".join(pcm_de(base64.b64decode(s.data))[0] for s in r.segments if s.type == "audio")
            entendu = reco.transcribe(audio)
            trouve = services.speech.intents.match(entendu, "wes")
            total += 1
            bons += trouve.intent == intent
            marque = "ok " if trouve.intent == intent else "XX "
            print(f"{marque}{intent:<24} dit {phrase!r:<38} entendu {entendu!r:<40} -> {trouve.intent} ({trouve.confidence})")
    print(f"\n{bons}/{total} commandes retrouvees apres voix de synthese + reconnaissance")


if __name__ == "__main__":
    asyncio.run(main())
