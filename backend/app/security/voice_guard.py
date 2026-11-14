"""Controle de l'assistant vocal : le LLM local est une source NON FIABLE.

Il reformule une page bancaire ; il ne decide jamais. Tout ce qu'il produit passe par ce
filtre avant d'etre renvoye, en anglais puis en pidgin. En cas d'echec, la phrase fixe de
repli est renvoyee : elle ne contient ni chiffre, ni consigne d'action.

Le texte entendu est aussi controle : une personne qui dit son code ou son numero a voix
haute ne doit jamais voir ce texte partir vers un modele.
"""
from __future__ import annotations

import re

from .guards import is_degenerate, key_terms, negations
from .masking import DIGIT_RE, EMAIL_RE, SLOT_RE, URL_RE, WORD, slots_of

FALLBACK = "Kama no fit answer dis one well. Make you ask your bank."
SENSITIVE_SPEECH = "No talk your code or your number give anybody, even Kama."

MAX_CHARS = 280
MAX_SENTENCES = 2
MAX_UNKNOWN_RATIO = 0.4  # au-dela, la phrase pidgin est probablement inventee

# Ce qui, dit a voix haute, ne doit jamais partir au modele : un code, un numero, un lien.
_PIN_RE = re.compile(
    r"(?<![\w])(?:pin|code|otp|password|passcode|mot de passe|code secret|num[ée]ro de t[ée]l[ée]phone)(?![\w])",
    re.IGNORECASE,
)
_NUMBER_RE = re.compile(r"\d{3,}")
_LETTER_RE = re.compile(r"[A-Za-zÀ-ÿ]")
_MIXED_RE = re.compile(rf"(?<![{WORD}])(?=[{WORD}\-]*\d)(?=[\d]*[{WORD}])[{WORD}\-]+")

# Actions financieres ou de securite : le LLM ne les ordonne jamais.
_ACTIONS = (
    "send|sending|pay|paying|payment|transfer|transferring|withdraw|withdrawing|confirm|confirming|"
    "validate|validating|click|clicking|press|pressing|tap|tapping|give|giving|share|sharing|"
    "tell|telling|provide|providing|enter|entering|type|typing|dial|dialing|calling|call|"
    "submit|submitting|approve|approving|accept|accepting|sign|signing"
)
_ACTION_RE = re.compile(rf"(?<![{WORD}])({_ACTIONS})(?![{WORD}])", re.IGNORECASE)
# « the transfer », « a payment », « Button Confirm » : une mention, pas une consigne.
_MENTION_BEFORE_RE = re.compile(r"\b(?:the|a|an|this|that|your|my|our|their|its|of|for|button|option)\s+$", re.IGNORECASE)

# Seules les phrases de prudence attestees sur le code sont autorisees a contenir une action.
_CAUTION_RE = re.compile(
    r"(?:never|no|not|do not|don['’]?t|nor)\b[^.!?]{0,45}\b(?:give|share|tell|say|talk|send|type|enter|show)\b"
    r"[^.!?]{0,35}\b(?:code|pin|otp|password|passcode)\b",
    re.IGNORECASE,
)
_CAUTION_REVERSE_RE = re.compile(
    r"\b(?:code|pin|otp|password|passcode)\b[^.!?]{0,35}\b(?:never|no|not|do not|don['’]?t)\b"
    r"[^.!?]{0,45}\b(?:give|share|tell|say|talk|send|type|enter|show)\b",
    re.IGNORECASE,
)

# Numero de telephone, lien, adresse e-mail, nom de service ou d'application a contacter.
_CONTACT_RE = re.compile(r"(?:https?://|www\.|mailto:)", re.IGNORECASE)
_SERVICE_RE = re.compile(
    r"(?:whatsapp|telegram|facebook|messenger|instagram|gmail|orange\s+money|mtn\s+(?:momo|mobile\s+money)|"
    r"mobile\s+money\s+app)",
    re.IGNORECASE,
)
_BRACE_RE = re.compile(r"[{}]")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def sensitive_speech(text: str) -> bool:
    """Vrai si le texte entendu contient un code, un numero, un lien ou une demande de code.

    On ne renvoie alors pas le texte au modele : la personne recoit la phrase fixe de prudence.
    """
    if not text:
        return False
    if _PIN_RE.search(text) or EMAIL_RE.search(text) or URL_RE.search(text):
        return True
    if _NUMBER_RE.search(text):  # code, telephone, montant : jamais envoye a un modele
        return True
    mixed = _MIXED_RE.search(text)
    return bool(mixed and _LETTER_RE.search(mixed.group()) and DIGIT_RE.search(mixed.group()))


def _too_long(text: str) -> str | None:
    if len(text) > MAX_CHARS:
        return "too_long"
    sentences = [s for s in _SENTENCE_SPLIT.split(text.strip()) if s]
    if len(sentences) > MAX_SENTENCES:
        return "too_many_sentences"
    return None


def _action_problem(text: str) -> str | None:
    """Refuse toute consigne d'action, sauf un rappel de prudence sur le code.

    Une mention (« the transfer fee », « the Confirm button ») n'est pas une consigne :
    c'est le verbe employe comme nom qui est tolere, jamais un ordre a la personne.
    """
    for sentence in _SENTENCE_SPLIT.split(text):
        cautious = _CAUTION_RE.search(sentence) or _CAUTION_REVERSE_RE.search(sentence)
        for match in _ACTION_RE.finditer(sentence):
            if cautious:
                continue  # « never give your code », « no give your code »
            before = sentence[max(0, match.start() - 20) : match.start()]
            if _MENTION_BEFORE_RE.search(before):
                continue
            return "action_instruction"
    return None


def _unknown_ratio(text: str, lexicon: frozenset[str]) -> float:
    words = re.findall(r"[a-zà-ÿ']+", SLOT_RE.sub(" ", text).lower())
    return sum(w not in lexicon for w in words) / len(words) if words else 1.0


def answer_problem(
    answer: str,
    context: str,
    question: str = "",
    lexicon: frozenset[str] | None = None,
) -> str | None:
    """Motif de rejet d'une reponse (anglaise ou pidgin), ou None si elle peut etre montree."""
    if not answer or not answer.strip():
        return "empty"
    if (problem := _too_long(answer)) is not None:
        return problem

    # 1. Balises : uniquement celles du contexte, aucune autre valeur.
    slots = set(slots_of(answer))
    if slots - set(slots_of(context)):
        return "unknown_slot"
    rest = SLOT_RE.sub("", answer)
    if _BRACE_RE.search(rest):
        return "unknown_slot"
    if DIGIT_RE.search(rest):
        return "invented_number"

    # 2. Aucun contact direct : lien, adresse, nom de service ou d'application.
    if _CONTACT_RE.search(rest) or EMAIL_RE.search(rest) or _SERVICE_RE.search(rest):
        return "contact_details"

    # 3. Aucune consigne d'action financiere ou de securite.
    if (problem := _action_problem(answer)) is not None:
        return problem

    # 4. Controles existants : derive religieuse, mots inconnus, texte degenere.
    from ..services import religious_drift  # import tardif : services importe deja ce module

    source = f"{question} {context}".strip()
    if religious_drift(source, answer):
        return "religious_drift"
    if lexicon is not None and _unknown_ratio(answer, lexicon) > MAX_UNKNOWN_RATIO:
        return "unknown_words"
    if is_degenerate(source, answer):
        return "degenerate"

    # 5. Negation : une question niee ne recoit pas une reponse affirmative sur le meme sujet.
    if negations(question) and not negations(answer) and (key_terms(question) & key_terms(answer)):
        return "negation_changed"
    return None
