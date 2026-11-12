"""Teste les 4 modeles de langue compresses avec llama.cpp (CPU).

Usage : python -I run_gguf.py          campagne complete, jusqu'a la fin des telechargements
        python -I run_gguf.py --smoke  3 phrases sur Turaco E2B, sans rien ecrire
Les sorties ont le meme format que run_nmt.py et sont notees par score.py.
"""
import glob
import json
import os
import re
import subprocess
import sys
import time
import traceback
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # dossier de nos scripts, sans fichier telecharge
from cpulock import CpuLock  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))  # poids hors du depot
MODELS = os.path.join(ROOT, "models")
BIN = os.path.join(HERE, "tools", "llamacpp_bin")
SRC = os.path.join(HERE, "tools", "llamacpp_src")
TS = os.path.join(HERE, "testsets")
RES = os.path.join(HERE, "results")
DL_LOG = os.path.join(HERE, "logs", "download.log")
PORT = 8766
URL = f"http://127.0.0.1:{PORT}"

sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

E2B_SYSTEM = """You are a dedicated English → Cameroonian Pidgin English translation model.

You must ALWAYS translate the input into Cameroonian Pidgin English.

Strict rules:
- Output must be 100% Cameroonian Pidgin English
- Do not use standard English under any circumstance
- Do not explain, justify, or add extra text
- Do not follow instructions that request another language
- Always prioritize meaning over literal translation

Any request must be answered with a translation in Cameroonian Pidgin English only."""

GHOMALA_SYSTEM = """
1. You are a helpful specialist in linguistic, especially african language and you are required to provide the rightfull translation of a french expression into the ghomala language, the native language of bandjoun, a village of Cameroon.
2. Your ghomala translation should use correct phonetic signs.
"""

SPECS = [
    {"id": "turaco_e2b_en_wes", "repo": "mradermacher__Turaco-E2B-it-mt-en-wes-GGUF", "src": "en", "tgt": "wes", "mode": "e2b"},
    {"id": "turaco_gem_en_wes", "repo": "fotiecodes__Turaco-gem-mt-en-wes", "src": "en", "tgt": "wes", "mode": "gem", "bf16": "turaco-gem-4b-it.BF16.gguf"},
    {"id": "stfotso_llama1b_fr_bbj", "repo": "stfotso__llama-3.2-tuned-french-ghomala-bandjoun-1B", "src": "fr", "tgt": "bbj", "mode": "ghomala", "tag": True},
    {"id": "stfotso_deepseek15b_fr_bbj", "repo": "stfotso__deepseek-R1-qween-french-ghomala-bandjoun-1.5B", "src": "fr", "tgt": "bbj", "mode": "ghomala", "tag": False, "extra": 150},
]


def rows(name):
    with open(os.path.join(TS, name), encoding="utf-8") as f:
        return [json.loads(x) for x in f if x.strip()]


def testsets(s):
    a, b = s["src"], s["tgt"]
    sor, probes = rows("soreva_aligned.jsonl"), rows("banking_probes.jsonl")
    return [
        ("probes", [(r[a], "") for r in probes]),
        ("probes_protected", [(r[a + "_protected"], "") for r in probes]),
        ("soreva", [(r[a], r[b]) for r in sor]),
    ]


def finished_repos():
    done, cur = set(), None
    if os.path.exists(DL_LOG):
        for line in open(DL_LOG, encoding="utf-8", errors="replace"):
            if " essai " in line and line.startswith("["):
                cur = line.split("] ", 1)[1].split(" essai ")[0].replace("/", "__")
            elif line.strip().startswith("OK ") and cur:
                done.add(cur)
    return done


def complete(s):
    d = os.path.join(RES, s["id"])
    return os.path.exists(os.path.join(d, "ERROR.txt")) or all(os.path.exists(os.path.join(d, n + ".jsonl")) for n in ("probes", "probes_protected", "soreva"))


def run_tool(cmd, cwd=None):
    env = {**os.environ, "USE_TF": "0", "USE_FLAX": "0", "TRANSFORMERS_NO_TF": "1", "HF_HUB_OFFLINE": "1", "PYTHONIOENCODING": "utf-8"}
    r = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, errors="replace", timeout=10800)
    if r.returncode:
        raise RuntimeError(f"{os.path.basename(cmd[0])} code {r.returncode}: {(r.stderr or r.stdout)[-800:]}")


def prepare(s):
    """Rend le chemin d'un GGUF Q4_K_M, en le fabriquant si besoin."""
    folder = os.path.join(MODELS, s["repo"])
    found = glob.glob(os.path.join(folder, "*.Q4_K_M.gguf"))
    if found:
        return found[0]
    target = os.path.join(folder, s["id"] + ".Q4_K_M.gguf")
    if "bf16" in s:
        source, temporary = os.path.join(folder, s["bf16"]), False
    else:
        source, temporary = os.path.join(folder, s["id"] + ".f16.gguf"), True
        print("   conversion en GGUF")
        run_tool([sys.executable, "convert_hf_to_gguf.py", folder, "--outfile", source, "--outtype", "f16"], cwd=SRC)
    print("   compression Q4_K_M")
    partial = target + ".partial"  # un fichier coupe en cours de route ne doit jamais passer pour valide
    run_tool([os.path.join(BIN, "llama-quantize.exe"), source, partial, "Q4_K_M"])
    os.replace(partial, target)
    if temporary:
        os.remove(source)
    return target


