"""Fait tourner les modeles de traduction neuronaux sur les jeux de test (CPU).

Usage : python -I run_nmt.py [--only motif] [--smoke] [--wait]
Les sorties vont dans results/<modele>/<jeu>.jsonl ; un jeu deja traite est saute.
"""
import argparse
import gc
import json
import os
import sys
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # dossier de nos scripts, sans fichier telecharge
from cpulock import CpuLock  # noqa: E402

MODELS = os.path.join(os.path.dirname(os.path.dirname(HERE)), "models")  # poids hors du depot
TS = os.path.join(HERE, "testsets")
RES = os.path.join(HERE, "results")
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["USE_TF"] = "0"
os.environ["USE_FLAX"] = "0"
os.environ["TRANSFORMERS_NO_TF"] = "1"
LOG = os.path.join(HERE, "logs", "download.log")
PHASE1 = ("soreva", "probes", "probes_protected")

import torch  # noqa: E402
from transformers import AutoConfig, AutoModelForSeq2SeqLM, AutoTokenizer, MarianTokenizer, NllbTokenizerFast  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
torch.set_num_threads(4)

BEAMS = 3
BATCH = 8


def P(*a):
    return os.path.join(MODELS, *a)


def masa():
    out = []
    for d, (s, t) in {"fr_bbj": ("fr", "bbj"), "bbj_fr": ("bbj", "fr")}.items():
        for v in ("news", "rel", "rel_ft", "rel_news", "rel_news_ft"):
            out.append(dict(id=f"masakhane_m2m_{d}_{v}", path=P(f"masakhane__m2m100_418M_{d}_{v}"), kind="m2m", src=s, tgt=t))
        for a, k in (("byt5", "t5"), ("afribyt5", "t5"), ("mt5", "t5"), ("afrimt5", "t5"), ("mbart50", "mbart"), ("afrimbart", "mbart")):
            out.append(dict(id=f"masakhane_{a}_{d}", path=P(f"masakhane__{a}_{d}_news"), kind=k, src=s, tgt=t, byt=("byt5" in a)))
    return out


INT8 = "flagship-ai__cameroon-int8"
REG = [
    dict(id="flagship_fr_bbj", path=P("flagship-ai__francais-ghomala"), tok=P(INT8, "francais-ghomala"), kind="marian", src="fr", tgt="bbj"),
    dict(id="flagship_bbj_fr", path=P("flagship-ai__ghomala-francais"), tok=P(INT8, "ghomala-francais"), kind="marian", src="bbj", tgt="fr"),
    dict(id="flagship_int8_fr_bbj", path=P(INT8, "francais-ghomala"), kind="ct2", src="fr", tgt="bbj"),
    dict(id="flagship_int8_bbj_fr", path=P(INT8, "ghomala-francais"), kind="ct2", src="bbj", tgt="fr"),
    dict(id="linguo_en_bbj", path=P("DS4H-ICTU__linguo_mt_en_bbj"), kind="marian", src="en", tgt="bbj"),
    dict(id="linguo_bbj_en", path=P("DS4H-ICTU__linguo_mt_bbj_en"), kind="marian", src="bbj", tgt="en"),
    dict(id="stfotso_t5_fr_bbj", path=P("stfotso__t5_tuned_french_ghomala"), tok=P("google-t5__t5-base"), kind="t5", src="fr", tgt="bbj", prefix=""),
    dict(id="ds4h_encdec_en_bbj", path=P("DS4H-ICTU__english-ghomala-translation-model-encoderdecoder"), kind="encdec", src="en", tgt="bbj"),
    dict(id="turaco_fr_bbj", path=P("fotiecodes__Turaco-mt-fr-gh"), kind="nllb", src="fr", tgt="bbj"),
    dict(id="joseph_nllb_en_bbj", path=P("joseph-scripture__nllb-en-ghomala"), kind="nllb", src="en", tgt="bbj"),
    dict(id="turaco_nllb_en_wes", path=P("fotiecodes__Turaco-NLLB-mt-en-wes"), kind="nllb", src="en", tgt="wes"),
    dict(id="jamm55_en_pcm_nigerian", path=P("jamm55__autotrain-improved-pidgin-model-2837583189"), kind="marian", src="en", tgt="wes"),
    dict(id="opus_fr_en", path=P("Helsinki-NLP__opus-mt-fr-en"), kind="marian", src="fr", tgt="en", pivot=True),
    dict(id="opus_en_fr", path=P("Helsinki-NLP__opus-mt-en-fr"), kind="marian", src="en", tgt="fr", pivot=True),
] + masa()

