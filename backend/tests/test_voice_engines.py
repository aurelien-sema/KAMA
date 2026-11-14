"""Voix : enregistrements valides avant le modele, intentions approchantes, moteurs absents."""
import io
import json
import sys
import wave
from contextlib import nullcontext
from types import SimpleNamespace

import numpy as np

from app.clips import ClipLibrary, piece_key, split_pieces
from app.engines import EngineSet, load_engines
from app.voice_engines import HfCtcRecognizer, ctc_greedy, pcm16_to_wav, read_tokens
from conftest import FakeRecognizer, FakeSynth, engines_with, wav_bytes


def intent(client, lang="wes"):
    r = client.post("/v1/voice/intent", content=wav_bytes(), headers={"X-Kama-Lang": lang, "Content-Type": "audio/wav"})
    return r.json()


def library(tmp_path, clips, validated="locuteur de test"):
    folder = tmp_path / "wes"
    folder.mkdir()
    items = []
    for i, text in enumerate(clips):
        (folder / f"c{i}.wav").write_bytes(wav_bytes(0.5))
        items.append({"id": f"c{i}", "text": text, "file": f"c{i}.wav", "validated_by": validated})
    (folder / "manifest.json").write_text(json.dumps({"clips": items}), encoding="utf-8")
    return ClipLibrary.load(folder)


def tts(client, text, lang="wes"):
    return client.post("/v1/tts", json={"text": text, "lang": lang})


def with_clips(lib, tts_engine=None):
    engines = engines_with(tts={"wes": tts_engine} if tts_engine else None)
    engines.clips["wes"] = lib
    return engines


# --- intentions -------------------------------------------------------------------------------------------------

def test_misrecognised_letters_still_match(make_client):
    r = intent(make_client(engines_with(asr={"wes": FakeRecognizer("how mosh money i get")})))
    assert r["intent"] == "ask_balance" and 0.85 <= r["confidence"] < 1.0


def test_a_vague_sentence_is_not_guessed(make_client):
    assert intent(make_client(engines_with(asr={"wes": FakeRecognizer("how much")})))["intent"] == "unknown"


def test_a_single_word_is_never_guessed(make_client):
    assert intent(make_client(engines_with(asr={"wes": FakeRecognizer("agen")})))["intent"] == "unknown"


def test_two_close_intentions_give_unknown(make_client):
    # "how much go comot" et "na how much dem go take" partagent des mots : sans ecart net, on ne devine pas
    assert intent(make_client(engines_with(asr={"wes": FakeRecognizer("how much dem go comot")})))["intent"] == "unknown"


def test_amount_said_aloud_is_not_returned(make_client):
    r = intent(make_client(engines_with(asr={"wes": FakeRecognizer("how much money i get 25000 Paul")})))
    assert r == {"intent": "ask_balance", "confidence": 1.0}


# --- enregistrements --------------------------------------------------------------------------------------------

def test_recorded_text_is_served_without_the_model(make_client, tmp_path):
    synth = FakeSynth()
    client = make_client(with_clips(library(tmp_path, ["Send money"]), synth))
    r = tts(client, "send money!").json()
    assert [(s["type"], s.get("origin")) for s in r["segments"]] == [("audio", "recorded")]
    assert synth.calls == []


def test_unrecorded_text_goes_to_the_model_and_is_marked(make_client, tmp_path):
    synth = FakeSynth()
    client = make_client(with_clips(library(tmp_path, ["Send money"]), synth))
    r = tts(client, "Check di name").json()
    assert [s["origin"] for s in r["segments"]] == ["synthetic"] and synth.calls == ["Check di name"]


def test_recorded_and_synthetic_pieces_around_a_slot(make_client, tmp_path):
    synth = FakeSynth()
    client = make_client(with_clips(library(tmp_path, ["Dem go take"]), synth))
    r = tts(client, "Dem go take {x1} for charge").json()
    assert [(s["type"], s.get("origin")) for s in r["segments"]] == [("audio", "recorded"), ("slot", None), ("audio", "synthetic")]
    assert synth.calls == ["for charge"]


