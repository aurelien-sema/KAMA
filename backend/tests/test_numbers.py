import pytest

from app.numbers import VOCABULARY, say_amount, say_integer


@pytest.mark.parametrize(
    "texte,mots",
    [
        ("500 FCFA", ["five", "hundred", "franc"]),
        ("25 500 FCFA", ["twenty", "five", "thousand", "five", "hundred", "franc"]),
        ("22 500 FCFA", ["twenty", "two", "thousand", "five", "hundred", "franc"]),
        ("3 000 FCFA", ["three", "thousand", "franc"]),
        ("1 000 000 FCFA", ["one", "million", "franc"]),
        ("1,000,000 FCFA", ["one", "million", "franc"]),
        ("115 FCFA", ["one", "hundred", "fifteen", "franc"]),
        ("0", ["zero"]),
        ("− 20 000 FCFA", ["minus", "twenty", "thousand", "franc"]),
        ("+ 15 000 FCFA", ["fifteen", "thousand", "franc"]),
        ("12,5", ["twelve", "point", "five"]),
        ("8 450 FCFA", ["eight", "thousand", "four", "hundred", "fifty", "franc"]),
        ("10 000 FCFA", ["ten", "thousand", "franc"]),
        ("100 000", ["one", "hundred", "thousand"]),
    ],
)
def test_amounts_are_spelled_exactly(texte, mots):
    assert say_amount(texte) == mots


def test_every_word_is_in_the_vocabulary():
    for n in list(range(0, 1200)) + [9999, 25_500, 999_999, 123_456_789, 999_999_999]:
        assert set(say_integer(n)) <= set(VOCABULARY)


@pytest.mark.parametrize("texte", ["", "abc", "25 5", "12 FCFA FCFA", "1 000 000 000", "25 500 euros"])
def test_unreadable_amounts_raise_instead_of_guessing(texte):
    with pytest.raises(ValueError):
        say_amount(texte)


def test_extension_reference_vectors_match():
    """kama_frontend/lib/nombres.ts doit donner les memes mots : sa reference est ce fichier (npm test cote extension)."""
    import json
    from pathlib import Path

    ref = json.loads((Path(__file__).resolve().parent.parent / "contracts" / "numbers_vectors.json").read_text(encoding="utf-8"))
    for v in ref["vectors"]:
        assert say_amount(v["input"]) == v["words"]
    for bad in ref["unreadable"]:
        with pytest.raises(ValueError):
            say_amount(bad)
