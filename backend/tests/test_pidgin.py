import json
from pathlib import Path

import pytest

from app.engines import (
    EngineRefused,
    MarianCT2Translator,
    PipelineTranslator,
    TranslationRoute,
    from_model_tags,
    load_engines,
    to_model_tags,
)
from app.memory import TranslationMemory, _load_page
from app.settings import Settings
from app.simplify import Simplifier
from conftest import FakeTranslator, engines_with

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT.parent / "content-data"

PAGE = {
    "entries": [
        {"id": "frais", "fr": "Frais", "en": ["Fees", "Fee"], "wes": "Charge", "validated_by": "locuteur de test"},
        {"id": "brouillon", "fr": "Solde disponible", "en": "Available balance", "wes": "Money weh you fit use", "validated_by": None},
        {"id": "montant_fixe", "fr": "Frais de 2 % (min. 200 FCFA)", "en": "2% fee (min. 200 FCFA)", "wes": "Dem go take 2% (e no fit under 200 FCFA)", "validated_by": "x"},
        {"id": "montant_change", "fr": "Plafond de 500 FCFA", "en": "Limit of 500 FCFA", "wes": "Limit na 5000 FCFA", "validated_by": "x"},
    ],
    "patterns": [{"id": "salut", "fr": "^Bonjour, (.+)$", "en": "^Hello, (.+)$", "wes": "How na, {x1}", "validated_by": "x"}],
}


@pytest.fixture
def page_client(make_client, content_dir):
    (content_dir / "safinum_test_page.json").write_text(json.dumps(PAGE), encoding="utf-8")
    return make_client


def post(client, text, source="fr", target="wes", **kw):
    return client.post("/v1/translate", json={"text": text, "source_lang": source, "target_lang": target, **kw}).json()


def test_validated_page_text_is_verified(page_client):
    client = page_client()
    assert post(client, "Frais") == {"text": "Charge", "badge": "verified", "origin": "memory", "reason": None}
    assert post(client, "Fee", source="en")["text"] == "Charge"


def test_draft_is_never_served(page_client):
    assert post(page_client(), "Solde disponible")["badge"] == "untranslated"


def test_page_values_become_slots(page_client):
    assert post(page_client(), "Frais de {x1} (min. {x2})")["text"] == "Dem go take {x1} (e no fit under {x2})"


def test_translation_that_changes_a_number_is_not_loaded(content_dir):
    (content_dir / "p.json").write_text(json.dumps(PAGE), encoding="utf-8")
    templates, _ = _load_page(content_dir / "p.json")
    assert {t.id: t.translations for t in templates}["montant_change"] == {}


def test_pattern_needs_a_slot_not_free_text(page_client):
    client = page_client()
    assert post(client, "Bonjour, {x1}")["text"] == "How na, {x1}"
    assert post(client, "Bonjour, tout le monde")["badge"] == "untranslated"


def test_messages_are_split_into_sentences():
    from app.engines import split_sentences

    assert split_sentences("Maintenance is planned tonight. Thank you for your patience.") == ["Maintenance is planned tonight.", "Thank you for your patience."]
    assert split_sentences("Send {x1}. {x2} will receive it.") == ["Send {x1}.", "{x2} will receive it."]
    assert split_sentences("Fees: 2.5 percent.") == ["Fees: 2.5 percent."]


def test_tags_survive_model_spacing():
    assert to_model_tags("Send {x1} to {x2}") == "Send ZZ1ZZ to ZZ2ZZ"
    assert from_model_tags("Send ZZ1 ZZ to Z Z2ZZ") == "Send {x1} to {x2}"


def test_pipeline_simplifies_then_translates():
    simplifier = Simplifier.from_file(CONTENT / "jargon_simplification.json")
    model = FakeTranslator(lambda t: "PIDGIN " + t)
    pipeline = PipelineTranslator([("simplify", lambda t: simplifier.simplify(t, "en")), ("model", model.translate)])
    assert pipeline.translate("Your balance is {x1}.") == "PIDGIN The money in your account is {x1}."
    assert model.calls == ["The money in your account is {x1}."]


def test_pipeline_refuses_a_copied_sentence():
    pipeline = PipelineTranslator([("model", lambda t: t)])
    with pytest.raises(EngineRefused):
        pipeline.translate("Welcome to our service")


def test_unknown_words_are_rejected(make_client):
    route = TranslationRoute(FakeTranslator(lambda t: "Bearbeiten wichtige zzzq"), lexicon=frozenset({"di", "money"}), max_unknown_ratio=0.25)
    r = post(make_client(engines_with({"fr>wes": route})), "Bienvenue chez nous")
    assert r["reason"] == "guard_failed"


def test_known_words_pass(make_client):
    route = TranslationRoute(FakeTranslator(lambda t: "Welcome for di place"), lexicon=frozenset({"welcome", "for", "di", "place"}), max_unknown_ratio=0.25)
    assert post(make_client(engines_with({"fr>wes": route})), "Bienvenue chez nous")["badge"] == "machine"


def test_pidgin_routes_are_unavailable_without_their_models(tmp_path):
    engines = load_engines(ROOT / "config" / "routes.json", tmp_path, CONTENT, Simplifier.from_file(CONTENT / "jargon_simplification.json"))
    assert "fr>wes" not in engines.translation and "en>wes" not in engines.translation


def test_shipped_page_catalog_loads():
    memory = TranslationMemory.from_file(CONTENT / "templates.json", 0.86, CONTENT / "safinum_test_page.json")
    assert len(memory.templates) >= 64 + 70 and len(memory.patterns) == 3


def test_shipped_jargon_never_leaves_a_term():
    simplifier = Simplifier.from_file(CONTENT / "jargon_simplification.json")
    for text in ("Your balance is {x1}.", "Insufficient balance for this transfer.", "Le montant du transfert est trop élevé."):
        lang = "fr" if "Le " in text else "en"
        assert simplifier.remaining(simplifier.simplify(text, lang), lang) == []


CT2 = Settings().models_dir / "poids" / "ct2" / "pidgin_en_wes"


@pytest.mark.skipif(not (CT2 / "model.bin").exists(), reason="modele pidgin non converti")
def test_real_pidgin_model_lost_tag_is_always_caught():
    """Le modele peut perdre une balise ; le serveur, lui, ne doit jamais laisser passer cette sortie."""
    from app.security.guards import output_problem

    model = MarianCT2Translator(CT2)
    for source in ("You are about to send {x1} to {x2}.", "Your balance is {x1}.", "The fee is {x1} for {x2}."):
        out = model.translate(source)
        tags_kept = sorted(out.count("{x%d}" % n) for n in range(1, source.count("{x") + 1)) == [1] * source.count("{x")
        assert tags_kept or output_problem(source, out) == "slots_changed"
