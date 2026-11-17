"""Lecture des montants a voix haute, sans modele : un nombre devient une suite de mots, chaque mot un extrait audio.

Les montants ne passent jamais par un modele de langue (regle d'or). Ici, aucun texte n'est invente : c'est un calcul.
Les mots du pidgin sont des BROUILLONS (content-data/nombres_wes.json) tant qu'un locuteur ne les a pas valides ;
l'extension joue les extraits enregistres ou generes pour ces mots, jamais une voix improvisee.
"""
from __future__ import annotations

import re

UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
         "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
TENS = {2: "twenty", 3: "thirty", 4: "forty", 5: "fifty", 6: "sixty", 7: "seventy", 8: "eighty", 9: "ninety"}
VOCABULARY = sorted({*UNITS, *TENS.values(), "hundred", "thousand", "million", "franc", "point", "minus"})
_AMOUNT = re.compile(r"^\s*([+\-−])?\s*(\d{1,3}(?:[   ,.]\d{3})*|\d+)(?:[.,](\d{1,2}))?\s*(FCFA|XAF|F CFA)?\s*$")


def _below_thousand(n: int) -> list[str]:
    out: list[str] = []
    if n >= 100:
        out += [UNITS[n // 100], "hundred"]
        n %= 100
    if n >= 20:
        out.append(TENS[n // 10])
        n %= 10
        if n:
            out.append(UNITS[n])
    elif n or not out:
        out.append(UNITS[n])
    return out


def say_integer(n: int) -> list[str]:
    """Suite de mots pour un entier de 0 a 999 999 999."""
    if not 0 <= n < 1_000_000_000:
        raise ValueError("nombre hors limites")
    if n == 0:
        return ["zero"]
    out: list[str] = []
    for size, word in ((1_000_000, "million"), (1_000, "thousand")):
        part, n = divmod(n, size)
        if part:
            out += _below_thousand(part) + [word]
    if n:
        out += _below_thousand(n)
    return out


def say_amount(text: str) -> list[str]:
    """'25 500 FCFA' -> ['twenty', 'five', 'thousand', 'five', 'hundred', 'franc']. Une chaine illisible leve ValueError :
    l'extension affiche alors le montant sans le lire, plutot que de risquer un chiffre faux."""
    m = _AMOUNT.match(text)
    if not m:
        raise ValueError("montant illisible")
    sign, integer, decimals, currency = m.groups()
    out = ["minus"] if sign in ("-", "−") else []
    out += say_integer(int(re.sub(r"[   ,.]", "", integer)))
    if decimals:
        out += ["point"] + [UNITS[int(d)] for d in decimals]
    if currency:
        out.append("franc")
    return out
