"""Middlewares ASGI : origine, debit, taille des requetes, en-tetes, journal sans contenu."""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import time
from collections import deque

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse, Response

from ..errors import error_body
from ..settings import Settings

log = logging.getLogger("kama.access")

VOICE_PATH = "/v1/voice/intent"
KNOWN_PATHS = frozenset({"/healthz", "/v1/capabilities", "/v1/translate", "/v1/tts", VOICE_PATH, "/docs", "/openapi.json"})
PUBLIC_PATHS = frozenset({"/healthz"})


def _reject(status: int, code: str, message: str, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(error_body(code, message), status_code=status, headers=headers)


class NoTraceback(logging.Filter):
    """Retire la trace des exceptions : son message peut citer le texte traite."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.exc_info = None
        record.exc_text = None
        record.stack_info = None
        return True


class ContentFreeLog:
    """Journalise uniquement methode, route connue, statut et duree."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        start = time.perf_counter()
        status = {"code": 500}

        async def capture(message):
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, capture)
        finally:
            path = scope["path"] if scope["path"] in KNOWN_PATHS else "(autre)"
            log.info("%s %s %s %.0fms", scope["method"], path, status["code"], (time.perf_counter() - start) * 1000)


class SecurityHeaders:
    def __init__(self, app, settings: Settings) -> None:
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def add(message):
            if message["type"] == "http.response.start":
                h = MutableHeaders(scope=message)
                h["cache-control"] = "no-store"
                h["x-content-type-options"] = "nosniff"
                h["referrer-policy"] = "no-referrer"
                if self.settings.is_prod:
                    h["strict-transport-security"] = "max-age=31536000"
            await send(message)

        await self.app(scope, receive, add)


class OriginGuard:
    """N'accepte que l'extension. C'est un filtre, pas une authentification."""

    def __init__(self, app, settings: Settings) -> None:
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] in PUBLIC_PATHS:
            return await self.app(scope, receive, send)
        origin = Headers(scope=scope).get("origin")
        if not self.settings.origin_allowed(origin):
            return await _reject(403, "forbidden_origin", "Origine non autorisée.")(scope, receive, send)
        cors = {}
        if origin:
            cors = {"access-control-allow-origin": origin, "vary": "Origin"}
        if scope["method"] == "OPTIONS":
            headers = {
                **cors,
                "access-control-allow-methods": "GET, POST",
                "access-control-allow-headers": "Content-Type, X-Kama-Lang",
                "access-control-max-age": "600",
            }
            return await Response(status_code=204, headers=headers)(scope, receive, send)

        async def add(message):
            if message["type"] == "http.response.start":
                h = MutableHeaders(scope=message)
                for k, v in cors.items():
                    h[k] = v
            await send(message)

        await self.app(scope, receive, add)


class RateLimit:
    """Fenetre glissante d'une minute, en memoire uniquement.

    L'adresse IP n'est jamais conservee en clair : elle est remplacee par un HMAC dont
    la cle est tiree au demarrage et disparait a l'arret du processus.
    """

    def __init__(self, app, settings: Settings) -> None:
        self.app, self.settings = app, settings
        self.salt = secrets.token_bytes(32)
        self.hits: dict[str, deque[float]] = {}
        self.global_hits: deque[float] = deque()
        self.last_sweep = 0.0

    def _client(self, scope) -> str:
        host = (scope.get("client") or ("inconnu", 0))[0]
        if self.settings.trust_proxy:
            forwarded = Headers(scope=scope).get("x-forwarded-for")
            if forwarded:
                host = forwarded.split(",")[-1].strip()
        return hmac.new(self.salt, host.encode(), hashlib.sha256).hexdigest()

    @staticmethod
    def _prune(window: deque[float], now: float) -> None:
        while window and now - window[0] >= 60:
            window.popleft()

    def _sweep(self, now: float) -> None:
        if now - self.last_sweep < 60:
            return
        self.last_sweep = now
        for key in list(self.hits):
            self._prune(self.hits[key], now)
            if not self.hits[key]:
                del self.hits[key]

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] in PUBLIC_PATHS or scope["method"] == "OPTIONS":
            return await self.app(scope, receive, send)
        now = time.monotonic()
        self._sweep(now)
        voice = scope["path"] == VOICE_PATH
        limit = self.settings.voice_rate_per_min if voice else self.settings.rate_per_min
        window = self.hits.setdefault(("v:" if voice else "t:") + self._client(scope), deque())
        self._prune(window, now)
        self._prune(self.global_hits, now)
        if len(window) >= limit or len(self.global_hits) >= self.settings.global_rate_per_min:
            response = _reject(429, "rate_limited", "Trop de requêtes. Réessayez dans un instant.", {"retry-after": "60"})
            return await response(scope, receive, send)
        window.append(now)
        self.global_hits.append(now)
        await self.app(scope, receive, send)


class BodyLimit:
    """Lit le corps en memoire, jamais sur disque, et coupe au-dela de la limite."""

    def __init__(self, app, settings: Settings) -> None:
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST":
            return await self.app(scope, receive, send)
        limit = self.settings.max_audio_bytes if scope["path"] == VOICE_PATH else self.settings.max_json_bytes
        too_large = _reject(413, "payload_too_large", "Requête trop volumineuse.")
        declared = Headers(scope=scope).get("content-length")
        if declared and (not (declared.isascii() and declared.isdigit()) or int(declared) > limit):
            return await too_large(scope, receive, send)
        chunks: list[bytes] = []
        total = 0
        more = True
        while more:
            message = await receive()
            if message["type"] == "http.disconnect":
                return None
            chunk = message.get("body", b"")
            total += len(chunk)
            if total > limit:
                return await too_large(scope, receive, send)
            chunks.append(chunk)
            more = message.get("more_body", False)
        body = b"".join(chunks)
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
