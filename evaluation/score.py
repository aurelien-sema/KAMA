"""Note les sorties de results/ et ecrit results/summary.csv."""
import collections
import csv
import json
import os
import re
import sys
import unicodedata

import sacrebleu

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, "results")
TS = os.path.join(HERE, "testsets")
APOS = dict.fromkeys(map(ord, "'’ʼꞌ`´"), "'")


def nf(s):
    return " ".join(unicodedata.normalize("NFC", s).translate(APOS).split())


def untone(s):
    return unicodedata.normalize("NFC", "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c)))


def eq(s):
    return re.sub(r"[^\w']+", " ", nf(s).lower()).strip()


CHRF = sacrebleu.CHRF(word_order=2)
BLEU = sacrebleu.BLEU(effective_order=True, tokenize="intl")


def quality(rows):
    rows = [r for r in rows if r["ref"]]
    if not rows:
        return {}
    hyp = [nf(r["hyp"]) for r in rows]
    ref = [nf(r["ref"]) for r in rows]
    return {
        "n": len(rows),
        "chrF": round(CHRF.corpus_score(hyp, [ref]).score, 1),
        "chrF_sans_ton": round(CHRF.corpus_score([untone(h) for h in hyp], [[untone(x) for x in ref]]).score, 1),
        "BLEU": round(BLEU.corpus_score(hyp, [ref]).score, 1),
        "exact_%": round(100 * sum(eq(h) == eq(x) for h, x in zip(hyp, ref)) / len(rows), 1),
    }


def degenerate(src, hyp):
    t = hyp.lower().split()
    if not t:
        return True
    if any(t[i] == t[i + 1] == t[i + 2] for i in range(len(t) - 2)):
        return True
    c = collections.Counter(t)
    if len(t) >= 6 and c.most_common(1)[0][1] / len(t) > 0.4:
        return True
    return len(hyp) > 3 * len(src) + 30


def digits(s):
    s = re.sub(r"(?<=\d)[\s  .,:/](?=\d)", "", s)
    return re.findall(r"\d+", s)


def probes(rows, meta, lang):
    ent_ok = amounts_ok = nent = namt = nhall = deg = nname = name_ok = copied = 0
    for r, m in zip(rows, meta):
        deg += degenerate(r["src"], r["hyp"])
        copied += eq(r["hyp"]) == eq(r["src"])
        src_d = set(digits(r["src"]))
        nhall += any(d not in src_d for d in digits(r["hyp"]))
        ents = m["entities_" + lang]
        if not ents:
            continue
        nent += 1
        ok = True
        hd = digits(r["hyp"])
        low = r["hyp"].lower()
        for e in ents:
            d = digits(e)
            if d:
                namt += 1
                good = all(x in hd for x in d)
                amounts_ok += good
            else:
                nname += 1
                good = all(w.lower() in low for w in e.split())
                name_ok += good
            ok &= good
        ent_ok += ok
    n = len(rows)
    return {
        "n": n,
        "phrases_entites_intactes_%": round(100 * ent_ok / max(nent, 1), 1),
        "nombres_conserves_%": round(100 * amounts_ok / max(namt, 1), 1),
        "noms_conserves_%": round(100 * name_ok / max(nname, 1), 1),
        "nombre_invente_%": round(100 * nhall / n, 1),
        "degenere_%": round(100 * deg / n, 1),
        "copie_source_%": round(100 * copied / n, 1),
    }


def protected(rows):
    ok = sum(sorted(re.findall(r"ZZ\d+ZZ", r["hyp"])) == sorted(re.findall(r"ZZ\d+ZZ", r["src"])) for r in rows)
    has = [r for r in rows if "ZZ" in r["src"]]
    ok2 = sum(sorted(re.findall(r"ZZ\d+ZZ", r["hyp"])) == sorted(re.findall(r"ZZ\d+ZZ", r["src"])) for r in has)
    return {"n": len(has), "balises_intactes_%": round(100 * ok2 / max(len(has), 1), 1), "toutes_%": round(100 * ok / len(rows), 1)}


def jl(p):
    return [json.loads(x) for x in open(p, encoding="utf-8") if x.strip()]


meta = jl(os.path.join(TS, "banking_probes.jsonl"))
sor = jl(os.path.join(TS, "soreva_aligned.jsonl"))
out = []
for model in sorted(os.listdir(RES)):
    d = os.path.join(RES, model)
    if not os.path.isdir(d) or model.endswith("_smoke"):
        continue
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".jsonl"):
            continue
        name = fn[:-6]
        rows = jl(os.path.join(d, fn))
        rec = {"model": model, "set": name}
        if name == "probes":
            lang = "fr" if rows[0]["src"] == meta[0]["fr"] else "en"
            rec.update(probes(rows, meta, lang))
        elif name == "probes_protected":
            rec.update(protected(rows))
        elif name == "soreva":
            rec.update(quality(rows))
            rec["deg_%"] = round(100 * sum(degenerate(r["src"], r["hyp"]) for r in rows) / len(rows), 1)
            sent = [r for r, m in zip(rows, sor) if m["cat"] in ("phrase", "question", "presentation", "argent", "sante", "heure", "politesse", "salut")]
            q = quality(sent)
            rec["chrF_phrases"] = q["chrF"]
            rec["exact_phrases_%"] = q["exact_%"]
            nums = [r for r, m in zip(rows, sor) if m["cat"] == "nombre"]
            rec["exact_nombres_%"] = quality(nums)["exact_%"]
        elif name == "mafand_repro30":
            parts = model.replace("masakhane_", "").split("_")
            rec["n"] = len(rows)
        else:
            rec.update(quality(rows))
            rec["deg_%"] = round(100 * sum(degenerate(r["src"], r["hyp"]) for r in rows) / len(rows), 1)
        out.append(rec)

keys = []
for r in out:
    keys += [k for k in r if k not in keys]
with open(os.path.join(RES, "summary.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=keys)
    w.writeheader()
    w.writerows(out)
for name in ("soreva", "mafand200", "bible100", "probes", "probes_protected"):
    sel = [r for r in out if r["set"] == name]
    if sel:
        print("\n==", name)
        for r in sorted(sel, key=lambda x: -x.get("chrF", x.get("phrases_entites_intactes_%", x.get("balises_intactes_%", 0)))):
            print({k: v for k, v in r.items() if k != "set"})
