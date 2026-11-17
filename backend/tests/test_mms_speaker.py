"""La voix MMS ajustee sur plusieurs locuteurs doit recevoir un numero de voix ; la voix de base (une seule voix) reste inchangee."""
import json
import sys
import types
from types import SimpleNamespace

import pytest

torch = pytest.importorskip("torch")

from app.voice_engines import MmsVitsSynthesizer  # noqa: E402


def fake_model(n_voices, calls):
    class Model:
        config = SimpleNamespace(num_speakers=n_voices, sampling_rate=16000)

        @classmethod
        def from_pretrained(cls, path):
            return cls()

        def eval(self):
            return self

        def __call__(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(waveform=[torch.zeros(1600)])

    return Model


@pytest.fixture
def dossier(tmp_path):
    (tmp_path / "vocab.json").write_text(json.dumps({c: i for i, c in enumerate("abcdefghijklmnoprstuvwxyz '-|")}), encoding="utf-8")
    return tmp_path


def patch(monkeypatch, n_voices, calls):
    fake = types.ModuleType("transformers")  # le moteur fait « from transformers import ... » au chargement : on lui donne un faux module
    fake.VitsModel = fake_model(n_voices, calls)
    fake.AutoTokenizer = SimpleNamespace(from_pretrained=lambda p: lambda text, return_tensors: {"input_ids": text})
    monkeypatch.setitem(sys.modules, "transformers", fake)


def test_multi_voice_model_receives_the_chosen_voice(monkeypatch, dossier):
    calls = []
    patch(monkeypatch, 17, calls)
    MmsVitsSynthesizer(dossier, speaker_id=16).synthesize("di money don go")
    assert calls and all(c["speaker_id"] == 16 for c in calls)


def test_multi_voice_model_without_a_voice_number_is_refused(monkeypatch, dossier):
    patch(monkeypatch, 17, [])
    with pytest.raises(ValueError, match="speaker_id"):
        MmsVitsSynthesizer(dossier)


def test_voice_number_out_of_range_is_refused(monkeypatch, dossier):
    patch(monkeypatch, 17, [])
    with pytest.raises(ValueError, match="hors"):
        MmsVitsSynthesizer(dossier, speaker_id=17)


def test_base_single_voice_model_is_unchanged(monkeypatch, dossier):
    calls = []
    patch(monkeypatch, 1, calls)
    MmsVitsSynthesizer(dossier).synthesize("di money don go")
    assert calls and all("speaker_id" not in c for c in calls)
