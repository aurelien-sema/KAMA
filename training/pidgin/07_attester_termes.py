"""Cherche comment le pidgin camerounais rend chaque terme de l'interface, dans des textes reels.

Pour un terme anglais (ex. "money"), on prend toutes les paires MT560 dont l'anglais le contient,
et on classe les mots pidgin qui apparaissent bien plus souvent en face qu'ailleurs dans le corpus.
On cherche ensuite ces mots dans le manuel Peace Corps (1983) et dans SOREVA.

Resultat : data/attestations.json (preuves) ; le dictionnaire lui-meme est redige a partir de ces preuves.
Usage : python 07_attester_termes.py [chemin du texte Peace Corps extrait par pdftotext]
"""
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

ICI = Path(__file__).resolve().parent
DEPOT = ICI.parents[1]
MT560 = next((DEPOT / "datasets" / "pidgin" / "mt560_en-pidgin").glob("*.parquet"))
SOREVA = DEPOT.parent / "datasets" / "soreva" / "pcm_cm.test.tsv"
SORTIE = ICI / "data" / "attestations.json"

# Concept de l'interface -> expression reguliere sur l'anglais
TERMES = {
    "money": r"\bmoney\b", "send": r"\bsen(d|ds|t|ding)\b", "receive": r"\breceiv(e|es|ed|ing)\b",
    "pay": r"\b(pay|pays|paid|paying)\b", "account": r"\baccounts?\b", "bank": r"\bbanks?\b",
    "fee / charge": r"\b(fees?|charges?)\b", "balance / remain": r"\b(balance|remain(s|ed|ing)?|left over)\b",
    "phone": r"\b(tele)?phones?\b", "number": r"\bnumbers?\b", "name": r"\bnames?\b",
    "check / verify": r"\b(check(s|ed)?|verif(y|ied))\b", "confirm": r"\bconfirm(s|ed)?\b",
    "cancel": r"\bcancel(led)?\b", "close / shut": r"\b(close|closed|shut)\b", "go back / return": r"\b(go back|return(ed)?)\b",
    "continue": r"\bcontinu(e|es|ed|ing)\b", "error / mistake": r"\b(errors?|mistakes?)\b", "problem": r"\bproblems?\b",
    "warning / warn": r"\bwarn(ing|ed)?\b", "careful": r"\b(careful|beware)\b", "safe / security": r"\b(safe|safety|secur(e|ity))\b",
    "free": r"\bfree of charge\b|\bfor free\b|\bfreely\b", "how much": r"\bhow much\b", "total / all": r"\b(total|all of it)\b",
    "shop / market": r"\b(shop|store|market)\b", "salary / wages": r"\b(salary|wages?)\b", "bill / debt": r"\b(bills?|debts?)\b",
    "light / electricity": r"\b(electricity|electric)\b", "success / succeed": r"\bsucce(ss|ed|eded|ssful)\b",
    "again": r"\bagain\b", "new": r"\bnew\b", "important": r"\bimportant\b", "message": r"\bmessages?\b",
    "never": r"\bnever\b", "before": r"\bbefore\b", "always": r"\balways\b", "choose": r"\bch(oose|ose|osen)\b",
    "count / calculate": r"\b(count(ed)?|calculat(e|ed))\b", "immediately": r"\b(immediately|at once|right away)\b",
    "not enough": r"\bnot enough\b|\binsufficient\b", "please": r"\bplease\b", "try": r"\btr(y|ied|ies)\b",
    "change": r"\bchang(e|ed|es)\b", "reason / why": r"\b(reason|why)\b", "true / real": r"\b(true|real)\b",
    "show / demonstrate": r"\b(show|showed|demonstrat(e|ed))\b", "for now / temporary": r"\b(temporar(y|ily)|for now)\b",
    "must": r"\bmust\b", "correct / right": r"\b(correct|right)\b", "finish / complete": r"\b(finish(ed)?|complet(e|ed))\b",
    "take out / withdraw": r"\b(withdraw(n)?|take out)\b", "enter / put": r"\b(enter(ed)?|put)\b", "information": r"\binformation\b",
    "person": r"\bperson\b", "type / kind": r"\bkinds?\b", "available": r"\bavailable\b", "zero / nothing": r"\b(zero|nothing)\b",
    "more than": r"\bmore than\b", "less than": r"\bless than\b", "note / write": r"\b(note|write|wrote)\b",
}


def mots(texte):
    return re.findall(r"[a-zA-Z']+", texte.lower())


def main():
    df = pd.read_parquet(MT560)
    paires = [(str(e), str(w)) for e, w in zip(df["eng"], df["wes"])]
    fond = Counter()
    for _, w in paires:
        fond.update(set(mots(w)) | {" ".join(b) for b in zip(mots(w), mots(w)[1:])})
    total = len(paires)

    peace = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace").lower() if len(sys.argv) > 1 else ""
    soreva = SOREVA.read_text(encoding="utf-8").lower() if SOREVA.exists() else ""

    resultat = {}
    for concept, motif in TERMES.items():
        rx = re.compile(motif, re.I)
        trouve = [(e, w) for e, w in paires if rx.search(e)]
        if not trouve:
            resultat[concept] = {"paires": 0}
            continue
        local = Counter()
        for _, w in trouve:
            m = mots(w)
            local.update(set(m) | {" ".join(b) for b in zip(m, m[1:])})
        n = len(trouve)
        classes = []
        for mot, a in local.items():
            if a < 3:
                continue
            # rapport de frequence, lisse : un mot courant partout (na, di, for) ne remonte pas
            score = (a / n) / ((fond[mot] + 5) / total)
            classes.append((score * math.log(a + 1), mot, a))
        classes.sort(reverse=True)
        top = [{"pidgin": mot, "paires": a,
                "peace_corps": len(re.findall(rf"\b{re.escape(mot)}\b", peace)) if peace else None,
                "soreva": len(re.findall(rf"\b{re.escape(mot)}\b", soreva))} for _, mot, a in classes[:8]]
        exemples = sorted(trouve, key=lambda p: len(p[0]))[:3]
        resultat[concept] = {"paires": n, "candidats": top, "exemples": [{"en": e, "wes": w} for e, w in exemples]}
        print(f"\n## {concept} ({n} paires)")
        for t in top:
            print(f"   {t['pidgin']:<22} MT560 {t['paires']:>4}  PeaceCorps {t['peace_corps']}  SOREVA {t['soreva']}")
        for e, w in exemples[:2]:
            print(f"   EN: {e[:110]}\n   PC: {w[:110]}")

    SORTIE.parent.mkdir(exist_ok=True)
    SORTIE.write_text(json.dumps(resultat, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\nEcrit :", SORTIE)


if __name__ == "__main__":
    main()
