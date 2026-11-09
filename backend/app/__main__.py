"""Lancement local : python -m app"""
import logging
import os

import uvicorn

from .main import create_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

uvicorn.run(
    create_app(),
    host=os.environ.get("KAMA_HOST", "127.0.0.1"),
    port=int(os.environ.get("KAMA_PORT", "8000")),
    access_log=False,  # le journal d'uvicorn est remplace par ContentFreeLog
    server_header=False,
    date_header=False,
)
