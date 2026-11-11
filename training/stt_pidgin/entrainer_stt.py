"""Entraine (ajuste) un modele de reconnaissance vocale sur le pidgin camerounais (Common Voice wes).

Usage (Colab, GPU) : python entrainer_stt.py --donnees /content/KAMA/stt --sortie /content/sortie --modele wbert
Modeles (--modele) :
  wbert  KhayaAI/w2v-bert-pcm (w2v-BERT 2.0, 0,6 Md, pidgin nigerian, Apache-2.0)  : le plus prometteur
  xlsr   asr-nigerian-pidgin/pidgin-wav2vec2-xlsr53 (0,3 Md, Apache-2.0)            : le plus leger
  mms    facebook/mms-1b-all, seul l'adaptateur est entraine (1 Md, CC-BY-NC 4.0)    : peu de parametres a apprendre
Le jeu d'essai (--limite 8 --epoques 1) permet de verifier le script en quelques minutes, meme sans GPU.
Les notes (mots faux WER, lettres fausses CER) sont calculees comme dans evaluation/stt_eval.py : minuscules, sans ponctuation.
Sortie : <sortie>/final (modele + processeur) et <sortie>/resultats.json (notes avant/apres sur dev, test Common Voice et SOREVA).
"""
import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import jiwer
import soundfile as sf
import torch
from transformers import (AutoModelForCTC, AutoProcessor, Trainer, TrainingArguments, Wav2Vec2CTCTokenizer, Wav2Vec2FeatureExtractor,
                          Wav2Vec2ForCTC, Wav2Vec2Processor)

sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
MODELES = {
    "wbert": dict(base="KhayaAI/w2v-bert-pcm", lr=5e-5, epoques=15, lot=8, cumul=2),
    "xlsr": dict(base="asr-nigerian-pidgin/pidgin-wav2vec2-xlsr53", lr=3e-5, epoques=20, lot=8, cumul=2),
    "mms": dict(base="facebook/mms-1b-all", lr=1e-3, epoques=20, lot=8, cumul=2),
}
DUREE_MAX = 20.0  # secondes ; plus long = memoire GPU


def normaliser(t):
    return re.sub(r"\s+", " ", re.sub(r"[^\w' ]+", " ", t.lower())).strip()


def lire_manifeste(racine, nom, limite=None):
    chemin = racine / f"manifeste_{nom}.jsonl"
    if not chemin.exists():
        return []
    lignes = [json.loads(l) for l in chemin.read_text(encoding="utf-8").splitlines() if l.strip()]
    sortie = []
    for l in lignes:
        l["text"] = normaliser(l["text"])
        if l["text"] and sf.info(str(racine / l["audio"])).duration <= DUREE_MAX:
            sortie.append(l)
    return sortie[:limite] if limite else sortie


class Jeu(torch.utils.data.Dataset):
    def __init__(self, lignes, racine, processeur):
        self.lignes, self.racine, self.p = lignes, racine, processeur

    def __len__(self):
        return len(self.lignes)

    def __getitem__(self, i):
        l = self.lignes[i]
        x, _ = sf.read(str(self.racine / l["audio"]), dtype="float32")
        f = self.p.feature_extractor(x, sampling_rate=16000)
        cle = "input_features" if "input_features" in f else "input_values"
        return {cle: f[cle][0], "labels": self.p.tokenizer(l["text"]).input_ids}


@dataclass
class Collateur:
    p: object

    def __call__(self, lots):
        cle = "input_features" if "input_features" in lots[0] else "input_values"
        batch = self.p.feature_extractor.pad([{cle: l[cle]} for l in lots], padding=True, return_tensors="pt")
        lab = self.p.tokenizer.pad({"input_ids": [l["labels"] for l in lots]}, padding=True, return_tensors="pt")
        batch["labels"] = lab["input_ids"].masked_fill(lab["attention_mask"].ne(1), -100)
        return batch


def construire_mms(base, textes):
    """Nouveau vocabulaire de lettres (celui de nos textes) ; seuls les adaptateurs et la tete sont entraines."""
    lettres = sorted({c for t in textes for c in t if c != " "})
    vocab = {c: i for i, c in enumerate(lettres)}
    vocab["|"], vocab["[UNK]"], vocab["[PAD]"] = len(vocab), len(vocab) + 1, len(vocab) + 2
    Path("vocab_mms.json").write_text(json.dumps(vocab, ensure_ascii=False), encoding="utf-8")
    tok = Wav2Vec2CTCTokenizer("vocab_mms.json", unk_token="[UNK]", pad_token="[PAD]", word_delimiter_token="|")
    fe = Wav2Vec2FeatureExtractor(feature_size=1, sampling_rate=16000, padding_value=0.0, do_normalize=True, return_attention_mask=True)
    proc = Wav2Vec2Processor(feature_extractor=fe, tokenizer=tok)
    modele = Wav2Vec2ForCTC.from_pretrained(base, attention_dropout=0.0, hidden_dropout=0.0, feat_proj_dropout=0.0, layerdrop=0.0,
                                            ctc_loss_reduction="mean", pad_token_id=tok.pad_token_id, vocab_size=len(tok), ignore_mismatched_sizes=True)
    modele.init_adapter_layers()
    modele.freeze_base_model()
    for p in modele._get_adapters().values():
        p.requires_grad = True
    return proc, modele


