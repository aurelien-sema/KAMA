"""Ajuste le modèle pidgin -> anglais NITHUB-AI/marian-mt-bbc-pcm-en sur nos données camerounaises.

Prévu pour Kaggle (GPU T4). Un entraînement interrompu reprend au dernier point sauvegardé (même --sortie).
Usage :  python entrainer.py --donnees data --sortie sortie [--epoques 3] [--smoke]
Sortie : sortie/final (Hugging Face). La conversion CTranslate2 se fait avec backend/scripts/convertir_modele.py.
Le modèle de départ va déjà de pidgin vers anglais : pas de jeton de langue à gérer (contrairement à m2m100).
"""
import argparse
import json
from pathlib import Path

import torch
from torch.utils.data import Dataset
from transformers import (
    DataCollatorForSeq2Seq,
    MarianMTModel,
    MarianTokenizer,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
)
from transformers.trainer_utils import get_last_checkpoint

MODELE = "NITHUB-AI/marian-mt-bbc-pcm-en"  # CC BY 4.0 ; pidgin nigérian -> anglais


class Paires(Dataset):
    def __init__(self, chemin, tok, limite=None):
        lignes = [json.loads(l) for l in open(chemin, encoding="utf-8") if l.strip()]
        lignes = lignes[:limite] if limite else lignes
        self.ex = [tok(r["src"], text_target=r["tgt"], truncation=True, max_length=128) for r in lignes]

    def __len__(self):
        return len(self.ex)

    def __getitem__(self, i):
        return self.ex[i]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--donnees", default="data")
    ap.add_argument("--sortie", default="sortie")
    ap.add_argument("--epoques", type=int, default=3)
    ap.add_argument("--lot", type=int, default=16)
    ap.add_argument("--lr", type=float, default=5e-5)
    ap.add_argument("--smoke", action="store_true", help="essai : 64 paires, 1 passe")
    a = ap.parse_args()
    d, sortie = Path(a.donnees), Path(a.sortie)
    sortie.mkdir(parents=True, exist_ok=True)

    tok = MarianTokenizer.from_pretrained(MODELE)
    modele = MarianMTModel.from_pretrained(MODELE)
    limite = 64 if a.smoke else None
    train = Paires(d / "train.jsonl", tok, limite)
    dev = Paires(d / "dev.jsonl", tok, limite)
    print(f"entraînement : {len(train)} paires ; dev : {len(dev)}")

    args = Seq2SeqTrainingArguments(
        output_dir=str(sortie / "points"),
        num_train_epochs=1 if a.smoke else a.epoques,
        per_device_train_batch_size=a.lot,
        per_device_eval_batch_size=a.lot,
        learning_rate=a.lr,
        warmup_steps=200,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        fp16=torch.cuda.is_available(),
        logging_steps=50,
        report_to="none",
        seed=13,
    )
    trainer = Seq2SeqTrainer(
        model=modele,
        args=args,
        train_dataset=train,
        eval_dataset=dev,
        data_collator=DataCollatorForSeq2Seq(tok, model=modele),
    )
    reprise = get_last_checkpoint(str(sortie / "points"))
    trainer.train(resume_from_checkpoint=reprise)
    trainer.save_model(str(sortie / "final"))
    tok.save_pretrained(str(sortie / "final"))
    print("modèle enregistré dans", (sortie / "final").resolve())


if __name__ == "__main__":
    main()
