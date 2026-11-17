"""Acces a la simplification du jargon. La regle vit dans le backend : une seule source pour le serveur et l'entrainement."""
import sys
from pathlib import Path

DEPOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(DEPOT / "backend"))
from app.simplify import Simplifier  # noqa: E402

CHEMIN = DEPOT / "content-data" / "jargon_simplification.json"
_SIMPLIFIER = Simplifier.from_file(CHEMIN)
TERMES = _SIMPLIFIER.terms


def simplifier(texte, langue):
    return _SIMPLIFIER.simplify(texte, langue)


def jargon_restant(texte, langue):
    return _SIMPLIFIER.remaining(texte, langue)
