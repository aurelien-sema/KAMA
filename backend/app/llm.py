"""Assistant conversationnel de Kama : un LLM local (llama.cpp) qui comprend une question et rédige une réponse courte.

Contrat : backend/contracts/proposition-contrat-llm.md (v0.2) ; règles : documentation/CLARIFICATIONS.md, « Rôle du LLM ».
- Mesure de sécurité (décision du 2026-11-14) : le LLM ne reçoit AUCUN montant. La question est masquée (montants,
  numéros, noms → {xN}) et l'écran n'est décrit que par ses libellés. Il explique le SENS ; les montants exacts viennent
  toujours des pastilles et des intentions, qui lisent la bonne ligne de la page.
- Toute sortie avec un chiffre, une balise, un calcul ou vide devient « unknown » (jamais réparée en devinant).
- Retour vers la langue nationale : réponse non critique traduite (badge « Traduction automatique »),
  réponse critique laissée en anglais (badge « Pas encore traduit »).
- Le pidgin est envoyé tel quel au LLM (décision du 2026-11-14).
Mesure du modèle : evaluation/llm/evaluer.py (36/48 avec LFM3-1.7B, aucun chiffre ni balise inventés).
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import urllib.request

from .errors import KamaError
from .schemas import AssistantContext, AssistantResponse, TranslateRequest
from .security.guards import is_critical
from .security.masking import SLOT_RE, is_masked

log = logging.getLogger("kama.llm")

MAX_ANSWER_CHARS = 300
TAG_ONLY = re.compile(r"\{x\d+\}")
# Calcul déguisé (règle d'or n° 1 : Kama ne calcule rien, même avec des balises) et sorties hésitantes.
CALCUL = re.compile(r"\{x\d+\}\s*\(?\s*[=+\-−×*/]|[=+\-−×*/]\s*\(?\s*\{x\d+\}|=", re.I)
MOTS_INTERDITS = re.compile(r"\b(minus|difference|subtract\w*|missing amount|remaining amount|add(?:ed)? up|sum of|wait|actually)\b", re.I)
BALISE_MAL_FORMEE = re.compile(r"\{(?!x\d+\})[^}]*\}")

SYSTEM = """You are the understanding module of Kama, an assistant that explains an online banking page to people who read French or English with difficulty.
You receive a JSON request and reply with ONE JSON object, nothing else.
Rules (never break them):
- You never see amounts. Never write a digit, an amount, a tag like {x1}, a name or a phone number.
- Never compute anything (no sum, no difference, no missing amount) and never write a formula.
- Explain the meaning of things on the page. If the user wants an exact amount, tell them to touch the Kama badge next to that line to hear it.
- Never act for the user: you do not click, confirm, send or fill anything. Never advise a financial decision (whether to send money or not).
- If the request is off-topic, ambiguous, or you are not sure, answer {"kind": "unknown"}.
Task "answer": answer the question in 1 to 3 short, simple English sentences, using only the page context.
The user may write in French, English or Cameroonian Pidgin."""

SCHEMA = {
    "anyOf": [
        {"type": "object", "properties": {"kind": {"const": "unknown"}}, "required": ["kind"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"kind": {"const": "answer"}, "text": {"type": "string", "maxLength": MAX_ANSWER_CHARS}},
            "required": ["kind", "text"],
            "additionalProperties": False,
        },
    ]
}


class LlamaCppClient:
    """Serveur llama.cpp local (API compatible OpenAI). Aucun service externe : la question ne quitte pas le serveur Kama."""

    def __init__(self, url: str, timeout: float = 40.0) -> None:
        self.url, self.timeout = url.rstrip("/"), timeout

    def complete(self, request: dict) -> str:
        body = {
            "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": json.dumps(request, ensure_ascii=False)}],
            "temperature": 0,
            "max_tokens": 200,
            "response_format": {"type": "json_schema", "json_schema": {"schema": SCHEMA}},
            "cache_prompt": True,
            "id_slot": 0,
        }
        req = urllib.request.Request(
            f"{self.url}/v1/chat/completions", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as r:
            return json.loads(r.read())["choices"][0]["message"]["content"]


def answer_problem(text: str, allowed: set[str]) -> str | None:
    """Motif de rejet d'une réponse du LLM, ou None si elle peut être montrée."""
    if not text.strip():
        return "empty"
    if len(text) > MAX_ANSWER_CHARS:
        return "too_long"
    if re.search(r"\d", SLOT_RE.sub("", text)):
        return "invented_number"
    if not {t[1:-1] for t in SLOT_RE.findall(text)} <= allowed or BALISE_MAL_FORMEE.search(text):
        return "unknown_tag"
    if CALCUL.search(text) or MOTS_INTERDITS.search(text):
        return "computation"
    return None


UNKNOWN = AssistantResponse(kind="unknown", text=None, badge="untranslated", text_lang=None)


class AssistantService:
    def __init__(self, client, translation, gate: asyncio.Semaphore, languages: dict[str, str]) -> None:
        self.client, self.translation, self.gate, self.languages = client, translation, gate, languages

    @property
    def available(self) -> bool:
        return self.client is not None

    async def answer(self, question: str, lang: str, context: AssistantContext) -> AssistantResponse:
        if lang not in self.languages:
            raise KamaError(400, "unsupported_language", "Cette langue n'est pas disponible.")
        # Défense en profondeur : rien de non masqué n'atteint le LLM.
        if not is_masked(question) or any(not is_masked(e.label) for e in context.elements):
            raise KamaError(422, "unmasked_content", "Le texte contient encore des données à masquer.")
        if self.client is None:
            raise KamaError(503, "llm_unavailable", "L'assistant n'est pas disponible.")
        if self.gate.locked():
            raise KamaError(503, "busy", "Le service est occupé. Réessayez dans un instant.")
        request = {"task": "answer", "text": question, "context": context.model_dump(exclude_none=True)}
        async with self.gate:
            try:
                raw = await asyncio.to_thread(self.client.complete, request)
                out = json.loads(raw)
            except Exception as exc:  # panne, délai, JSON illisible : ni message ni contenu journalisés
                log.warning("assistant en echec (%s)", type(exc).__name__)
                return UNKNOWN
        if out.get("kind") != "answer":
            return UNKNOWN
        text = str(out.get("text") or "").strip()
        if answer_problem(text, allowed=set()):  # aucune balise permise : le LLM ne cite jamais de montant
            return UNKNOWN
        return await self._to_user_language(text, lang)

    async def _to_user_language(self, english: str, lang: str) -> AssistantResponse:
        """Texte critique : reste en anglais (règle d'or n° 4). Sinon : traduction automatique, si elle passe ses contrôles."""
        if is_critical(english):
            return AssistantResponse(kind="answer", text=english, badge="untranslated", text_lang="en")
        tr = await self.translation.translate(TranslateRequest(text=english, source_lang="en", target_lang=lang, element="text"))
        if tr.text:
            return AssistantResponse(kind="answer", text=tr.text, badge=tr.badge, text_lang=lang)
        return AssistantResponse(kind="answer", text=english, badge="untranslated", text_lang="en")
