"""Ajuste jamm55 (anglais -> pidgin) sur les donnees nettoyees. Prevu pour Google Colab avec GPU.

Usage : python 02_entrainer.py --data /content/drive/MyDrive/KAMA/pidgin/data --sortie /content/drive/MyDrive/KAMA/pidgin/modele_ajuste
Un entrainement interrompu reprend au dernier point sauvegarde dans le dossier de sortie.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import sacrebleu
import torch
from torch.utils.data import Dataset
from transformers import (
    AutoModelForSeq2SeqLM,
    DataCollatorForSeq2Seq,
    EarlyStoppingCallback,
    MarianTokenizer,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
)
from transformers.trainer_utils import get_last_checkpoint

MODELE = "jamm55/autotrain-improved-pidgin-model-2837583189"


class Paires(Dataset):
    def __init__(self, chemin, tokenizer, limite=None):
        lignes = [json.loads(x) for x in open(chemin, encoding="utf-8") if x.strip()]
        lignes = lignes[:limite] if limite else lignes
        self.exemples = [tokenizer(l["en"], text_target=l["wes"], truncation=True, max_length=128) for l in lignes]

    def __len__(self):
        return len(self.exemples)

    def __getitem__(self, i):
        return self.exemples[i]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--sortie", required=True)
    ap.add_argument("--modele", default=MODELE)
    ap.add_argument("--epochs", type=float, default=10, help="maximum : l'arret anticipe coupe plus tot si le modele ne progresse plus")
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=5e-5)
    ap.add_argument("--limite", type=int, default=None, help="nombre d'exemples, pour un essai rapide")
    a = ap.parse_args()

    tok = MarianTokenizer.from_pretrained(a.modele)
    modele = AutoModelForSeq2SeqLM.from_pretrained(a.modele)
    # Reglages de generation enregistres avec le modele : 4 faisceaux pour une traduction plus
    # sure, et aucune suite de 3 mots repetee, contre les boucles « daily daily daily ».
    modele.generation_config.num_beams = 4
    modele.generation_config.no_repeat_ngram_size = 3
    modele.generation_config.max_length = 128
    train = Paires(Path(a.data) / "train.jsonl", tok, a.limite)
    dev = Paires(Path(a.data) / "dev.jsonl", tok, a.limite)
    print(f"train={len(train)} dev={len(dev)} gpu={torch.cuda.is_available()}")

    chrf = sacrebleu.CHRF(word_order=2)

    def mesures(p):
        preds, labels = p
        preds = np.where(preds != -100, preds, tok.pad_token_id)
        labels = np.where(labels != -100, labels, tok.pad_token_id)
        hyp = [x.strip() for x in tok.batch_decode(preds, skip_special_tokens=True)]
        ref = [x.strip() for x in tok.batch_decode(labels, skip_special_tokens=True)]
        return {"chrf": chrf.corpus_score(hyp, [ref]).score}

    args = Seq2SeqTrainingArguments(
        output_dir=a.sortie,
        num_train_epochs=a.epochs,
        per_device_train_batch_size=a.batch,
        per_device_eval_batch_size=max(1, a.batch // 2),  # la generation pendant l'evaluation a sature la memoire du GPU
        learning_rate=a.lr,
        warmup_ratio=0.06,  # demarrage progressif : evite de bousculer le modele au debut
        weight_decay=0.01,
        label_smoothing_factor=0.1,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="chrf",
        greater_is_better=True,
        predict_with_generate=True,
        generation_max_length=128,
        generation_num_beams=4,
        fp16=torch.cuda.is_available(),
        logging_steps=50,
        report_to=[],
        seed=13,
    )
    trainer = Seq2SeqTrainer(
        model=modele,
        args=args,
        train_dataset=train,
        eval_dataset=dev,
        data_collator=DataCollatorForSeq2Seq(tok, model=modele),
        processing_class=tok,
        compute_metrics=mesures,
        # Arret si la note de controle ne progresse plus pendant 2 passes : le modele
        # commencerait a apprendre MT560 par coeur au lieu de traduire.
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )
    point = get_last_checkpoint(a.sortie) if Path(a.sortie).is_dir() else None
    print("reprise depuis", point)
    print("avant entrainement", trainer.evaluate() if point is None else "(reprise)")
    test = Path(a.data) / "test_soreva.jsonl"
    if point is None and test.exists():
        print("TEST SOREVA avant entrainement", trainer.evaluate(Paires(test, tok), metric_key_prefix="soreva"))
    trainer.train(resume_from_checkpoint=point)
    final = Path(a.sortie) / "final"
    trainer.save_model(final)
    tok.save_pretrained(final)
    print("apres entrainement", trainer.evaluate())
    test = Path(a.data) / "test_soreva.jsonl"
    if test.exists():  # phrases de la vie courante, jamais vues : la note qui compte
        print("TEST SOREVA (jamais vu)", trainer.evaluate(Paires(test, tok), metric_key_prefix="soreva"))
    print("Modele final :", final)


if __name__ == "__main__":
    main()