# Selection de 20 modeles ; les 4 modeles GGUF sont testes a part avec llama.cpp.
SELECTED = {
    "flagship_int8_fr_bbj", "turaco_fr_bbj", "stfotso_t5_fr_bbj",
    "masakhane_m2m_fr_bbj_rel_ft", "masakhane_m2m_fr_bbj_rel_news_ft", "masakhane_m2m_fr_bbj_news",
    "flagship_int8_bbj_fr", "masakhane_m2m_bbj_fr_rel_news_ft", "masakhane_m2m_bbj_fr_rel_news", "masakhane_m2m_bbj_fr_news",
    "linguo_en_bbj", "joseph_nllb_en_bbj", "ds4h_encdec_en_bbj", "linguo_bbj_en",
    "turaco_nllb_en_wes", "jamm55_en_pcm_nigerian",
}
REG = [s for s in REG if s["id"] in SELECTED]

NLLB = {"fr": "fra_Latn", "en": "eng_Latn", "bbj": "bbj_Latn", "wes": "wes_Latn"}
NAME = {"fr": "French", "en": "English", "bbj": "Ghomala", "wes": "Pidgin"}
MBART = {"fr": "fr_XX"}


def rows(name):
    with open(os.path.join(TS, name), encoding="utf-8") as f:
        return [json.loads(x) for x in f if x.strip()]


def testsets(s):
    """(nom, [(source, reference)]) pour le sens du modele."""
    a, b, out = s["src"], s["tgt"], []
    if s.get("pivot"):
        return out
    sor = rows("soreva_aligned.jsonl")
    out.append(("soreva", [(r[a], r[b]) for r in sor]))
    if a in ("fr", "en") and b in ("bbj", "wes"):
        p = rows("banking_probes.jsonl")
        out.append(("probes", [(r[a], "") for r in p]))
        out.append(("probes_protected", [(r[a + "_protected"], "") for r in p]))
    if {a, b} == {"fr", "bbj"}:
        out.append(("mafand200", [(r[a], r[b]) for r in rows("bbj_mafand_test200.jsonl")]))
    if {a, b} == {"en", "bbj"}:
        out.append(("bible100", [(r[a], r[b]) for r in rows("bible_sample100.jsonl")]))
    if {a, b} == {"en", "wes"} and os.path.exists(os.path.join(TS, "wes_heldout.jsonl")):
        out.append(("wes_heldout", [(r[a], r[b]) for r in rows("wes_heldout.jsonl")]))
    if s["id"].startswith("masakhane"):
        t = rows("bbj_mafand_test.jsonl")[:30]
        out.append(("mafand_repro30", [(r[a], r[b]) for r in t]))
    return out


