"""Telecharge les meilleurs modeles dans ce dossier : python models/fetch_models.py [ghomala|pidgin|tout]

Les poids ne sont pas versionnes : ils depassent les limites de GitHub.
Prerequis : pip install -U huggingface_hub
"""
import pathlib
import sys

from huggingface_hub import snapshot_download

HERE = pathlib.Path(__file__).resolve().parent / "poids"
EXCLUDE = ["*.onnx", "training_args.bin", "optimizer*", "scheduler*", "rng_state*"]
MODELS = {
    "ghomala": [
        "masakhane/m2m100_418M_fr_bbj_rel_news_ft",
        "masakhane/m2m100_418M_bbj_fr_rel_news_ft",
    ],
    "pidgin": [
        "jamm55/autotrain-improved-pidgin-model-2837583189",
        "fotiecodes/Turaco-NLLB-mt-en-wes",
        "Helsinki-NLP/opus-mt-fr-en",
        "Helsinki-NLP/opus-mt-en-fr",
    ],
}

choice = sys.argv[1] if len(sys.argv) > 1 else "tout"
groups = list(MODELS) if choice == "tout" else [choice]
for group in groups:
    for repo in MODELS[group]:
        print("Telechargement de", repo)
        snapshot_download(repo, local_dir=HERE / repo.replace("/", "__"), ignore_patterns=EXCLUDE)
print("Termine.")