def construire(nom, textes, cfg):
    if nom == "mms":
        return construire_mms(cfg["base"], textes)
    proc = AutoProcessor.from_pretrained(cfg["base"])
    modele = AutoModelForCTC.from_pretrained(cfg["base"], mask_time_prob=0.05, layerdrop=0.0, ctc_loss_reduction="mean",
                                             pad_token_id=proc.tokenizer.pad_token_id)
    if hasattr(modele, "freeze_feature_encoder"):
        modele.freeze_feature_encoder()
    return proc, modele


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--donnees", required=True, help="dossier des manifestes jsonl et de audio/")
    ap.add_argument("--sortie", required=True)
    ap.add_argument("--modele", choices=list(MODELES), default="wbert")
    ap.add_argument("--base", help="dossier local du modele de depart (au lieu du telechargement)")
    ap.add_argument("--epoques", type=int)
    ap.add_argument("--lr", type=float)
    ap.add_argument("--limite", type=int, help="essai rapide : N enregistrements par jeu")
    ap.add_argument("--sans_npa", action="store_true", help="ne pas ajouter Nigerian Pidgin ASR 1.0 meme s'il est present")
    a = ap.parse_args()
    cfg = {**MODELES[a.modele], **({"base": a.base} if a.base else {})}
    racine, sortie = Path(a.donnees), Path(a.sortie)
    sortie.mkdir(parents=True, exist_ok=True)

    train = lire_manifeste(racine, "cv_train", a.limite)
    if not a.sans_npa:
        train += lire_manifeste(racine, "npa_train", a.limite)
    jeux = {"dev": lire_manifeste(racine, "cv_dev", a.limite), "test_cv": lire_manifeste(racine, "cv_test", a.limite),
            "test_soreva": lire_manifeste(racine, "soreva_test", a.limite)}
    assert train and jeux["dev"], "manifestes introuvables : verifier --donnees"
    textes_train = {l["text"] for l in train}
    for nom in ("dev", "test_cv"):  # garde-fou : aucune phrase d'evaluation dans l'entrainement
        commun = textes_train & {l["text"] for l in jeux[nom]}
        assert not commun, f"{len(commun)} phrases de {nom} sont dans l'entrainement"
    print(f"entrainement {len(train)} enregistrements ({len(textes_train)} phrases) ; " + " ; ".join(f"{k} {len(v)}" for k, v in jeux.items()))

    proc, modele = construire(a.modele, [l["text"] for l in train], cfg)
    ds = {k: Jeu(v, racine, proc) for k, v in jeux.items() if v}
    ds_train = Jeu(train, racine, proc)
    pad = proc.tokenizer.pad_token_id

    def calculer(pred):
        ref_ids = pred.label_ids.copy()
        ref_ids[ref_ids == -100] = pad
        hyp = proc.tokenizer.batch_decode(pred.predictions)
        ref = proc.tokenizer.batch_decode(ref_ids, group_tokens=False)
        return {"wer": jiwer.wer(ref, hyp), "cer": jiwer.cer(ref, hyp)}

    def reduire(logits, _):
        return (logits[0] if isinstance(logits, tuple) else logits).argmax(-1)

    gpu = torch.cuda.is_available()
    args = TrainingArguments(
        output_dir=str(sortie / "points"), per_device_train_batch_size=cfg["lot"], per_device_eval_batch_size=cfg["lot"],
        gradient_accumulation_steps=cfg["cumul"], learning_rate=a.lr or cfg["lr"], num_train_epochs=a.epoques or cfg["epoques"],
        warmup_ratio=0.1, eval_strategy="epoch", save_strategy="epoch", save_total_limit=1, load_best_model_at_end=True,
        metric_for_best_model="wer", greater_is_better=False, fp16=gpu, use_cpu=not gpu, logging_steps=25, report_to="none",
        remove_unused_columns=False, label_names=["labels"], gradient_checkpointing=(a.modele != "mms" and gpu), dataloader_num_workers=2 if gpu else 0,
    )
    trainer = Trainer(model=modele, args=args, data_collator=Collateur(proc), train_dataset=ds_train, eval_dataset=ds["dev"],
                      compute_metrics=calculer, preprocess_logits_for_metrics=reduire)

    resultats = {"modele": a.modele, "base": cfg["base"], "entrainement": len(train)}
    if a.modele != "mms":  # la note du depart, pour savoir ce que l'ajustement apporte
        resultats["avant"] = {k: {m: round(100 * v, 1) for m, v in trainer.evaluate(eval_dataset=d, metric_key_prefix="e").items() if m in ("e_wer", "e_cer")}
                              for k, d in ds.items()}
        print("AVANT", json.dumps(resultats["avant"]))
    trainer.train()
    resultats["apres"] = {k: {m: round(100 * v, 1) for m, v in trainer.evaluate(eval_dataset=d, metric_key_prefix="e").items() if m in ("e_wer", "e_cer")}
                          for k, d in ds.items()}
    print("APRES", json.dumps(resultats["apres"]))
    (sortie / "resultats.json").write_text(json.dumps(resultats, indent=1), encoding="utf-8")
    if a.modele == "mms":
        modele.half()  # 2 Go au lieu de 4 : le disque Drive est petit
    modele.save_pretrained(sortie / "final")
    proc.save_pretrained(sortie / "final")
    print("modele enregistre dans", sortie / "final")


if __name__ == "__main__":
    main()
