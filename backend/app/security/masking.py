"""Masquage des donnees personnelles.

L'extension masque le texte AVANT tout envoi. Le serveur rejoue le meme algorithme
pour refuser un texte qui ne serait pas masque (defense en profondeur).

La specification commune est dans contracts/masking_vectors.json : l'implementation
TypeScript de l'extension doit donner les memes resultats sur ces exemples.

Les classes de caracteres sont explicites, car \\w n'a pas le meme sens en Python et
en JavaScript.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

CAP = "A-ZÀ-ÖØ-ÞŒ"
LOW = "a-zß-öø-ÿœ"
WORD = CAP + LOW + "0-9_"
APOS = "'’"
NS = "  "  # espaces a l'interieur d'un groupe de noms
SEP = "   "  # espaces a l'interieur d'un nombre

SLOT_RE = re.compile(r"\{x[0-9]+\}")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
URL_RE = re.compile(r"(?:https?://|www\.)[^\s]+")
TOKEN_RE = re.compile(f"[{WORD}\\-]+")
LETTER_RE = re.compile(f"[{CAP}{LOW}]")
DIGIT_RE = re.compile(r"\d")
NUMBER_RE = re.compile(
    rf"\+?\d(?:[{SEP}.,:/\-]?\d)*(?:[{SEP}]?(?:FCFA|F CFA|XAF|CFA|F|%|€|\$)(?![{WORD}]))?"
)

_CAPWORD = rf"[{CAP}][{CAP}{LOW}{APOS}\-]*"
_NAME = rf"[{CAP}][{LOW}{APOS}\-]+"
RUN_RE = re.compile(rf"(?<![{WORD}{APOS}\-])({_CAPWORD}(?:[{NS}]+{_CAPWORD})+)(?![{WORD}])")
PREP_RE = re.compile(rf"(?:^|[{NS}(])(?:à|de|du|pour|vers|to|from|by)[{NS}]+({_NAME})(?![{WORD}])")
ELISION_RE = re.compile(rf"(?:^|[^{WORD}])[dD][{APOS}]({_NAME})(?![{WORD}])")
LABEL_RE = re.compile(
    rf"(?:[Bb]énéficiaire|[Bb]eneficiaire|[Dd]estinataire|[Rr]ecipient|[Bb]eneficiary|[Nn]om|[Nn]ame)"
    rf"[{NS}]*:[{NS}]*({_CAPWORD})(?![{WORD}])"
)

# Mots d'interface : une suite de mots en majuscules composee uniquement de ces mots
# n'est pas un nom de personne.
INTERFACE_WORDS = frozenset(
    """
    mon ma mes votre vos notre nos le la les un une des du de au aux et ou sur
    my your our the a an of to and or on for in at
    compte comptes solde soldes disponible insuffisant frais montant montants total totaux
    transfert transferts retrait retraits depot dépôt versement virement paiement paiements
    facture factures bénéficiaire beneficiaire bénéficiaires destinataire expéditeur
    confirmer confirmation annuler valider envoyer recevoir continuer retour suivant accueil
    historique transactions transaction opération opérations erreur attention alerte
    code secret mot passe service services client clients banque carte épargne prêt
    mobile money orange mtn express union fcfa xaf otp pin sms bonjour merci
    account accounts balance available insufficient fee fees amount amounts transfer transfers
    withdrawal deposit payment payments bill bills recipient beneficiary sender confirm cancel
    approve send receive continue back next home history error warning alert password bank
    card savings loan customer hello thank thanks
    press tap click appuyez cliquez touchez
    safinum pay
    """.split()
)


@dataclass(frozen=True)
class Masked:
    text: str
    values: dict[str, str] = field(default_factory=dict)


def _is_interface_text(fragment: str) -> bool:
    words = [w.strip(APOS + "-").lower() for w in re.split(f"[{NS}]+", fragment)]
    return all(w in INTERFACE_WORDS for w in words if w)


def _hard_spans(text: str) -> list[tuple[int, int]]:
    """Donnees reconnaissables a leur forme : e-mails, liens, identifiants, nombres."""
    spans: list[tuple[int, int]] = []
    spans += [m.span() for m in EMAIL_RE.finditer(text)]
    spans += [m.span() for m in URL_RE.finditer(text)]
    for m in TOKEN_RE.finditer(text):
        if LETTER_RE.search(m.group()) and DIGIT_RE.search(m.group()):
            spans.append(m.span())
    spans += [m.span() for m in NUMBER_RE.finditer(text)]
    return spans


def _name_spans(text: str) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    for pattern in (RUN_RE, PREP_RE, ELISION_RE, LABEL_RE):
        for m in pattern.finditer(text):
            if not _is_interface_text(m.group(1)):
                spans.append(m.span(1))
    return spans


def _known_spans(text: str, known: tuple[str, ...]) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    for value in sorted({k for k in known if k.strip()}, key=len, reverse=True):
        start = text.find(value)
        while start != -1:
            spans.append((start, start + len(value)))
            start = text.find(value, start + len(value))
    return spans


def _merge(groups: list[list[tuple[int, int]]]) -> list[tuple[int, int]]:
    """Garde les plages sans chevauchement ; les premiers groupes sont prioritaires."""
    taken: list[tuple[int, int]] = []
    for group in groups:
        for start, end in group:
            if start < end and not any(start < b and a < end for a, b in taken):
                taken.append((start, end))
    return sorted(taken)


def mask(text: str, known_values: tuple[str, ...] = ()) -> Masked:
    """Remplace chaque donnee sensible par {x1}, {x2}... de gauche a droite.

    Les numeros sont indispensables : une langue cible peut changer l'ordre des mots,
    et un simple {x} ne permettrait plus de savoir quel montant va a quelle place.
    """
    spans = _merge(
        [
            [m.span() for m in SLOT_RE.finditer(text)],
            _known_spans(text, known_values),
            _hard_spans(text),
            _name_spans(text),
        ]
    )
    out: list[str] = []
    values: dict[str, str] = {}
    cursor = 0
    for index, (start, end) in enumerate(spans, 1):
        out.append(text[cursor:start])
        out.append(f"{{x{index}}}")
        values[f"x{index}"] = text[start:end]
        cursor = end
    out.append(text[cursor:])
    return Masked("".join(out), values)


def is_masked(text: str) -> bool:
    """Vrai si le masquage ne changerait rien au texte."""
    return mask(text).text == text


def has_hard_pii(text: str) -> bool:
    """Controle des textes en langue nationale, ou les noms ne sont pas detectables."""
    slots = [m.span() for m in SLOT_RE.finditer(text)]
    return any(not any(a <= s and e <= b for a, b in slots) for s, e in _hard_spans(text))


def slots_of(text: str) -> list[str]:
    return sorted(SLOT_RE.findall(text))
