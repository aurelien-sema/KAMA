"""Remplace le jargon bancaire par une explication simple, avant la traduction.

Source unique de la regle : content-data/jargon_simplification.json. Un terme qui a un
equivalent valide par un locuteur (equivalent_wes) n'est plus reformule.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

LETTRES = "A-Za-zÀ-ÖØ-öø-ÿ"
PROTEGE = re.compile(r"\{x\d+\}|ZZ\d+ZZ")
DETERMINANTS = {
    "fr": r"(?:(?:votre|vos|le|la|les|ce|cette|ces|mon|ma|mes|du|des|au|aux)\s+|l['’])?",
    "en": r"(?:(?:your|the|this|these|my)\s+)?",
}
CONTRACTIONS = {"du": "de ", "des": "de ", "au": "à ", "aux": "à "}


class Simplifier:
    def __init__(self, terms: list[dict]) -> None:
        self.terms = [t for t in terms if not t.get("equivalent_wes")]
        self.patterns = {
            lang: [(self._pattern(t[lang], lang), t["simple_" + lang]) for t in self.terms] for lang in ("fr", "en")
        }

    @classmethod
    def from_file(cls, path: Path) -> "Simplifier":
        return cls(json.loads(Path(path).read_text(encoding="utf-8"))["termes"])

    @staticmethod
    def _pattern(term: str, lang: str) -> re.Pattern:
        # Le determinant devant le terme est remplace avec lui : l'explication a deja le sien.
        return re.compile(rf"(?<![{LETTRES}]){DETERMINANTS[lang]}{re.escape(term)}(?![{LETTRES}])", re.IGNORECASE)

    def simplify(self, text: str, lang: str) -> str:
        """Les balises et le reste de la phrase ne changent pas ; une explication posee n'est jamais reformulee."""
        if lang not in self.patterns:
            return text
        kept: list[str] = []
        placed: list[str] = []
        out = PROTEGE.sub(lambda m: kept.append(m.group()) or f"\x00{len(kept) - 1}\x00", text)

        def place(simple: str):
            def apply(m: re.Match) -> str:
                first = m.group().split()[0].lower() if " " in m.group() else ""
                word = CONTRACTIONS.get(first, "") + simple
                word = word[0].upper() + word[1:] if m.group()[0].isupper() else word
                placed.append(word)
                return f"\x01{len(placed) - 1}\x01"

            return apply

        for pattern, simple in self.patterns[lang]:
            out = pattern.sub(place(simple), out)
        out = re.sub(r"\x01(\d+)\x01", lambda m: placed[int(m.group(1))], out)
        return re.sub(r"\x00(\d+)\x00", lambda m: kept[int(m.group(1))], out)

    def remaining(self, text: str, lang: str) -> list[str]:
        """Termes encore presents : doit etre vide apres simplify()."""
        bare = PROTEGE.sub(" ", text)
        return [t[lang] for t in self.terms if re.search(rf"(?<![{LETTRES}]){re.escape(t[lang])}(?![{LETTRES}])", bare, re.I)]
