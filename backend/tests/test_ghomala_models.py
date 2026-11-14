import json
import sys
from contextlib import nullcontext
from types import SimpleNamespace

import pytest

from app import engines as engines_module
from app.engines import EngineRefused, M2M100Translator, load_engines
from app.voice_engines import GhomalaVitsSynthesizer, normaliser_ghomala_tts


class FakeTensor:
    def sum(self):
        return self

    def item(self):
        return 2


def fake_m2m_engine(tmp_path, monkeypatch, decoded):
    (tmp_path / "kama_config.json").write_text(
        '{"normalisation":{"apostrophe":"\'","alpha_vers_a":true},'
        '"substitutions":{"U+0289":"ÿ"}}',
        encoding="utf-8",
    )
    tokenizer_calls = []
    generation_calls = []

    class FakeTokenizer:
        src_lang = None

        def get_lang_id(self, language):
            assert language == "sw"
            return 128088

        def __call__(self, text, **_kwargs):
            tokenizer_calls.append(text)
            return {"input_ids": FakeTensor(), "attention_mask": FakeTensor()}

        def batch_decode(self, _output, **_kwargs):
            return [decoded]

    class FakeModel:
        def eval(self):
            return self

        def generate(self, **kwargs):
            generation_calls.append(kwargs)
            return [[0]]

    fake_torch = SimpleNamespace(
        float16="float16",
        set_num_threads=lambda _threads: None,
        inference_mode=nullcontext,
    )
    fake_transformers = SimpleNamespace(
        AutoTokenizer=SimpleNamespace(from_pretrained=lambda *_a, **_k: FakeTokenizer()),
        AutoModelForSeq2SeqLM=SimpleNamespace(from_pretrained=lambda *_a, **_k: FakeModel()),
    )
    monkeypatch.setitem(sys.modules, "torch", fake_torch)
    monkeypatch.setitem(sys.modules, "transformers", fake_transformers)

    engine = M2M100Translator(tmp_path, source_lang="fr", target_lang="sw")
    return engine, tokenizer_calls, generation_calls


def test_m2m100_uses_language_token_and_restores_slots_and_substitutions(tmp_path, monkeypatch):
    engine, tokenizer_calls, generation_calls = fake_m2m_engine(
        tmp_path, monkeypatch, "ca'tÿZZ1ZZ"
    )

    assert engine.translate("Salut {x1}") == "ca'tʉ{x1}"
    assert tokenizer_calls == ["Salut ZZ1ZZ"]
    assert generation_calls[0]["forced_bos_token_id"] == 128088


def test_m2m100_refuses_unknown_replacement_character(tmp_path, monkeypatch):
    engine, _, _ = fake_m2m_engine(tmp_path, monkeypatch, "ca't\ufffd")

    with pytest.raises(EngineRefused, match="jeton inconnu"):
        engine.translate("Salut")


def test_route_loader_passes_m2m100_options(tmp_path, monkeypatch):
    routes = {
        "languages": {"bbj": {"name": "Ghomala"}},
        "translation": {
            "fr>bbj": {
                "enabled": True,
                "engine": "m2m100",
                "path": "ghomala/model",
                "options": {"target_lang": "sw", "num_beams": 1},
            }
        },
    }
    routes_file = tmp_path / "routes.json"
    routes_file.write_text(json.dumps(routes), encoding="utf-8")
    calls = {}

    def factory(path, **options):
        calls["path"] = path
        calls["options"] = options
        return SimpleNamespace(translate=lambda text: text)

    monkeypatch.setitem(engines_module.FACTORIES, "m2m100", factory)

    loaded = load_engines(routes_file, tmp_path)

    assert calls == {
        "path": tmp_path / "ghomala/model",
        "options": {"target_lang": "sw", "num_beams": 1},
    }
    assert "fr>bbj" in loaded.translation


def test_ghomala_tts_normalizes_text_and_tones():
    normalized = normaliser_ghomala_tts("A’b, Pú cyanyə́ ŋkəp!")

    assert normalized.endswith(".")
    assert "\u02bc" in normalized
    assert "\u0259" in normalized


def test_ghomala_tts_refuses_unmasked_digits():
    engine = object.__new__(GhomalaVitsSynthesizer)

    with pytest.raises(ValueError, match="chiffres"):
        engine.synthesize("mon code est 1234")