def load(s):
    if s["kind"] == "ct2":
        import ctranslate2

        tok = MarianTokenizer.from_pretrained(s["path"])
        tr = ctranslate2.Translator(s["path"], device="cpu", compute_type="int8", inter_threads=1, intra_threads=4)

        def run(texts):
            src = [tok.convert_ids_to_tokens(tok.encode(t)) for t in texts]
            res = tr.translate_batch(src, beam_size=BEAMS, max_decoding_length=128, max_batch_size=BATCH)
            return [tok.decode(tok.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=True) for r in res]

        return run

    tp = s.get("tok", s["path"])
    if s["kind"] == "marian":
        tok = MarianTokenizer.from_pretrained(tp)
    elif s["kind"] == "nllb" and os.path.exists(os.path.join(tp, "sentencepiece.bpe.model")):
        # Le tokenizer lent evite la conversion, qui depend d'une version precise de protobuf.
        tok = AutoTokenizer.from_pretrained(tp, use_fast=False)
    elif s["kind"] == "nllb":
        # Sa configuration vient d'une version de transformers plus recente : on lit tokenizer.json directement.
        tok = NllbTokenizerFast(tokenizer_file=os.path.join(tp, "tokenizer.json"), additional_special_tokens=[NLLB[s["tgt"]]])
    else:
        tok = AutoTokenizer.from_pretrained(tp)
    model = AutoModelForSeq2SeqLM.from_pretrained(s["path"], dtype=torch.float32, low_cpu_mem_usage=True).eval()
    cfg = AutoConfig.from_pretrained(s["path"])
    gen, prefix = {}, s.get("prefix", "")
    k = s["kind"]
    if k == "nllb":
        tok.src_lang = NLLB[s["src"]]
        gen["forced_bos_token_id"] = tok.convert_tokens_to_ids(NLLB[s["tgt"]])
    elif k in ("m2m", "mbart"):
        fb = 128088 if k == "m2m" and s["tgt"] == "bbj" else cfg.forced_bos_token_id  # rel_ft est livre avec le code du francais
        code = tok.convert_ids_to_tokens(fb)
        if s["src"] == "fr":
            tok.src_lang = "fr" if k == "m2m" else MBART["fr"]
        else:  # le ghomala emprunte un code de langue de substitution
            alt = json.load(open(s["path"].replace("_bbj_fr", "_fr_bbj") + os.sep + "config.json"))["forced_bos_token_id"] if os.path.exists(s["path"].replace("_bbj_fr", "_fr_bbj")) else None
            sub = tok.convert_ids_to_tokens(alt) if alt else None
            tok.src_lang = sub.strip("_") if k == "m2m" and sub else (sub or "fr_XX")
        gen["forced_bos_token_id"] = fb
        print("   code cible", code, "| source", tok.src_lang)
    elif k == "t5" and "prefix" not in s:
        prefix = f"translate {NAME[s['src']]} to {NAME[s['tgt']]}: "
    max_new = 384 if s.get("byt") else 128

    def run(texts):
        order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
        out = [""] * len(texts)
        for i in range(0, len(order), BATCH):
            idx = order[i : i + BATCH]
            enc = tok([prefix + texts[j] for j in idx], return_tensors="pt", padding=True, truncation=True, max_length=256)
            # Un modele qui s'emballe sur une phrase courte coute tres cher sur CPU.
            # Le plafond reste assez large pour que la sortie soit reperee comme degeneree.
            cap = min(max_new, 3 * int(enc["attention_mask"].sum(1).max()) + 24)
            with torch.inference_mode():
                ids = model.generate(**enc, num_beams=BEAMS, max_new_tokens=cap, **gen)
            for j, t in zip(idx, tok.batch_decode(ids, skip_special_tokens=True)):
                out[j] = t.strip()
        return out

    return run


def finished_repos():
    """Depots que download_models.py a annonces OK dans son journal."""
    done, cur = set(), None
    if os.path.exists(LOG):
        for line in open(LOG, encoding="utf-8", errors="replace"):
            if " essai " in line and line.startswith("["):
                cur = line.split("] ", 1)[1].split(" essai ")[0].replace("/", "__")
            elif line.strip().startswith("OK ") and cur:
                done.add(cur)
    return done


def ready(s, done):
    rel = os.path.relpath(s["path"], MODELS).split(os.sep)[0]
    return rel in done and os.path.isdir(s["path"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--phase", type=int, default=0, help="1 : tests courts, 2 : corpus longs, 0 : tout")
    a = ap.parse_args()
    done = finished_repos()
    lock = CpuLock()
    for s in REG:
        if a.only and a.only not in s["id"]:
            continue
        d = os.path.join(RES, s["id"] + ("_smoke" if a.smoke else ""))
        if not ready(s, done):
            continue
        if os.path.exists(os.path.join(d, "ERROR.txt")) or s.get("pivot"):
            continue
        sets = testsets(s)
        if a.phase == 1:
            sets = [x for x in sets if x[0] in PHASE1]
        elif a.phase == 2:
            sets = [x for x in sets if x[0] not in PHASE1]
        todo = [(n, x) for n, x in sets if not os.path.exists(os.path.join(d, n + ".jsonl"))]
        if not todo:
            continue
        os.makedirs(d, exist_ok=True)
        print(f"[{time.strftime('%H:%M:%S')}] {s['id']}")
        lock.acquire()
        try:
            t0 = time.time()
            run = load(s)
            print(f"   charge en {time.time() - t0:.0f} s")
            for n, x in todo:
                x = x[:4] if a.smoke else x
                t1 = time.time()
                hyp = run([q for q, _ in x])
                dt = time.time() - t1
                with open(os.path.join(d, n + ".jsonl"), "w", encoding="utf-8") as f:
                    for (q, r), h in zip(x, hyp):
                        f.write(json.dumps({"src": q, "ref": r, "hyp": h}, ensure_ascii=False) + "\n")
                print(f"   {n}: {len(x)} phrases, {dt:.0f} s ({dt / len(x):.2f} s/phrase)")
                if a.smoke:
                    print("    ", hyp)
            del run
        except Exception:
            print("   ECHEC", traceback.format_exc()[-1500:])
            with open(os.path.join(d, "ERROR.txt"), "w", encoding="utf-8") as f:
                f.write(traceback.format_exc())
        finally:
            gc.collect()
            lock.release()


if __name__ == "__main__":
    main()
