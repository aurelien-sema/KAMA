"""Ghomala (decision de l'equipe, 2026-11-17) : le modele traduit aussi les textes critiques, montants masques ;
les brouillons pre-calcules de content-data sont servis en « Traduction automatique ». Le pidgin garde la regle."""
import json

from conftest import engines_with, route

FRAIS = {"text": "Les frais sont de {x1}. Ne partage jamais ton code.", "source_lang": "fr", "element": "fee"}


def _engines(**kw):
    engines = engines_with(
        {"fr>bbj": route(lambda t: "BBJ " + " ".join(s for s in t.split() if s.startswith("{x"))),
         "fr>wes": route(lambda t: "WES " + " ".join(s for s in t.split() if s.startswith("{x")))},
        **kw,
    )
    engines.critical_model_languages = frozenset({"bbj"})
    return engines


def test_ghomala_critical_text_goes_through_the_model(make_client):
    client = make_client(_engines())
    r = client.post("/v1/translate", json={**FRAIS, "target_lang": "bbj"}).json()
    assert (r["text"], r["badge"], r["origin"]) == ("BBJ {x1}.", "machine", "model")


def test_pidgin_keeps_the_critical_rule(make_client):
    client = make_client(_engines())
    r = client.post("/v1/translate", json={**FRAIS, "target_lang": "wes"}).json()
    assert r["text"] is None and r["reason"] == "critical_content"


def test_ghomala_model_output_still_needs_the_same_slots(make_client):
    engines = engines_with({"fr>bbj": route(lambda t: "BBJ sans montant")})
    engines.critical_model_languages = frozenset({"bbj"})
    r = make_client(engines).post("/v1/translate", json={**FRAIS, "target_lang": "bbj"}).json()
    assert r["text"] is None and r["reason"] == "guard_failed"


def test_ghomala_draft_is_served_as_machine_translation(make_client, content_dir):
    entree = {"id": "x", "zone": "fenetre", "fr": "Regarde ton solde : c'est l'argent que tu as.", "bbj": "BROUILLON-BBJ"}
    (content_dir / "kama_interface.json").write_text(json.dumps({"entries": [entree]}), encoding="utf-8")
    engines = _engines()
    client = make_client(engines)
    r = client.post("/v1/translate", json={"text": entree["fr"], "source_lang": "fr", "target_lang": "bbj"}).json()
    assert r == {"text": "BROUILLON-BBJ", "badge": "machine", "origin": "model", "reason": None}
    assert engines.translation["fr>bbj"].translator.calls == []  # aucun appel au modele


def test_unvalidated_draft_is_never_served_for_pidgin(make_client, content_dir):
    entree = {"id": "x", "zone": "fenetre", "fr": "Regarde ton solde.", "wes": "BROUILLON-WES"}
    (content_dir / "kama_interface.json").write_text(json.dumps({"entries": [entree]}), encoding="utf-8")
    r = make_client(_engines()).post("/v1/translate", json={"text": entree["fr"], "source_lang": "fr", "target_lang": "wes"}).json()
    assert r["text"] != "BROUILLON-WES"