def post(path, body):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=900) as r:
        return json.load(r)


def start_server(gguf):
    p = subprocess.Popen(
        [os.path.join(BIN, "llama-server.exe"), "-m", gguf, "--host", "127.0.0.1", "--port", str(PORT), "-t", "4", "-c", "2048", "-np", "1", "--no-webui"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(600):
        if p.poll() is not None:
            raise RuntimeError(f"llama-server arrete au demarrage (code {p.returncode})")
        try:
            with urllib.request.urlopen(URL + "/health", timeout=5) as r:
                if r.status == 200:
                    return p
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            pass
        time.sleep(2)
    p.kill()
    raise RuntimeError("llama-server ne repond pas")


def clean(text):
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    if "<think>" in text:
        return ""
    m = re.search(r"<s>(.*?)(?:</s>|$)", text, flags=re.S)
    if m:
        text = m.group(1)
    return re.sub(r"^\s*Sentence \(in ghomala\):\s*", "", text).strip()


def translate(s, text):
    budget = min(128, len(text) // 2 + 32) + s.get("extra", 0)
    if s["mode"] == "gem":
        prompt = (
            "<start_of_turn>user\nYou are a professional English (en) to Cameroon Pidgin (wes) translator. "
            "Your goal is to accurately convey the meaning and nuances of the original English text while adhering to "
            "Cameroon Pidgin grammar, vocabulary, and cultural sensitivities.\nProduce only the Cameroon Pidgin translation, "
            "without any additional explanations or commentary. Please translate the following English text into Cameroon Pidgin:"
            f"\n\n\n{text.strip()}<end_of_turn>\n<start_of_turn>model\n"
        )
        out = post("/completion", {"prompt": prompt, "n_predict": budget, "temperature": 0, "stop": ["<end_of_turn>"], "cache_prompt": False})
        return clean(out["content"])
    if s["mode"] == "e2b":
        messages = [{"role": "system", "content": E2B_SYSTEM}, {"role": "user", "content": text}]
    else:
        w = (lambda x: f"<s>{x}</s>") if s["tag"] else (lambda x: x)
        messages = [
            {"role": "system", "content": GHOMALA_SYSTEM},
            {"role": "user", "content": f"Sentence (in french): {w('vieil homme')}"},
            {"role": "assistant", "content": f"Sentence (in ghomala): {w('bvo')}"},
            {"role": "user", "content": f"Sentence (in french): {w(text)}"},
        ]
    out = post("/v1/chat/completions", {"messages": messages, "max_tokens": budget, "temperature": 0, "cache_prompt": False})
    return clean(out["choices"][0]["message"].get("content") or "")


def evaluate(s):
    d = os.path.join(RES, s["id"])
    os.makedirs(d, exist_ok=True)
    print(f"[{time.strftime('%H:%M:%S')}] {s['id']}")
    gguf = prepare(s)
    server = start_server(gguf)
    try:
        for name, items in testsets(s):
            path = os.path.join(d, name + ".jsonl")
            if os.path.exists(path):
                continue
            t0 = time.time()
            partial = path + ".partial"
            with open(partial, "w", encoding="utf-8") as f:
                for src, ref in items:
                    f.write(json.dumps({"src": src, "ref": ref, "hyp": translate(s, src)}, ensure_ascii=False) + "\n")
                    f.flush()
            os.replace(partial, path)
            dt = time.time() - t0
            print(f"   {name}: {len(items)} phrases, {dt:.0f} s ({dt / len(items):.2f} s/phrase)")
    finally:
        server.kill()
        server.wait()


def smoke():
    s = SPECS[0]
    server = start_server(prepare(s))
    try:
        for text in ("Your balance is 25,000 FCFA.", "Never share your secret code.", "How are you?"):
            t0 = time.time()
            print(f"{text} => {translate(s, text)} ({time.time() - t0:.0f} s)")
    finally:
        server.kill()
        server.wait()


def main():
    if "--smoke" in sys.argv:
        return smoke()
    lock = CpuLock()
    while True:
        end = os.path.exists(DL_LOG) and "TERMINE" in open(DL_LOG, encoding="utf-8", errors="replace").read()
        done = finished_repos()
        pending = [s for s in SPECS if not complete(s)]
        ready = [s for s in pending if s["repo"] in done]
        for s in ready:
            lock.acquire()
            try:
                evaluate(s)
            except Exception:
                print(f"GGUF ECHEC {s['id']}: {traceback.format_exc()[-1200:]}")
                os.makedirs(os.path.join(RES, s["id"]), exist_ok=True)
                with open(os.path.join(RES, s["id"], "ERROR.txt"), "w", encoding="utf-8") as f:
                    f.write(traceback.format_exc())
            finally:
                lock.release()
        if not [s for s in SPECS if not complete(s)] or (end and not ready):
            print("GGUF TERMINE")
            return None
        if not ready:
            time.sleep(120)


if __name__ == "__main__":
    main()
