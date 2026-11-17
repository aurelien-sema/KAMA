from types import SimpleNamespace

import numpy as np

from app import llm_engines


def test_chat_completion_stops_at_deadline_with_supported_logits_processor(tmp_path, monkeypatch):
    observed = {}
    ticks = iter((10.0, 9.0, 12.0))
    monkeypatch.setattr(llm_engines.time, "monotonic", lambda: next(ticks))

    class FakeLlama:
        def __init__(self, **_kwargs):
            pass

        def token_eos(self):
            return 2

        def create_chat_completion(self, *, messages, logits_processor, **_kwargs):
            scores = np.array([1.0, 2.0, 3.0], dtype=np.float32)
            before_deadline = logits_processor[0](np.array([], dtype=np.intc), scores.copy())
            after_deadline = logits_processor[0](np.array([], dtype=np.intc), scores.copy())
            observed["before"] = before_deadline
            observed["after"] = after_deadline
            return {"choices": [{"message": {"content": "done"}}]}

    monkeypatch.setitem(__import__("sys").modules, "llama_cpp", SimpleNamespace(Llama=FakeLlama))
    model_path = tmp_path / "fake.gguf"
    model_path.write_bytes(b"model")
    chat = llm_engines.LlamaCppChat(model_path, timeout_s=1)

    assert chat.answer("question", "context") == "done"
    assert observed["before"].tolist() == [1.0, 2.0, 3.0]
    assert observed["after"].tolist() == [float("-inf"), float("-inf"), 0.0]
