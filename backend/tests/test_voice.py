import base64

from conftest import FakeRecognizer, FakeSynth, engines_with, wav_bytes


def voice(client, audio, lang="bbj", content_type="audio/wav"):
    return client.post("/v1/voice/intent", content=audio, headers={"X-Kama-Lang": lang, "Content-Type": content_type})


def test_intent_only_never_the_amount(make_client):
    client = make_client(engines_with(asr={"bbj": FakeRecognizer("ma solde kama 25000 Paul")}))
    r = voice(client, wav_bytes())
    assert r.json() == {"intent": "ask_balance", "confidence": 1.0}
    assert "25000" not in r.text and "Paul" not in r.text


def test_unknown_intent(make_client):
    assert voice(make_client(engines_with(asr={"bbj": FakeRecognizer("autre chose")})), wav_bytes()).json()["intent"] == "unknown"


def test_asr_unavailable(client):
    r = voice(client, wav_bytes())
    assert r.status_code == 503 and r.json()["error"]["code"] == "asr_unavailable"


def test_only_pcm_16k_mono_is_accepted(make_client):
    client = make_client(engines_with(asr={"bbj": FakeRecognizer("x")}))
    assert voice(client, wav_bytes(rate=44100)).status_code == 415
    assert voice(client, wav_bytes(channels=2)).status_code == 415
    assert voice(client, b"not a wav file").status_code == 415
    assert voice(client, wav_bytes(), content_type="audio/webm").status_code == 415


def test_duration_limits(make_client):
    client = make_client(engines_with(asr={"bbj": FakeRecognizer("x")}))
    assert voice(client, wav_bytes(seconds=0.05)).status_code == 422


def test_audio_over_the_limit_is_cut(make_client):
    client = make_client(engines_with(asr={"bbj": FakeRecognizer("x")}))
    assert voice(client, wav_bytes(seconds=31)).status_code == 413


def test_tts_leaves_numbers_to_the_extension(make_client):
    synth = FakeSynth()
    client = make_client(engines_with(tts={"bbj": synth}))
    r = client.post("/v1/tts", json={"text": "ywə {x1} tsə {x2}", "lang": "bbj"}).json()
    assert [s["type"] for s in r["segments"]] == ["audio", "slot", "audio", "slot"]
    assert [s["name"] for s in r["segments"] if s["type"] == "slot"] == ["x1", "x2"]
    assert synth.calls == ["ywə", "tsə"]
    assert base64.b64decode(r["segments"][0]["data"]) == b"WAV"


def test_tts_refuses_digits(make_client):
    synth = FakeSynth()
    r = make_client(engines_with(tts={"bbj": synth})).post("/v1/tts", json={"text": "ywə 25000", "lang": "bbj"})
    assert r.status_code == 422 and synth.calls == []


def test_tts_unavailable(client):
    assert client.post("/v1/tts", json={"text": "ywə", "lang": "bbj"}).status_code == 503
