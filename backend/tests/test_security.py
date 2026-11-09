import logging
from pathlib import Path

import pytest

from app.engines import MarianCT2Translator, load_engines
from app.settings import Settings
from conftest import FakeRecognizer, engines_with, route, wav_bytes

SENTINEL = "SECRET-25500-Mbarga"
EXT = "chrome-extension://abcdefgh"
BODY = {"text": "Bonjour", "source_lang": "fr", "target_lang": "bbj"}


def test_health_and_capabilities(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    caps = client.get("/v1/capabilities").json()
    assert {l["code"] for l in caps["languages"]} == {"bbj", "wes"}


def test_response_is_never_cached(client):
    r = client.get("/v1/capabilities")
    assert r.headers["cache-control"] == "no-store" and r.headers["x-content-type-options"] == "nosniff"


def test_prod_refuses_unknown_and_missing_origin(make_client):
    client = make_client(env="prod", allowed_origins=frozenset({EXT}))
    assert client.get("/v1/capabilities").status_code == 403
    assert client.get("/v1/capabilities", headers={"Origin": "https://evil.example"}).status_code == 403
    r = client.get("/v1/capabilities", headers={"Origin": EXT})
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == EXT


def test_prod_hides_docs_and_enables_hsts(make_client):
    client = make_client(env="prod", allowed_origins=frozenset({EXT}))
    assert client.get("/docs", headers={"Origin": EXT}).status_code == 404
    assert "strict-transport-security" in client.get("/healthz").headers


def test_preflight(make_client):
    client = make_client(env="prod", allowed_origins=frozenset({EXT}))
    r = client.options("/v1/translate", headers={"Origin": EXT, "Access-Control-Request-Method": "POST"})
    assert r.status_code == 204 and r.headers["access-control-allow-origin"] == EXT


def test_firefox_needs_explicit_setting():
    origin = "moz-extension://1234"
    assert not Settings(env="prod", allowed_origins=frozenset({EXT})).origin_allowed(origin)
    assert Settings(env="prod", allow_firefox=True).origin_allowed(origin)


def test_rate_limit(make_client):
    client = make_client(rate_per_min=2)
    codes = [client.get("/v1/capabilities").status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_rate_limit_stores_no_clear_ip(make_client):
    client = make_client()
    client.get("/v1/capabilities")
    limiter = client.app.middleware_stack
    while not hasattr(limiter, "hits"):
        limiter = limiter.app
    assert all("testclient" not in key for key in limiter.hits)


def test_body_limit(client):
    r = client.post("/v1/translate", json={**BODY, "text": "a" * 5000})
    assert r.status_code == 413


def test_unknown_field_is_refused_without_echo(client):
    r = client.post("/v1/translate", json={**BODY, "solde": SENTINEL})
    assert r.status_code == 422 and SENTINEL not in r.text


def test_validation_error_does_not_echo_input(client):
    r = client.post("/v1/translate", json={**BODY, "text": SENTINEL * 50})
    assert r.status_code == 422 and SENTINEL not in r.text


def test_nothing_sensitive_reaches_the_logs(make_client, caplog):
    caplog.set_level(logging.DEBUG)
    logging.getLogger("httpx").setLevel(logging.WARNING)  # journal du client de test, pas du serveur

    def crash(_):
        raise RuntimeError(SENTINEL)

    client = make_client(engines_with({"fr>bbj": route(crash)}, asr={"bbj": FakeRecognizer(SENTINEL)}))
    client.post("/v1/translate", json={**BODY, "text": SENTINEL})
    client.post("/v1/translate", json={**BODY, "text": "Bienvenue chez nous"})
    client.post("/v1/voice/intent", content=wav_bytes(), headers={"X-Kama-Lang": "bbj", "Content-Type": "audio/wav"})
    client.post(f"/{SENTINEL}", json=BODY)
    assert SENTINEL not in caplog.text
    assert "Bienvenue" not in caplog.text


def test_prod_requires_origins(monkeypatch):
    from app.settings import load_settings

    monkeypatch.setenv("KAMA_ENV", "prod")
    monkeypatch.delenv("KAMA_ALLOWED_ORIGINS", raising=False)
    with pytest.raises(RuntimeError):
        load_settings()


def test_missing_model_does_not_stop_the_server(tmp_path):
    routes = Path(__file__).resolve().parents[1] / "config" / "routes.json"
    engines = load_engines(routes, tmp_path)
    assert engines.translation == {} and "bbj" in engines.languages


MODEL = Settings().models_dir / "flagship-ai__cameroon-int8" / "francais-ghomala"


@pytest.mark.skipif(not (MODEL / "model.bin").exists(), reason="poids non telecharges")
def test_real_ct2_model_produces_text():
    assert MarianCT2Translator(MODEL).translate("Merci beaucoup.").strip()
