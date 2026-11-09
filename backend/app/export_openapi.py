"""Ecrit le contrat d'API lu par l'extension : python -m app.export_openapi"""
import json
from dataclasses import replace

from .engines import EngineSet
from .main import create_app
from .services import build_services
from .settings import BACKEND_DIR, Settings

settings = Settings()
app = create_app(settings, build_services(replace(settings), EngineSet(languages={"bbj": "Ghomálá'"})))
target = BACKEND_DIR / "contracts" / "openapi.json"
target.write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(target)
