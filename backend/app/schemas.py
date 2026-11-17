"""Contrat JSON entre l'extension et le serveur."""
from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, ConfigDict, Field

SourceLang = Literal["fr", "en"]
Element = Literal["text", "balance", "amount", "fee", "total", "confirm", "error", "warning"]
Badge = Literal["verified", "machine", "untranslated"]
Origin = Literal["memory", "near_memory", "model", "none"]
Intent = Literal[
    "ask_balance", "ask_fees", "ask_total", "what_to_do", "explain_error", "summarize_transactions", "repeat", "unknown"
]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TranslateRequest(Strict):
    text: str = Field(min_length=1, max_length=500, description="Texte DEJA masque : {x1}, {x2}... de gauche a droite.")
    source_lang: SourceLang
    target_lang: str = Field(min_length=2, max_length=8)
    element: Element = Field("text", description="Nature de l'element dans la page ; tout sauf 'text' est critique.")


class TranslateResponse(Strict):
    text: str | None = Field(description="Traduction avec ses {xN}, ou null : l'extension montre alors l'original.")
    badge: Badge = Field(description="verified = Verifie, machine = Traduction automatique, untranslated = Pas encore traduit")
    origin: Origin
    reason: str | None = Field(None, description="Motif technique quand badge vaut untranslated.")


class TtsRequest(Strict):
    text: str = Field(min_length=1, max_length=500, description="Texte en langue nationale, avec ses {xN}.")
    lang: str = Field(min_length=2, max_length=8)


class AudioSegment(Strict):
    type: Literal["audio"] = "audio"
    format: Literal["wav"] = "wav"
    data: str = Field(description="WAV encode en base64.")
    origin: Literal["recorded", "synthetic"] = Field(
        "synthetic", description="recorded = voix humaine validee ; synthetic = voix generee par le modele (a signaler comme automatique)."
    )


class SlotSegment(Strict):
    type: Literal["slot"] = "slot"
    name: str = Field(description="Ex. x1 : l'extension joue ici le nombre avec ses audios locaux.")


class TtsResponse(Strict):
    segments: list[Union[AudioSegment, SlotSegment]]


class IntentResponse(Strict):
    intent: Intent
    confidence: float = Field(ge=0, le=1)


class AskResponse(Strict):
    """Reponse de l'assistant : texte entendu (pidgin), intention si la grammaire fermee reconnait,
    sinon reponse pidgin. Une reponse critique reste en anglais et porte le badge `untranslated`.
    `answer` est null quand une reponse validee existante doit etre utilisee."""

    heard: str = Field(description="Texte pidgin entendu ; vide si la personne a dit un code ou un numero.")
    intent: Intent = "unknown"
    confidence: float = Field(0.0, ge=0, le=1)
    answer: str | None = Field(description="Reponse pidgin, ou anglaise si critique, avec ses {xN}; ou null.")
    badge: Literal["machine", "untranslated"] = Field("machine", description="Fiabilite de la reponse automatique.")
    reason: str = Field(description="intent, llm, guard_failed, sensitive_speech, engine_unavailable...")


class LanguageInfo(Strict):
    code: str
    name: str
    translation_from: list[str]
    asr: bool
    tts: bool


class Limits(Strict):
    max_text_chars: int
    max_audio_seconds: int
    audio_format: str


class Capabilities(Strict):
    api_version: str
    languages: list[LanguageInfo]
    limits: Limits
