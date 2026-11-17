"""Mesure ce que les corpus pidgin trouves sur le web apportent au lexique, surtout pour le vocabulaire bancaire.

Usage : python 09_lexique_web.py       (necessite pandas ; corpus dans datasets/pidgin/web, voir evaluation/download_candidats.py)
Sortie : data/lexique_web.json (frequences par source, mots bancaires, mots nouveaux) et un resume a l'ecran.
ATTENTION : ces corpus sont du pidgin NIGERIAN (sauf MT560 camerounais et Common Voice). Un mot trouve ici est attesté en pidgin,
pas forcement utilise au Cameroun : la liste sert a reperer et a faire valider, jamais a accepter automatiquement.
Licences : Ephraimmm/pidgin_bank_dataset (inconnue) et les autres restent hors depot ; seul le resultat chiffre est garde.
"""
import gzip
import json
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[2]
WEB = RACINE / "datasets" / "pidgin" / "web"
CV = RACINE / "datasets" / "pidgin" / "common_voice_wes" / "cv-corpus-27.0-2026-09-11" / "wes"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
MOT = re.compile(r"[a-zà-ÿ']+")

# vocabulaire de la page de test et des messages bancaires : ce qu'un modele doit bien rendre
BANCAIRE = """balance money account bank transfer send receive sent receive debit credit deposit withdraw charge fee fees free total amount
number name pin password code secret fraud scam tif tief thief fake limit maximum minimum confirm verify check refuse fail failed
reverse refund pending success security alert network error wrong wait try again cancel close salary reference payment bill
light electricity mobile momo agent person beneficiary receive transaction history save sure careful lukot beware""".split()


def textes_bank():
    for ligne in open(WEB / "Ephraimmm__pidgin_bank_dataset" / "150k_pidgin_pii_safe.jsonl", encoding="utf-8"):
        for m in json.loads(ligne)["messages"]:
            if m["role"] != "system":
                yield m["content"]


def textes_csv(chemin, col="text"):
    yield from pd.read_csv(chemin)[col].dropna().astype(str)


def textes_wiki():
    with gzip.open(WEB / "ffatty__plaintext-wikipedia-full-nigerian-pidgin" / "data" / "pcmwiki_01_of_01.txt.gz", "rt", encoding="utf-8") as f:
        yield from f


def textes_mt560(cote="pcm"):
    df = pd.read_parquet(next((WEB / "michsethowusu__english-nigerian-pidgin_sentence-pairs_mt560" / "data").glob("*.parquet")))
    colonne = next((c for c in df.columns if c.lower() in ("pidgin", "pcm", "target")), df.columns[-1])
    yield from df[colonne].astype(str)


def textes_cv():
    with open(CV / "validated_sentences.tsv", encoding="utf-8") as f:
        next(f)
        for l in f:
            p = l.rstrip("\n").split("\t")
            yield p[1] if len(p) > 1 else p[0]


def textes_lexique():
    df = pd.read_parquet(WEB / "ananselabs__unfiltered-pidgin-english-lexicon" / "data" / "train-00000-of-00001.parquet")
    yield from (df["term"].astype(str) + " " + df["meaning"].astype(str))


def textes_bbc():
    df = pd.read_csv(WEB / "Bytte-AI__BBC_Igbo-Pidgin_Gold-Standard_NLP_Corpus" / "bbc_pidgin_IQS.csv")
    for c in df.columns:
        if df[c].dtype == object:
            yield from df[c].dropna().astype(str)


SOURCES = {
    "banque_nigeria": textes_bank,
    "corpus_texte_nigeria": lambda: textes_csv(WEB / "Guavacoderepo__gclm-pidgin-text-corpus" / "Text-corpus.csv"),
    "wikipedia_pcm": textes_wiki,
    "mt560_nigeria": textes_mt560,
    "bbc_pidgin": textes_bbc,
    "lexique_argot": textes_lexique,
    "common_voice_cameroun": textes_cv,
}


def main():
    compte, par_source = {}, {}
    for nom, source in SOURCES.items():
        try:
            c = Counter(m for t in source() for m in MOT.findall(t.lower()))
        except Exception as e:
            print(f"{nom:<24} ILLISIBLE ({type(e).__name__}: {str(e)[:80]})")
            continue
        compte[nom] = c
        par_source[nom] = sum(c.values())
        print(f"{nom:<24} {par_source[nom]:>10} mots, {len(c):>7} differents", flush=True)

    ref = ICI / "data" / "lexique_atteste.txt"
    connu = set(ref.read_text(encoding="utf-8").split()) if ref.exists() else set()
    print(f"\nlexique actuel : {len(connu)} mots")
    tous = Counter()
    for c in compte.values():
        tous.update(c)
    nouveaux = {m: n for m, n in tous.items() if m not in connu and n >= 5}
    print(f"mots vus au moins 5 fois dans les corpus web et absents du lexique actuel : {len(nouveaux)}")

    print(f"\n{'mot':<14}" + "".join(f"{n[:11]:>12}" for n in compte) + "   dans lexique actuel")
    bancaire = {}
    for mot in BANCAIRE:
        freq = {n: c.get(mot, 0) for n, c in compte.items()}
        bancaire[mot] = {"frequences": freq, "dans_lexique": mot in connu}
        print(f"{mot:<14}" + "".join(f"{freq[n]:>12}" for n in compte) + f"   {'oui' if mot in connu else 'NON'}")

    absents = [m for m, v in bancaire.items() if sum(v["frequences"].values()) == 0]
    print(f"\nmots bancaires sans aucune occurrence dans ces corpus : {absents}")
    sortie = {"mots_par_source": par_source, "lexique_actuel": len(connu), "nouveaux_mots_5plus": len(nouveaux), "bancaire": bancaire,
              "nouveaux_les_plus_frequents": sorted(nouveaux, key=nouveaux.get, reverse=True)[:300]}
    (ICI / "data" / "lexique_web_5plus.txt").write_text("\n".join(f"{m}\t{n}" for m, n in sorted(nouveaux.items(), key=lambda x: -x[1])), encoding="utf-8")
    (ICI / "data" / "lexique_web.json").write_text(json.dumps(sortie, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
