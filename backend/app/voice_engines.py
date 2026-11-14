"""Moteurs vocaux interchangeables : reconnaissance (STT) et synthese (TTS).

Les bibliotheques lourdes ne sont importees qu'au chargement d'un moteur : un serveur sans
voix demarre sans onnxruntime ni torch. Un moteur absent rend sa route indisponible, rien de plus.
"""
from __future__ import annotations

import io
import json
import re
import threading
import wave
from pathlib import Path

SAMPLE_RATE = 16_000
_PAUSE = {".": 0.35, "!": 0.35, "?": 0.35, ":": 0.3, ";": 0.3, ",": 0.15}
_SPECIAL = re.compile(r"<[a-z]+>|</s>")  # <s>, <pad>, <unk>, </s> : jamais du texte
_CHUNK = re.compile(r"([^.!?:;,]+)([.!?:;,]?)")


def pcm16_to_wav(pcm: bytes, rate: int = SAMPLE_RATE) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def read_tokens(path: Path) -> list[str]:
    """tokens.txt : une ligne par jeu de symboles, 'symbole numero' ou 'symbole' seul ; l'ordre des lignes donne le numero."""
    tokens: list[str] = []
    for line in path.read_text(encoding="utf-8").split("\n"):
        if not line:
            continue
        head, _, tail = line.rpartition(" ")
        tokens.append(head if head and tail.isdigit() else line)
    return tokens


def ctc_greedy(logits, tokens: list[str], blank: int = 0) -> str:
    """Decodage CTC glouton : meilleur symbole par image, repetitions fusionnees, blancs retires."""
    import numpy as np

    best = np.asarray(logits).argmax(axis=-1)
    out, previous = [], -1
    for i in best.tolist():
        if i != previous and i != blank and i < len(tokens) and not _SPECIAL.fullmatch(tokens[i]):
            out.append(tokens[i])
        previous = i
    return re.sub(r"\s+", " ", "".join(out).replace("▁", " ")).strip()


class OnnxCtcRecognizer:
    """Omnilingual ASR (CTC) exporte en ONNX : l'onde brute entre, des logits sortent. Pas de langue a indiquer."""

    def __init__(self, path: Path, threads: int = 2, normalize: bool = True) -> None:
        import onnxruntime as ort

        files = sorted(path.glob("model*.onnx"), key=lambda p: ("int8" not in p.name, p.name))
        if not files:
            raise FileNotFoundError("modele onnx absent")
        options = ort.SessionOptions()
        options.intra_op_num_threads, options.inter_op_num_threads = threads, 1
        self._session = None
        for model in files:  # la version int8 est la plus legere, mais certaines versions d'onnxruntime n'en gerent pas les convolutions
            try:
                self._session = ort.InferenceSession(str(model), options, providers=["CPUExecutionProvider"])
                break
            except Exception:
                continue
        if self._session is None:
            raise RuntimeError("aucune version du modele n'a pu etre chargee")
        self._input = self._session.get_inputs()[0].name
        self._tokens = read_tokens(path / "tokens.txt")
        self._normalize = normalize

    def transcribe(self, pcm16: bytes) -> str:
        import numpy as np

        wave_f = np.frombuffer(pcm16, dtype="<i2").astype(np.float32) / 32768.0
        if self._normalize and wave_f.size:
            wave_f = (wave_f - wave_f.mean()) / (wave_f.std() + 1e-7)
        logits = self._session.run(None, {self._input: wave_f[None, :]})[0][0]
        return ctc_greedy(logits, self._tokens)


