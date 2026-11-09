"""Verifie que les tokenizers NLLB se chargent et que les codes de langue existent."""
import os
import sys

os.environ.update(USE_TF="0", USE_FLAX="0", TRANSFORMERS_NO_TF="1", HF_HUB_OFFLINE="1")
from transformers import AutoTokenizer, NllbTokenizerFast  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "models")
for name, src, tgt in (
    ("fotiecodes__Turaco-mt-fr-gh", "fra_Latn", "bbj_Latn"),
    ("fotiecodes__Turaco-NLLB-mt-en-wes", "eng_Latn", "wes_Latn"),
    ("joseph-scripture__nllb-en-ghomala", "eng_Latn", "bbj_Latn"),
):
    path = os.path.join(ROOT, name)
    try:
        if os.path.exists(os.path.join(path, "sentencepiece.bpe.model")):
            tok = AutoTokenizer.from_pretrained(path, use_fast=False)
        else:
            tok = NllbTokenizerFast(tokenizer_file=os.path.join(path, "tokenizer.json"), additional_special_tokens=[tgt])
        tok.src_lang = src
        ids = tok("Bonjour").input_ids
        print("OK", name, type(tok).__name__, "cible", tok.convert_tokens_to_ids(tgt), "unk", tok.unk_token_id, "ids", ids[:6], tok.convert_ids_to_tokens(ids)[:4])
    except Exception as exc:
        print("ECHEC", name, type(exc).__name__, str(exc)[:300])