def test_clips_alone_make_tts_available_for_what_was_recorded(make_client, tmp_path):
    client = make_client(with_clips(library(tmp_path, ["Send money"])))
    assert tts(client, "Send money").status_code == 200
    r = tts(client, "Another sentence")
    assert r.status_code == 503 and r.json()["error"]["code"] == "tts_unavailable"
    wes = next(lang for lang in client.get("/v1/capabilities").json()["languages"] if lang["code"] == "wes")
    assert wes["tts"] is True


def test_clip_not_validated_is_never_served(tmp_path):
    assert len(library(tmp_path, ["Send money"], validated=None)) == 0


def test_bad_clips_are_skipped_not_fatal(tmp_path):
    folder = tmp_path / "wes"
    folder.mkdir()
    (folder / "ok.wav").write_bytes(wav_bytes(0.5))
    (folder / "slow.wav").write_bytes(wav_bytes(0.5, rate=44100))
    (tmp_path / "outside.wav").write_bytes(wav_bytes(0.5))
    items = [
        {"id": "ok", "text": "Send money", "file": "ok.wav", "validated_by": "x"},
        {"id": "rate", "text": "Wrong rate", "file": "slow.wav", "validated_by": "x"},
        {"id": "out", "text": "Outside folder", "file": "../outside.wav", "validated_by": "x"},
        {"id": "digit", "text": "Send 500", "file": "ok.wav", "validated_by": "x"},
        {"id": "slot", "text": "Send {x1}", "file": "ok.wav", "validated_by": "x"},
        {"id": "missing", "text": "Nothing here", "file": "gone.wav", "validated_by": "x"},
    ]
    (folder / "manifest.json").write_text(json.dumps({"clips": items}), encoding="utf-8")
    lib = ClipLibrary.load(folder)
    assert len(lib) == 1 and lib.find("send money") is not None


def test_no_folder_gives_an_empty_library(tmp_path):
    assert len(ClipLibrary.load(tmp_path / "absent")) == 0


def test_same_cut_for_serving_and_for_recording():
    assert split_pieces("Dem go take {x1} for charge. E no fit under {x2}") == ["Dem go take", "for charge. E no fit under"]
    assert piece_key("  Send   MONEY! ") == piece_key("send money")


# --- moteurs ----------------------------------------------------------------------------------------------------

def test_ctc_greedy_merges_repeats_and_drops_blanks():
    tokens = ["<s>", "h", "i", " ", "o"]
    frames = [1, 1, 0, 2, 2, 3, 0, 4, 4]  # h h _ i i ' ' _ o o
    logits = np.eye(len(tokens))[frames]
    assert ctc_greedy(logits, tokens) == "hi o"


def test_tokens_file_with_and_without_numbers(tmp_path):
    (tmp_path / "a.txt").write_text("<s> 0\nhi 1\n  2\n", encoding="utf-8")
    (tmp_path / "b.txt").write_text("<s>\nhi\n", encoding="utf-8")
    assert read_tokens(tmp_path / "a.txt") == ["<s>", "hi", " "]
    assert read_tokens(tmp_path / "b.txt") == ["<s>", "hi"]


def test_wav_written_for_a_segment_is_readable():
    with wave.open(io.BytesIO(pcm16_to_wav(b"\0\0" * 1600))) as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()) == (1, 2, 16000, 1600)


def test_hf_ctc_warms_the_model_before_serving_requests(tmp_path, monkeypatch):
    calls = []

    class FakeProcessor:
        def feature_extractor(self, wave_f, **_kwargs):
            return {"input_values": wave_f}

        def batch_decode(self, _tokens):
            return [""]

    class FakeModel:
        def float(self):
            return self

        def eval(self):
            return self

        def __call__(self, **_features):
            calls.append(True)
            return SimpleNamespace(logits=np.zeros((1, 1, 2), dtype=np.float32))

    fake_torch = SimpleNamespace(
        set_num_threads=lambda _threads: None,
        inference_mode=nullcontext,
    )
    fake_transformers = SimpleNamespace(
        AutoProcessor=SimpleNamespace(from_pretrained=lambda _path: FakeProcessor()),
        AutoModelForCTC=SimpleNamespace(from_pretrained=lambda _path: FakeModel()),
    )
    monkeypatch.setitem(sys.modules, "torch", fake_torch)
    monkeypatch.setitem(sys.modules, "transformers", fake_transformers)

    HfCtcRecognizer(tmp_path)

    assert len(calls) == 1


