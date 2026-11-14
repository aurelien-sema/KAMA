"""Configuration lue dans les variables d'environnement KAMA_*."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


def _bool(name: str, default: bool) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


@dataclass(frozen=True)
class Settings:
    env: str = "dev"
    allowed_origins: frozenset[str] = frozenset()
    allow_firefox: bool = False
    trust_proxy: bool = False
    rate_per_min: int = 60
    voice_rate_per_min: int = 12
    ask_rate_per_min: int = 6  # questions au LLM local : plus couteuses
    global_rate_per_min: int = 1200
    max_json_bytes: int = 4096
    max_audio_bytes: int = 960_100  # 30 s en PCM 16 bits, 16 kHz, mono, plus l'en-tete WAV
    max_concurrent_models: int = 2
    near_match_threshold: float = 0.86
    mt_allow_critical: bool = False
    models_dir: Path = REPO_DIR / "models"  # monte en lecture seule sur /models par docker-compose
    content_dir: Path = REPO_DIR / "content-data"
    routes_file: Path = BACKEND_DIR / "config" / "routes.json"
    clips_dir: Path | None = None  # enregistrements valides ; par defaut models_dir/poids/audio

    @property
    def clips_path(self) -> Path:
        return self.clips_dir or self.models_dir / "poids" / "audio"

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"

    def origin_allowed(self, origin: str | None) -> bool:
        if origin is None:
            return not self.is_prod  # curl et les tests locaux n'envoient pas d'origine
        if origin in self.allowed_origins:
            return True
        if self.allow_firefox and origin.startswith("moz-extension://"):
            return True  # Firefox attribue un identifiant different a chaque installation
        if not self.is_prod and not self.allowed_origins:
            return origin.startswith(("chrome-extension://", "moz-extension://"))
        return False


def load_settings() -> Settings:
    d = Settings()
    origins = os.environ.get("KAMA_ALLOWED_ORIGINS", "")
    settings = Settings(
        env=os.environ.get("KAMA_ENV", d.env),
        allowed_origins=frozenset(o.strip() for o in origins.split(",") if o.strip()),
        allow_firefox=_bool("KAMA_ALLOW_FIREFOX", d.allow_firefox),
        trust_proxy=_bool("KAMA_TRUST_PROXY", d.trust_proxy),
        rate_per_min=_int("KAMA_RATE_PER_MIN", d.rate_per_min),
        voice_rate_per_min=_int("KAMA_VOICE_RATE_PER_MIN", d.voice_rate_per_min),
        ask_rate_per_min=_int("KAMA_ASK_RATE_PER_MIN", d.ask_rate_per_min),
        global_rate_per_min=_int("KAMA_GLOBAL_RATE_PER_MIN", d.global_rate_per_min),
        max_concurrent_models=_int("KAMA_MAX_CONCURRENT_MODELS", d.max_concurrent_models),
        near_match_threshold=float(os.environ.get("KAMA_NEAR_MATCH_THRESHOLD", d.near_match_threshold)),
        mt_allow_critical=_bool("KAMA_MT_ALLOW_CRITICAL", d.mt_allow_critical),
        models_dir=Path(os.environ.get("KAMA_MODELS_DIR", d.models_dir)),
        content_dir=Path(os.environ.get("KAMA_CONTENT_DIR", d.content_dir)),
        routes_file=Path(os.environ.get("KAMA_ROUTES_FILE", d.routes_file)),
        clips_dir=Path(os.environ["KAMA_CLIPS_DIR"]) if os.environ.get("KAMA_CLIPS_DIR") else None,
    )
    if settings.is_prod and not settings.allowed_origins and not settings.allow_firefox:
        raise RuntimeError("KAMA_ALLOWED_ORIGINS est obligatoire en production.")
    return settings
