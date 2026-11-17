"""Extrait du corpus d'entrainement (MT560, textes des publications JW) les phrases ou un mot financier est employe dans son sens bancaire.

Pourquoi : un filtre par mot-cle seul ramene beaucoup de faux sens (pay attention, Bill, credit = honneur, saving = salut, wage war...).
Ici chaque concept a son expression reguliere ET une liste de faux sens a exclure. On retire aussi :
  - les phrases religieuses (la source de « God no be charge money »),
  - les phrases dont les chiffres different entre anglais et pidgin (le corpus change parfois les montants : $100 million -> franc CFA),
  - les phrases trop longues.
On classe l'orthographe du pidgin : « anglais » (As ih di say, people, life, for : celle de notre page de test) ou « phonetique » (wi, laif, fo, pipul).

Sorties (dossier data/, hors Git) :
  emplois_financiers.jsonl   une ligne par phrase retenue (concept, en, wes, style, rendu, forme)
  emplois_financiers.json    synthese par concept : combien, quelles formes de rendu, deux exemples
  complement_v3.jsonl        phrases d'orthographe « anglais » dont le terme est rendu par une forme attestee (reserve pour un eventuel v3)
Usage : python 12_emplois_financiers.py
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ICI = Path(__file__).resolve().parent
DATA = ICI / "data"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# concept : (expression sur l'anglais, faux sens a exclure, formes pidgin attendues, sensibilite a la casse)
CONCEPTS = {
    "money": (r"\bmoney\b", r"money (changers?|lenders?)", r"money|moni", False),
    "pay": (r"\b(pay|pays|paid|paying)\b",
            r"pa(y|ys|id|ying) (close |constant |special |careful |full |particular )?attention|pa(y|id) (a |the |his |her |your |our |my |their )?vows?|pay homage"
            r"|pay back (injury|evil)|pay (a |the )?tribute|wages? (of sin|sin pays)|pay (the )?ransom|ransom|pay (respect|honor)",
            r"pay|paid|pei|pass", False),
    "buy": (r"\b(buy|buys|bought|buying)\b", r"bought (us|them|people|with)|buy back|ransom|buy (up )?the truth", r"buy|bai|bought|bye", False),
    "sell": (r"\b(sell|sells|sold|selling)\b", r"sold (him|into|us)|slave|slavery|sold under", r"sell|sel|sold", False),
    "tax": (r"\btax(es)?\b", r"tax collectors?|tax gatherers?|tax agent", r"tax", False),
    "salary": (r"\b(wages?|salary|salaries)\b", r"wages? (of sin|sin pays)|wage (a )?war", r"salary|pay|money|wage", False),
    "owe": (r"\bowe(s|d)?\b", r"owe (it )?to|owe (our|my|his|her|their) (life|lives)|(love|gratitude|loyalty|thanks)|owed (him|her) (his|her) life", r"owe|ow|debt", False),
    "debt": (r"\bdebts?\b", r"forgiv|sin\b", r"debt", False),
    "loan": (r"\bloans?\b", r"loan (made )?to (Him|Jehovah)", r"loan|borrow|owe|lend", False),
    "bank": (r"\bbanks?\b", r"river|west bank|bank of the", r"bank", False),
    "bill": (r"\bbills?\b", r"Bill\b|Bill's", r"bill", True),
    "price": (r"\bprices?\b", r"ransom|price of sin", r"price|praiz|cost|dear", False),
    "cost": (r"\bcosts?\b", r"(at (all|great|any|a great|great personal) cost)|cost (him|her|them|us|me|you) (his|her|their|our|my|your) life",
             r"cost|spend|price|dear", False),
    "budget": (r"\bbudget(ing)?\b", r"", r"budget|plan", False),
    "savings": (r"\bsavings\b", r"", r"saving|keep|money", False),
    "expenses": (r"\bexpenses?\b", r"", r"expense|spend|money|cost", False),
    "cash": (r"\bcash\b", r"", r"cash|money|dash", False),
    "insurance": (r"\binsurance\b", r"", r"insurance", False),
    "credit_card": (r"\b(credit|debit) cards?\b", r"", r"card", False),
    "transfer": (r"\b(money |bank |wire )transfers?\b|\btransfer(red|ring)? (the )?(money|funds|\$|\d)", r"", r"transfer|send", False),
    "deposit": (r"\bdeposit(ed|s)?\b", r"deposits? of (gold|alluvial)|alluvial", r"deposit|put|keep", False),
    "withdraw": (r"\bwithdraw(al|s|n)?\b(?! support)", r"sea|withdraws? from|withdrew from|withdraw (their|our|your) support", r"withdraw|comot|take", False),
    "refund": (r"\brefund(s|ed)?\b", r"", r"refund|back", False),
    "fee": (r"\b(fees?|charge(d|s)?)\b", r"charge (of|against)|in charge|charged with|take charge", r"fee|charge|pay", False),
    "amount": (r"\bamount of money\b|\bthe amount\b", r"tremendous|amount of (time|work|energy|pressure|light)", r"amount|money|how much", False),
}

RELIGIEUX = set(
    "god lord jehovah jesus christ christian christians holy spirit bible biblical congregation congregations brother brothers sister sisters apostle apostles "
    "paul peter john moses david solomon abraham joseph kingdom preach preaching pioneer pioneers witnesses witness elder elders ministry prophet prophets "
    "sin sins sinner sinners angel angels satan temple disciples disciple faith pray prayer prayers vow vows ransom baptism baptized heaven heavenly "
    "scripture scriptures gospel salvation sacrifice sacrifices altar tithe tithes church churches priest priests clergy convention assembly bethel "
    "dieu seigneur jesus eglise ".split()
)
PHONETIQUE = set(
    "wi fo laif baibul jehova pipul bikos rait hau oda dia eni ol taim kontri ting tok pawa sei dis wei trong wan kain wok dei".split()
)
MOT = re.compile(r"[a-zà-ÿ']+")
NOMBRE = re.compile(r"\d[\d., ]*\d|\d")


def chiffres(t):
    return sorted(re.sub(r"\D", "", n) for n in NOMBRE.findall(t))


def lire(chemin):
    for l in chemin.read_text(encoding="utf-8").splitlines():
        if l.strip():
            yield json.loads(l)


def main():
    paires = list(lire(DATA / "train.jsonl")) + list(lire(DATA / "dev.jsonl"))
    compiles = {c: (re.compile(en, 0 if cas else re.I), re.compile(ex, re.I) if ex and not cas else (re.compile(ex) if ex else None),
                    re.compile(r"\b(" + formes + r")", re.I)) for c, (en, ex, formes, cas) in CONCEPTS.items()}
    retenues, rejets = [], Counter()
    for p in paires:
        en, wes = p["en"], p["wes"]
        mots_en, mots_wes = set(MOT.findall(en.lower())), MOT.findall(wes.lower())
        if mots_en & RELIGIEUX or set(mots_wes) & RELIGIEUX:
            rejets["religieux"] += 1
            continue
        if chiffres(en) != chiffres(wes):
            rejets["chiffres differents"] += 1
            continue
        if not 4 <= len(en.split()) <= 30 or not 0.5 <= len(wes.split()) / len(en.split()) <= 2.2:
            rejets["longueur"] += 1
            continue
        style = "phonetique" if len(set(mots_wes) & PHONETIQUE) >= 1 else "anglais"
        for concept, (re_en, re_ex, re_forme) in compiles.items():
            if not re_en.search(en):
                continue
            if re_ex is not None and re_ex.search(en):
                rejets["faux sens"] += 1
                continue
            m = re_forme.search(wes)
            retenues.append({"concept": concept, "en": en, "wes": wes, "style": style, "rendu": bool(m), "forme": m.group(0).lower() if m else None})
    (DATA / "emplois_financiers.jsonl").write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in retenues), encoding="utf-8")

    synthese = {}
    par = defaultdict(list)
    for r in retenues:
        par[r["concept"]].append(r)
    for c, lignes in par.items():
        rendus = [l for l in lignes if l["rendu"]]
        formes = Counter((l["forme"], l["style"]) for l in rendus)
        exemples = sorted((l for l in rendus if l["style"] == "anglais"), key=lambda l: len(l["en"]))[:2]
        synthese[c] = {
            "phrases": len(lignes), "rendu_par_forme_attendue": len(rendus), "paraphrases": len(lignes) - len(rendus),
            "formes": {f"{f} ({s})": n for (f, s), n in formes.most_common(8)},
            "exemples": [{"en": e["en"], "wes": e["wes"]} for e in exemples],
        }
    (DATA / "emplois_financiers.json").write_text(json.dumps(synthese, ensure_ascii=False, indent=1), encoding="utf-8")
    complement = [{"en": r["en"], "wes": r["wes"], "source": "mt560-financier"} for r in retenues if r["style"] == "anglais" and r["rendu"]]
    vus, unique = set(), []
    for c in complement:
        if c["en"] not in vus:
            vus.add(c["en"])
            unique.append(c)
    (DATA / "complement_v3.jsonl").write_text("\n".join(json.dumps(c, ensure_ascii=False) for c in unique), encoding="utf-8")

    print(f"{len(paires)} paires lues ; rejets : {dict(rejets)}")
    print(f"{len(retenues)} emplois retenus, dont {len(unique)} phrases distinctes d'orthographe anglaise pour un eventuel v3\n")
    print(f"{'concept':<12}{'phrases':>8}{'rendu':>7}{'paraph.':>9}  formes (orthographe)")
    for c, s in sorted(synthese.items(), key=lambda kv: -kv[1]["phrases"]):
        print(f"{c:<12}{s['phrases']:>8}{s['rendu_par_forme_attendue']:>7}{s['paraphrases']:>9}  {s['formes']}")


if __name__ == "__main__":
    main()
