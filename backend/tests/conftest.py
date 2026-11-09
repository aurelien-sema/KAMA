import io
import json
import wave

import pytest
from fastapi.testclient import TestClient

from app.engines import EngineSet, TranslationRoute
from app.main import create_app
from app.services import build_services
from app.settings import Settings

TEMPLATES = {
    "templates": [
        {
            "id": "frais",
            "fr": "Les frais de cette opération sont de {x1}.",
            "en": "The fee for this operation is {x1}.",
            "translations": {"bbj": {"text": "BBJ-FRAIS {x1}", "validated_by": "locuteur de test"}},
        },
        {
            "id": "remboursable",
            "fr": "Les frais ne sont pas remboursables.",
            "en": "Fees are not refundable.",
            "translations": {"bbj": {"text": "BBJ-NON-REMBOURSABLE", "validated_by": "locuteur de test"}},
        },
        {
            "id": "transfert",
            "fr": "Vous allez envoyer {x1} à {x2}.",
            "en": "You are about to send {x1} to {x2}.",
            "translations": {"bbj": {"text": "BBJ {x2} BBJ {x1}", "validated_by": "locuteur de test"}},
        },
        {
            "id": "brouillon",
            "fr": "Votre carte expire bientôt.",
            "en": "Your card expires soon.",
            "translations": {"bbj": {"text": "BROUILLON NON VALIDE"}},
        },
    ]
}
INTENTS = {"intents": {"ask_balance": {"bbj": ["solde kama"], "fr": ["mon solde"]}, "repeat": {"bbj": ["encore"]}}}


class FakeTranslator:
    def __init__(self, fn):
        self.fn = fn
        self.calls = []

    def translate(self, text):
        self.calls.append(text)
        return self.fn(text)


class FakeRecognizer:
    def __init__(self, text):
        self.text = text

    def transcribe(self, pcm16):
        return self.text


class FakeSynth:
    def __init__(self):
        self.calls = []

    def synthesize(self, text):
        self.calls.append(text)
        return b"WAV"


def wav_bytes(seconds=1.0, rate=16000, channels=1, width=2):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(width)
        w.setframerate(rate)
        w.writeframes(b"\0" * int(seconds * rate) * channels * width)
    return buf.getvalue()


@pytest.fixture
def content_dir(tmp_path):
    (tmp_path / "templates.json").write_text(json.dumps(TEMPLATES), encoding="utf-8")
    (tmp_path / "intents.json").write_text(json.dumps(INTENTS), encoding="utf-8")
    return tmp_path


@pytest.fixture
def make_client(content_dir):
    def factory(engines=None, **overrides):
        settings = Settings(content_dir=content_dir, **overrides)
        engines = engines or EngineSet(languages={"bbj": "Ghomálá'", "wes": "Pidgin"})
        return TestClient(create_app(settings, build_services(settings, engines)), raise_server_exceptions=False)

    return factory


@pytest.fixture
def client(make_client):
    return make_client()


def route(fn, **kw):
    return TranslationRoute(FakeTranslator(fn), **kw)


def engines_with(translation=None, asr=None, tts=None):
    return EngineSet({"bbj": "Ghomálá'", "wes": "Pidgin"}, translation or {}, asr or {}, tts or {})