class HfCtcRecognizer:
    """Modele CTC au format transformers (wav2vec2, w2v-BERT, MMS...) : par exemple celui ajuste sur Common Voice (training/stt_pidgin).

    `quantize="int8"` applique la quantification dynamique de torch aux couches Linear : la memoire
    baisse nettement, pour un cout mesure sur 30 phrases SOREVA (voir evaluation/results/stt/).
    """

    def __init__(self, path: Path, threads: int = 2, quantize: str | bool | None = None) -> None:
        import torch
        from transformers import AutoModelForCTC, AutoProcessor

        torch.set_num_threads(threads)
        self._torch = torch
        self._processor = AutoProcessor.from_pretrained(path)
        self._model = AutoModelForCTC.from_pretrained(path).float().eval()
        if quantize in (True, "int8", "int8_dynamic", "dynamic_int8"):
            self._model = torch.quantization.quantize_dynamic(self._model, {torch.nn.Linear}, dtype=torch.qint8)
        self._lock = threading.Lock()

    def transcribe(self, pcm16: bytes) -> str:
        import numpy as np

        wave_f = np.frombuffer(pcm16, dtype="<i2").astype(np.float32) / 32768.0
        if not wave_f.size:
            return ""
        features = self._processor.feature_extractor(wave_f, sampling_rate=SAMPLE_RATE, return_tensors="pt")
        with self._lock, self._torch.inference_mode():
            logits = self._model(**features).logits
        return re.sub(r"\s+", " ", self._processor.batch_decode(logits.argmax(-1))[0]).strip()


class MmsVitsSynthesizer:
    """Voix VITS de Meta (MMS-TTS) ou une version ajustee : un modele charge avec transformers et torch."""

    def __init__(self, path: Path, threads: int = 2, seed: int = 0, speaker_id: int | None = None) -> None:
        import torch
        from transformers import AutoTokenizer, VitsModel

        torch.set_num_threads(threads)
        self._torch = torch
        self._tokenizer = AutoTokenizer.from_pretrained(path)
        self._model = VitsModel.from_pretrained(path).eval()
        # Un modele ajuste sur plusieurs voix demande laquelle utiliser (options.speaker_id de routes.json) ; la voix de base n'en a qu'une.
        n_voices = int(getattr(self._model.config, "num_speakers", 1) or 1)
        if n_voices > 1 and speaker_id is None:
            raise ValueError(f"ce modele a {n_voices} voix : indiquer options.speaker_id dans routes.json")
        if speaker_id is not None and not 0 <= speaker_id < max(n_voices, 1):
            raise ValueError(f"speaker_id {speaker_id} hors des {n_voices} voix du modele")
        self._speaker = speaker_id if n_voices > 1 else None
        self._rate = int(self._model.config.sampling_rate)
        self._vocab = frozenset(json.loads((path / "vocab.json").read_text(encoding="utf-8")))
        self._seed = seed
        self._lock = threading.Lock()  # le bruit du modele vient d'un generateur global : une phrase a la fois

    def _speak(self, text: str):
        clean = re.sub(r"\s+", " ", "".join(c if c in self._vocab else " " for c in text.lower())).strip()
        if not clean:
            return None
        with self._torch.inference_mode():
            extra = {"speaker_id": self._speaker} if self._speaker is not None else {}
            return self._model(**self._tokenizer(clean, return_tensors="pt"), **extra).waveform[0]

    def synthesize(self, text: str) -> bytes:
        import numpy as np

        parts = []
        with self._lock:
            self._torch.manual_seed(self._seed)  # meme texte, meme voix, a chaque fois
            for chunk, mark in _CHUNK.findall(text):
                audio = self._speak(chunk)
                if audio is not None:
                    parts.append(audio.numpy())
                if mark:  # le modele ne lit pas la ponctuation : on la rend par un silence
                    parts.append(np.zeros(int(self._rate * _PAUSE[mark]), dtype=np.float32))
        if not parts:
            raise ValueError("rien a dire")
        samples = np.concatenate(parts)
        return pcm16_to_wav((np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes(), self._rate)


ASR_FACTORIES = {"omnilingual_ctc": OnnxCtcRecognizer, "hf_ctc": HfCtcRecognizer}
TTS_FACTORIES = {"mms_vits": MmsVitsSynthesizer}
