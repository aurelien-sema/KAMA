import json
from pathlib import Path

import pytest

from app.memory import TranslationMemory
from app.security.masking import has_hard_pii, is_masked, mask

ROOT = Path(__file__).resolve().parents[1]
VECTORS = json.loads((ROOT / "contracts" / "masking_vectors.json").read_text(encoding="utf-8"))["vectors"]


@pytest.mark.parametrize("vector", VECTORS, ids=lambda v: v["input"][:40])
def test_vector(vector):
    assert mask(vector["input"]).text == vector["expected"]


@pytest.mark.parametrize("vector", VECTORS, ids=lambda v: v["input"][:40])
def test_masking_is_idempotent(vector):
    assert is_masked(vector["expected"])


def test_values_stay_identical_to_the_page():
    result = mask("Transfert de 25 500 FCFA à Paul Mbarga")
    assert result.values == {"x1": "25 500 FCFA", "x2": "Paul Mbarga"}


def test_known_values_from_the_page_are_masked():
    assert mask("Envoyer à ngono", known_values=("ngono",)).text == "Envoyer à {x1}"


def test_slot_order_must_be_left_to_right():
    assert not is_masked("{x2} puis {x1}")


def test_hard_pii_in_national_language_text():
    assert has_hard_pii("gaə̂ 25 000")
    assert not has_hard_pii("gaə̂ {x1} ŋkhə")


def test_shipped_templates_are_valid():
    memory = TranslationMemory.from_file(ROOT.parent / "content-data" / "templates.json", 0.86)
    assert len(memory.templates) == 64