def test_missing_voice_models_do_not_stop_the_server(tmp_path):
    routes = {
        "languages": {"wes": {"name": "Pidgin"}},
        "translation": {},
        "asr": {"wes": {"enabled": True, "engine": "omnilingual_ctc", "path": "absent"}},
        "tts": {"wes": {"enabled": True, "engine": "mms_vits", "path": "absent"}},
    }
    (tmp_path / "routes.json").write_text(json.dumps(routes), encoding="utf-8")
    engines = load_engines(tmp_path / "routes.json", tmp_path)
    assert isinstance(engines, EngineSet) and engines.asr == {} and engines.tts == {}


def test_disabled_voice_routes_are_not_loaded(tmp_path):
    routes = {"languages": {"wes": {"name": "P"}}, "translation": {}, "asr": {"wes": {"enabled": False, "engine": "nope", "path": "x"}}, "tts": {}}
    (tmp_path / "routes.json").write_text(json.dumps(routes), encoding="utf-8")
    assert load_engines(tmp_path / "routes.json", tmp_path).asr == {}


# --- origine des clips et catalogue livre ------------------------------------------------------------------------

def test_synthetic_clip_keeps_its_origin(make_client, tmp_path):
    folder = tmp_path / "wes"
    folder.mkdir()
    (folder / "a.wav").write_bytes(wav_bytes(0.5))
    item = {"id": "a", "text": "Send money", "file": "a.wav", "validated_by": "x", "origin": "synthetic"}
    (folder / "manifest.json").write_text(json.dumps({"clips": [item]}), encoding="utf-8")
    client = make_client(with_clips(ClipLibrary.load(folder)))
    assert [s["origin"] for s in tts(client, "Send money").json()["segments"]] == ["synthetic"]


def test_unknown_clip_origin_is_ignored(tmp_path):
    folder = tmp_path / "wes"
    folder.mkdir()
    (folder / "a.wav").write_bytes(wav_bytes(0.5))
    item = {"id": "a", "text": "Send money", "file": "a.wav", "validated_by": "x", "origin": "robot"}
    (folder / "manifest.json").write_text(json.dumps({"clips": [item]}), encoding="utf-8")
    assert len(ClipLibrary.load(folder)) == 0


def test_shipped_catalogue_is_served_and_speakable():
    from pathlib import Path

    from app.memory import TranslationMemory, _load_page

    content = Path(__file__).resolve().parents[2] / "content-data"
    memory = TranslationMemory.from_file(content / "templates.json", 0.86, content / "safinum_test_page.json")
    assert memory.find_exact("Frais", "fr", "wes") == "Charge"  # premiere validation d'un locuteur enregistree
    templates, patterns = _load_page(content / "safinum_test_page.json")
    texts = [t.translations["wes"] for t in templates if "wes" in t.translations] + [p.translations["wes"] for p in patterns if "wes" in p.translations]
    assert len(texts) >= 70
    for text in texts:  # ce que /v1/tts recevra : jamais un chiffre, seulement des balises
        assert not any(c.isdigit() for p in split_pieces(text) for c in p), text


def test_punctuation_after_a_slot_is_not_spoken(make_client, tmp_path):
    synth = FakeSynth()
    client = make_client(with_clips(library(tmp_path, ["Dem go take"]), synth))
    r = tts(client, "Dem go take {x1}.").json()
    assert [(s["type"], s.get("origin")) for s in r["segments"]] == [("audio", "recorded"), ("slot", None)]
    assert synth.calls == []
