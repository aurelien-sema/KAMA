"""Essai de bout en bout de la traduction pidgin du serveur, routes activees le temps de l'essai.

Usage : python backend/scripts/essai_pidgin.py   (depuis la racine du depot, avec ctranslate2)
N'utilise que des donnees fictives. Ne modifie pas config/routes.json.
"""
import asyncio
import json
import sys
import tempfile
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.schemas import TranslateRequest  # noqa: E402
from app.security.masking import mask  # noqa: E402
from app.services import build_services  # noqa: E402
from app.settings import Settings  # noqa: E402

PHRASES = [
    ("fr", "Bienvenue sur notre nouvelle application.", "text"),
    ("en", "Our branches will be closed on Friday.", "text"),
    ("fr", "Nos agences seront fermées vendredi.", "text"),
    ("en", "Save time: pay with your phone.", "text"),
    ("fr", "Votre paiement de 12 000 FCFA a été accepté.", "text"),
    ("fr", "Frais", "fee"),
    ("en", "Your session has expired. Please log in again.", "text"),
]


def main():
    config = json.loads((BACKEND / "config" / "routes.json").read_text(encoding="utf-8"))
    for name in ("fr>en", "en>wes_modele", "en>wes", "fr>wes"):
        config["translation"][name]["enabled"] = True
    with tempfile.TemporaryDirectory() as tmp:
        routes = Path(tmp) / "routes.json"
        routes.write_text(json.dumps(config), encoding="utf-8")
        services = build_services(Settings(routes_file=routes))
        print("routes chargees :", sorted(services.engines.translation))

        async def run():
            for lang, text, element in PHRASES:
                masked = mask(text)
                t0 = time.perf_counter()
                r = await services.translation.translate(TranslateRequest(text=masked.text, source_lang=lang, target_lang="wes", element=element))
                print(f"[{lang}] {text} -> {r.badge} {r.reason or ''} | {r.text} ({time.perf_counter() - t0:.1f} s)")

        asyncio.run(run())


if __name__ == "__main__":
    main()
