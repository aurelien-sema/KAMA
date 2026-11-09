"""Telecharge les poids des modeles de traduction dans models/ a la racine du projet, hors du depot KAMA (reprise automatique)."""
import fnmatch
import os
import socket
import sys
import time

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "models")
os.environ["HF_HOME"] = os.path.join(ROOT, ".hf_cache")
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["HF_HUB_DISABLE_XET"] = "1"  # le transfert Xet a echoue plusieurs fois sur cette connexion

from huggingface_hub import HfApi, snapshot_download  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

AUX = [
    "config.json", "generation_config.json", "tokenizer*", "vocab.json", "vocab.txt", "merges.txt", "*.spm", "spiece.model",
    "sentencepiece.bpe.model", "special_tokens_map.json", "added_tokens.json", "chat_template*", "README.md", "all_results.json",
    "predict_results.json", "eval_results.json", "generated_predictions.txt", "internal_test_*", "split_manifest.csv",
    "data_audit.json", "*.index.json",
]
M = "masakhane/"
# Les 3 meilleurs BLEU publies par Masakhane sur le test officiel, pour chaque sens.
MASA_TOP = [f"m2m100_418M_fr_bbj_{v}" for v in ("rel_ft", "rel_news_ft", "news")]
MASA_TOP += [f"m2m100_418M_bbj_fr_{v}" for v in ("rel_news_ft", "rel_news", "news")]

# (depot, motifs imposes ou None pour le choix automatique des poids)
JOBS = [
    ("flagship-ai/cameroon-int8", ["francais-ghomala/*", "ghomala-francais/*", "README.md"]),
    ("google-t5/t5-base", ["spiece.model", "tokenizer*", "special_tokens_map.json"]),
    ("mradermacher/english-ghomala-translation-model-t5-GGUF", ["*.Q8_0.gguf", "README.md"]),
    ("flagship-ai/francais-ghomala", None),
    ("flagship-ai/ghomala-francais", None),
    ("DS4H-ICTU/linguo_mt_en_bbj", None),
    ("DS4H-ICTU/linguo_mt_bbj_en", None),
    ("jamm55/autotrain-improved-pidgin-model-2837583189", None),
    ("Helsinki-NLP/opus-mt-fr-en", None),
    ("Helsinki-NLP/opus-mt-en-fr", None),
    ("stfotso/t5_tuned_french_ghomala", None),
    ("DS4H-ICTU/english-ghomala-translation-model-encoderdecoder", None),
    ("fotiecodes/Turaco-mt-fr-gh", None),
    ("fotiecodes/Turaco-NLLB-mt-en-wes", None),
    ("joseph-scripture/nllb-en-ghomala", None),
    ("mradermacher/Turaco-E2B-it-mt-en-wes-GGUF", ["*.Q4_K_M.gguf", "README.md"]),
] + [(M + x, None) for x in MASA_TOP] + [
    # Seul le code de langue de substitution du ghomala est necessaire ici.
    (M + "m2m100_418M_fr_bbj_rel_news", ["config.json"]),
    ("fotiecodes/Turaco-gem-mt-en-wes", ["turaco-gem-4b-it.BF16.gguf", "README.md", "internal_test_*", "data_manifest.json", "NOTICE", "MODIFICATIONS.md"]),
    ("stfotso/llama-3.2-tuned-french-ghomala-bandjoun-1B", None),
    ("stfotso/deepseek-R1-qween-french-ghomala-bandjoun-1.5B", None),
]

api = HfApi()


def wait_for_network():
    """Une coupure ne consomme pas d'essai : on attend le retour d'internet, sans limite."""
    while True:
        try:
            socket.create_connection(("huggingface.co", 443), timeout=15).close()
            return
        except OSError:
            print(f"[{time.strftime('%H:%M:%S')}] attente du reseau")
            time.sleep(60)


def patterns(repo):
    files = api.list_repo_files(repo)
    safe = [f for f in files if f.endswith(".safetensors") and "/" not in f]
    pat = list(AUX) + (["*.safetensors"] if safe else ["pytorch_model*.bin"])
    print("   poids:", safe or [f for f in files if fnmatch.fnmatch(f, "pytorch_model*.bin")])
    return pat


failed = []
for repo, pat in JOBS:
    dest = os.path.join(ROOT, repo.replace("/", "__"))
    for attempt in range(1, 7):
        try:
            print(f"[{time.strftime('%H:%M:%S')}] {repo} essai {attempt}")
            allow = pat or patterns(repo)
            snapshot_download(repo, local_dir=dest, allow_patterns=allow, ignore_patterns=["*.onnx", "training_args.bin", "optimizer*", "scheduler*", "rng_state*"], max_workers=4)
            size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(dest) for f in fs if ".cache" not in d)
            print(f"   OK {size / 1024**3:.2f} Go")
            break
        except Exception as e:  # le reseau a deja coupe : on reessaie puis on passe au suivant
            print(f"   ERREUR {type(e).__name__}: {str(e)[:300]}")
            time.sleep(30)
            wait_for_network()
    else:
        failed.append(repo)
print("TERMINE. Echecs :", failed)
