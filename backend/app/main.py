"""Serveur intermediaire de Kama : sans etat, sans base de donnees, sans journal du contenu."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .errors import KamaError, error_body
import base64
import binascii

from .schemas import AssistantContext, AssistantRequest, AssistantResponse, Capabilities, IntentResponse, LanguageInfo, Limits, TranslateRequest, TranslateResponse, TtsRequest, TtsResponse
from .security.middleware import BodyLimit, ContentFreeLog, OriginGuard, RateLimit, SecurityHeaders
from .services import MAX_AUDIO_SECONDS, Services, build_services
from .settings import Settings, load_settings

log = logging.getLogger("kama")
API_VERSION = "1"


def _capabilities(services: Services) -> Capabilities:
    engines = services.engines
    languages = [
        LanguageInfo(
            code=code,
            name=name,
            translation_from=sorted(s for s in ("fr", "en") if f"{s}>{code}" in engines.translation),
            asr=code in engines.asr,
            tts=code in engines.tts or code in engines.clips,
        )
        for code, name in engines.languages.items()
    ]
    limits = Limits(max_text_chars=500, max_audio_seconds=MAX_AUDIO_SECONDS, audio_format="audio/wav; pcm16; 16000 Hz; mono")
    return Capabilities(api_version=API_VERSION, languages=languages, limits=limits)


def create_app(settings: Settings | None = None, services: Services | None = None) -> FastAPI:
    settings = settings or load_settings()
    services = services or build_services(settings)
    docs = {} if not settings.is_prod else {"docs_url": None, "redoc_url": None, "openapi_url": None}
    app = FastAPI(title="Kama backend", version=API_VERSION, **docs)

    # Le dernier ajoute est le plus externe : la requete passe dans l'ordre inverse.
    app.add_middleware(BodyLimit, settings=settings)
    app.add_middleware(RateLimit, settings=settings)
    app.add_middleware(OriginGuard, settings=settings)
    app.add_middleware(SecurityHeaders, settings=settings)
    app.add_middleware(ContentFreeLog)

    @app.exception_handler(KamaError)
    async def on_kama_error(_: Request, exc: KamaError):
        return JSONResponse(error_body(exc.code, exc.message), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def on_invalid(_: Request, exc: RequestValidationError):
        # Le gestionnaire par defaut recopie la valeur recue : on ne renvoie que les champs.
        fields = [".".join(str(p) for p in e["loc"]) for e in exc.errors()]
        return JSONResponse(error_body("invalid_request", "Requête invalide.", fields=fields), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def on_http(_: Request, exc: StarletteHTTPException):
        return JSONResponse(error_body("http_error", "Requête refusée."), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def on_crash(_: Request, exc: Exception):
        log.error("erreur interne (%s)", type(exc).__name__)  # ni message ni trace : ils peuvent citer le texte
        return JSONResponse(error_body("internal_error", "Erreur interne."), status_code=500)

    @app.get("/healthz", tags=["service"])
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/v1/capabilities", response_model=Capabilities, tags=["service"])
    async def capabilities() -> Capabilities:
        return _capabilities(services)

    @app.post("/v1/translate", response_model=TranslateResponse, response_model_exclude_none=False, tags=["langue"])
    async def translate(body: TranslateRequest) -> TranslateResponse:
        return await services.translation.translate(body)

    @app.post("/v1/tts", response_model=TtsResponse, tags=["voix"])
    async def tts(body: TtsRequest) -> TtsResponse:
        return await services.speech.synthesize(body.text, body.lang)

    @app.post(
        "/v1/voice/intent",
        response_model=IntentResponse,
        response_model_exclude_none=True,  # « answer » n'apparaît que si l'assistant a répondu
        tags=["voix"],
        openapi_extra={
            "requestBody": {"required": True, "content": {"audio/wav": {"schema": {"type": "string", "format": "binary"}}}}
        },
    )
    async def voice_intent(
        request: Request,
        x_kama_lang: str = Header(min_length=2, max_length=8),
        x_kama_context: str | None = Header(None, max_length=6000, description="Contexte de l'ecran (JSON masque, base64url), pour l'assistant."),
    ) -> IntentResponse:
        content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type != "audio/wav":
            raise KamaError(415, "invalid_audio", "Format attendu : WAV PCM 16 bits, 16 kHz, mono.")
        context = None
        if x_kama_context:
            try:
                context = AssistantContext.model_validate_json(base64.urlsafe_b64decode(x_kama_context + "=" * (-len(x_kama_context) % 4)))
            except (binascii.Error, ValueError):
                raise KamaError(422, "invalid_request", "Contexte illisible.") from None
        return await services.speech.voice_intent(await request.body(), x_kama_lang, context)

    @app.post("/v1/assistant", response_model=AssistantResponse, tags=["assistant"])
    async def assistant(body: AssistantRequest) -> AssistantResponse:
        """Question ecrite (deja masquee) : reponse courte de l'assistant, avec les seules balises de l'ecran."""
        return await services.assistant.answer(body.text, body.lang, body.context)

    return app
