"""Compare le modèle d'origine (NITHUB) et le modèle ajusté sur les 77 phrases SOREVA, sens pidgin -> anglais.

Mesure : chrF (sacrebleu) et part de phrases identiques à la référence. Ne produit rien dans le dépôt.
Usage : python evaluer.py --test data/test_soreva.jsonl --modele sortie/final
"""
import argparse
import json

import sacrebleu
import torch
from transformers import MarianMTModel, MarianTokenizer


def traduire(modele, tok, phrases, lot=16):
    sorties = []
    modele.eval()
    with torch.inference_mode():
        for i in range(0, len(phrases), lot):
            enc = tok(phrases[i:i + lot], return_tensors="pt", padding=True, truncation=True, max_length=128)
            out = modele.generate(**enc, num_beams=4, max_new_tokens=128)
            sorties += tok.batch_decode(out, skip_special_tokens=True)
    return sorties


def mesurer(nom, hyps, refs):
    chrf = sacrebleu.corpus_chrf(hyps, [refs]).score
    identiques = sum(h.strip().lower() == r.strip().lower() for h, r in zip(hyps, refs)) / len(refs)
    print(f"{nom:<24} chrF {chrf:5.1f}   identiques {100 * identiques:4.1f} %")
    return chrf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", default="data/test_soreva.jsonl")
    ap.add_argument("--modele", required=True)
    ap.add_argument("--base", default="NITHUB-AI/marian-mt-bbc-pcm-en")
    a = ap.parse_args()
    lignes = [json.loads(l) for l in open(a.test, encoding="utf-8") if l.strip()]
    src, refs = [r["src"] for r in lignes], [r["tgt"] for r in lignes]
    print(f"{len(lignes)} phrases SOREVA, sens pidgin -> anglais")
    for nom, chemin in (("base NITHUB (origine)", a.base), ("ajusté (nouveau)", a.modele)):
        tok = MarianTokenizer.from_pretrained(chemin)
        modele = MarianMTModel.from_pretrained(chemin)
        mesurer(nom, traduire(modele, tok, src), refs)


if __name__ == "__main__":
    main()
