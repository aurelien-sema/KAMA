"""Contrat entre l'extension et le serveur, avec le VRAI contenu du depot (content-data/) :
les phrases que la fenetre Kama envoie doivent etre acceptees par le serveur, et aucune traduction non validee n'est servie comme « Verifie »."""
import json

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.security.masking import is_masked
from app.services import build_services
from app.settings import REPO_DIR, Settings
from conftest import engines_with, route

CONTENT = REPO_DIR / "content-data"


def window_sentences():
    return [e["fr"] for e in json.loads((CONTENT / "kama_fenetre.json").read_text(encoding="utf-8"))["entries"]]


@pytest.fixture(scope="module")
def model_calls():
    return []


@pytest.fixture(scope="module")
def client(model_calls):
    def fake_model(text):
        model_calls.append(text)
        return "MODEL " + text

    engines = engines_with(translation={"fr>wes": route(fake_model), "en>wes": route(fake_model)})
    settings = Settings(content_dir=CONTENT, rate_per_min=100000, global_rate_per_min=1000000)
    return TestClient(create_app(settings, build_services(settings, engines)), raise_server_exceptions=False)


def test_the_window_catalogue_is_not_empty_and_every_sentence_is_masked():
    sentences = window_sentences()
    assert len(sentences) > 50
    assert [s for s in sentences if not is_masked(s)] == []  # sinon le serveur repond unmasked_content


@pytest.mark.parametrize("element", ["balance", "amount", "fee", "total", "confirm", "error", "warning"])
def test_critical_elements_never_reach_the_model(client, model_calls, element):
    model_calls.clear()
    r = client.post("/v1/translate", json={"text": "Frais : {x1}.", "source_lang": "fr", "target_lang": "wes", "element": element})
    assert r.status_code == 200
    assert r.json()["badge"] != "machine" and not model_calls


def test_no_window_sentence_is_served_as_verified_without_a_native_validation(client):
    """Regle d'or : un brouillon (sans validated_by) ne sort jamais avec le badge « Verifie »."""
    catalogue = json.loads((CONTENT / "kama_fenetre.json").read_text(encoding="utf-8"))["entries"]
    validated = {e["fr"] for e in catalogue if e.get("validated_by")}
    for sentence in window_sentences():
        r = client.post("/v1/translate", json={"text": sentence, "source_lang": "fr", "target_lang": "wes", "element": "text"}).json()
        if sentence not in validated:
            assert r["badge"] != "verified", sentence


def test_a_validated_label_of_the_test_page_is_served_as_verified(client):
    r = client.post("/v1/translate", json={"text": "Frais", "source_lang": "fr", "target_lang": "wes", "element": "text"}).json()
    assert r["badge"] == "verified" and r["origin"] == "memory" and r["text"]


def test_an_unmasked_amount_is_refused(client):
    r = client.post("/v1/translate", json={"text": "Frais : 500 FCFA.", "source_lang": "fr", "target_lang": "wes", "element": "fee"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "unmasked_content"


def test_the_embedded_glossary_matches_what_the_server_serves():
    """kama_frontend/config/glossaire.json est genere depuis la meme memoire : toute traduction y est validee et gardee avec ses balises."""
    from app.export_glossary import build_glossary
    from app.memory import TranslationMemory

    memory = TranslationMemory.from_file(
        CONTENT / "templates.json", 0.86, [CONTENT / "safinum_test_page.json", CONTENT / "kama_interface.json", CONTENT / "kama_fenetre.json"]
    )
    generated = build_glossary(memory)
    embedded = json.loads((REPO_DIR / "kama_frontend" / "config" / "glossaire.json").read_text(encoding="utf-8"))
    assert embedded["fr"] == generated["fr"] and embedded["en"] == generated["en"], "glossaire embarque perime : python -m app.export_glossary"


def test_demo_routes_differ_from_default_routes_only_by_the_microphone():
    """config/routes.demo.json (scripts/lancer_demo.ps1) ne doit pas deriver de routes.json : seule la reconnaissance du pidgin change."""
    default = json.loads((REPO_DIR / "backend" / "config" / "routes.json").read_text(encoding="utf-8"))
    demo = json.loads((REPO_DIR / "backend" / "config" / "routes.demo.json").read_text(encoding="utf-8"))
    assert demo["asr"]["wes"]["enabled"] is True
    demo["asr"]["wes"]["enabled"] = default["asr"]["wes"]["enabled"]
    assert demo == default


def test_every_kama_text_has_a_pidgin_version_and_drafts_are_marked():
    """Decision de l'equipe : avec le pidgin choisi, toute l'interface de Kama est en pidgin. Un brouillon reste marque comme tel."""
    from app.export_glossary import build_interface

    entries = [e for nom in ("kama_interface.json", "kama_fenetre.json") for e in json.loads((CONTENT / nom).read_text(encoding="utf-8"))["entries"]]
    embedded = json.loads((REPO_DIR / "kama_frontend" / "config" / "interface.json").read_text(encoding="utf-8"))
    assert embedded["fr"] == build_interface(entries)["fr"], "interface.json perime : python -m app.export_glossary"
    fenetre = json.loads((CONTENT / "kama_fenetre.json").read_text(encoding="utf-8"))["entries"]
    assert [e["fr"] for e in fenetre if not e.get("wes")] == [], "phrase de la fenetre sans pidgin"
    for e in entries:
        item = embedded["fr"]["wes"].get(__import__("app.export_glossary", fromlist=["normalize"]).normalize(e["fr"]))
        if item and not e.get("validated_by") and item["texte"] == e.get("wes"):
            assert item["statut"] == "brouillon"


def test_embedded_patterns_and_english_sources_match_the_server():
    """Modeles a valeur variable (« Bonjour, {x1} ») et textes anglais de la page : l'extension les applique en local, valides seulement."""
    from app.export_glossary import build_patterns

    page = json.loads((CONTENT / "safinum_test_page.json").read_text(encoding="utf-8"))
    embedded = json.loads((REPO_DIR / "kama_frontend" / "config" / "glossaire.json").read_text(encoding="utf-8"))
    assert embedded["patterns"] == build_patterns(page), "glossaire perime : python -m app.export_glossary"
    assert embedded["en"]["wes"], "les textes anglais de la page (bouton EN) doivent etre embarques"
