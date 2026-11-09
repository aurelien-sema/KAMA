"""Regles qui decident si un texte traduit peut etre montre a l'utilisateur."""
from __future__ import annotations

import collections
import re
import unicodedata

from .masking import DIGIT_RE, SLOT_RE, WORD, slots_of

_STEMS = """
code|mot de passe|password|pin|secret|otp|confirm|annul|cancel|valid|approve|frais|fee|charge|
solde|balance|montant|amount|débit|debit|crédit|credit|retrait|retir|withdraw|transfert|transfer|
virement|envoi|envoy|send|sent|reçu|receiv|bénéficiaire|beneficiaire|beneficiary|destinataire|
recipient|compte|account|prêt|loan|intérêt|interest|taux|rate|facture|bill|paiement|payment|pay|
bloqu|block|suspend|échou|fail|erreur|error|insuffisant|insufficient|interdit|forbidden|attention|
warning|méfi|beware|danger|fraude|fraud|arnaque|scam|expir|délai|deadline|lien|link|cliqu|click|
argent|money|remboursa|refund
"""
_STEM_LIST = sorted({s.strip() for s in _STEMS.replace("\n", "").split("|") if s.strip()}, key=len, reverse=True)
_STEM_RE = re.compile(f"(?<![{WORD}])(" + "|".join(re.escape(s) for s in _STEM_LIST) + ")")
_NEGATION_RE = re.compile(
    rf"(?<![{WORD}])(ne|n['’]|pas|jamais|aucune?|sans|not|never|no|cannot|can['’]t|don['’]t)(?![{WORD}])"
)

CRITICAL_ELEMENTS = frozenset({"balance", "amount", "fee", "total", "confirm", "error", "warning"})


def _fold(text: str) -> str:
    return unicodedata.normalize("NFC", text).casefold()


def key_terms(text: str) -> frozenset[str]:
    return frozenset(_STEM_RE.findall(_fold(text)))


def negations(text: str) -> bool:
    return _NEGATION_RE.search(_fold(text)) is not None


_WORD_RE = re.compile(f"[{WORD}]+")
# Seuls ces mots peuvent differer entre deux phrases sans changer ce qu'elles veulent dire.
_NEUTRAL_WORDS = frozenset(
    "le la les l un une des du de ce cet cette ces votre vos ton ta tes the a an this that these those your".split()
)


def same_meaning_words(a: str, b: str) -> bool:
    """Refuse par defaut : tout mot different hors de la liste bloque le rapprochement.

    Une liste de contraires serait forcement incomplete (minimum/maximum, avant/apres,
    hausse/baisse...) : c'est la liste des differences permises qui doit rester courte.
    """
    words_a = collections.Counter(_WORD_RE.findall(SLOT_RE.sub(" ", canonical(a))))
    words_b = collections.Counter(_WORD_RE.findall(SLOT_RE.sub(" ", canonical(b))))
    return all(word in _NEUTRAL_WORDS for word in (words_a - words_b) + (words_b - words_a))


def is_critical(text: str, element: str = "text") -> bool:
    """Un texte critique porte sur l'argent, une condition, une alerte ou un montant."""
    return element in CRITICAL_ELEMENTS or bool(slots_of(text)) or bool(key_terms(text)) or negations(text)


def canonical(text: str) -> str:
    """Forme de comparaison : ignore casse, apostrophes et espaces de ponctuation."""
    text = _fold(text).replace("’", "'").replace(" ", " ").replace(" ", " ")
    text = re.sub(r"\s*([:;?!])", r"\1", text)
    return " ".join(text.split()).rstrip(".!? ")


def _trigrams(text: str) -> collections.Counter[str]:
    t = f"  {SLOT_RE.sub('#', canonical(text))}  "
    return collections.Counter(t[i : i + 3] for i in range(len(t) - 2))


def similarity(a: str, b: str) -> float:
    """Cosinus sur les trigrammes de caracteres, entre 0 et 1."""
    ca, cb = _trigrams(a), _trigrams(b)
    dot = sum(v * cb[k] for k, v in ca.items())
    norm = (sum(v * v for v in ca.values()) * sum(v * v for v in cb.values())) ** 0.5
    return dot / norm if norm else 0.0


def is_degenerate(source: str, output: str) -> bool:
    words = output.lower().split()
    if not words:
        return True
    if any(words[i] == words[i + 1] == words[i + 2] for i in range(len(words) - 2)):
        return True
    if len(words) >= 6 and collections.Counter(words).most_common(1)[0][1] / len(words) > 0.4:
        return True
    return len(output) > 3 * len(source) + 30


def output_problem(source: str, output: str) -> str | None:
    """Motif de rejet d'une sortie de modele, ou None si elle passe les controles."""
    if slots_of(source) != slots_of(output):
        return "slots_changed"
    if DIGIT_RE.search(SLOT_RE.sub("", output)):
        return "invented_number"
    if is_degenerate(source, output):
        return "degenerate"
    if canonical(source) == canonical(output):
        return "copied_source"
    return None
