"""Construit les jeux de test de traduction dans evaluation/testsets/."""
import collections
import csv
import json
import os
import random
import re
import sys
import unicodedata

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(os.path.dirname(HERE))  # donnees hors du depot
DS = os.path.join(PROJ, "datasets")
OUT = os.path.join(HERE, "testsets")
os.makedirs(OUT, exist_ok=True)
random.seed(13)

APOS = dict.fromkeys(map(ord, "'’ʼꞌ`´"), "'")
CONF = str.maketrans({"ǝ": "ə", "ͻ": "ɔ", "ᵾ": "ʉ", "ı": "i"})


def norm(s):
    s = unicodedata.normalize("NFC", s).translate(APOS).translate(CONF).lower()
    s = re.sub(r"[^\w'\s]", " ", s)
    return " ".join(s.split())


def write(name, rows):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{name}: {len(rows)} lignes")


g = os.path.join(DS, "ghomala")
maf = {}
for sp in ("train", "dev", "test"):
    rows = []
    with open(os.path.join(g, "mafand_fr-bbj", f"{sp}.json"), encoding="utf-8-sig") as f:
        for line in f:
            if line.strip():
                t = json.loads(line)["translation"]
                rows.append({"fr": t["fr"].strip(), "bbj": t["bbj"].strip(), "mafand_split": sp})
    maf[sp] = rows

ban = json.load(open(os.path.join(g, "french-ghomala-bandjoun", "french-ghomala-bandjoun.json"), encoding="utf-8-sig"))
ban_bbj = {norm(x["ghomala"]) for x in ban}
ban_fr = {norm(x["francais"]) for x in ban}

bib_dir = os.path.join(g, "spoken_bible", "text")
bible = []
for fn in sorted(os.listdir(os.path.join(bib_dir, "ghomala"))):
    v = {}
    for lang in ("ghomala", "french", "english"):
        p = os.path.join(bib_dir, lang, fn)
        if not os.path.exists(p):
            continue
        for line in open(p, encoding="utf-8-sig"):
            m = re.match(r"\s*(\d+)\s*:\s*(.*)", line)
            if m and m.group(2).strip():
                v.setdefault(m.group(1), {})[lang] = m.group(2).strip()
    for num, d in v.items():
        if len(d) == 3:
            bible.append({"ref": f"{fn[:-4]}:{num}", "bbj": d["ghomala"], "fr": d["french"], "en": d["english"]})
bib_bbj = {norm(x["bbj"]) for x in bible}
print("Bible versets alignes", len(bible))

test = [r for r in maf["test"]]
write("bbj_mafand_test.jsonl", test)
s = random.sample(test, 200)
write("bbj_mafand_test200.jsonl", s)
write("bible_sample100.jsonl", random.sample(bible, 100))

probes = []
with open(os.path.join(HERE, "banking_probes.tsv"), encoding="utf-8-sig", newline="") as f:
    for i, r in enumerate(csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE)):
        ent = {"fr": re.findall(r"\{(.*?)\}", r["fr"]), "en": re.findall(r"\{(.*?)\}", r["en"])}
        assert len(ent["fr"]) == len(ent["en"]), r
        d = {"id": i, "journey": r["journey"], "entities_fr": ent["fr"], "entities_en": ent["en"]}
        for lang in ("fr", "en"):
            d[lang] = r[lang].replace("{", "").replace("}", "")
            n = iter(range(1, 99))
            d[lang + "_protected"] = re.sub(r"\{.*?\}", lambda m: f"ZZ{next(n)}ZZ", r[lang])
        probes.append(d)
write("banking_probes.jsonl", probes)
print(collections.Counter(p["journey"] for p in probes))
print("exemple", probes[15])

sor = os.path.join(DS, "soreva")
L = lambda n: [l.split("	") for l in open(os.path.join(sor, n), encoding="utf-8").read().splitlines()]
bbj, wes = L("bbj_cm.test.tsv"), L("pcm_cm.test.tsv")
refs = list(csv.DictReader(open(os.path.join(HERE, "soreva_refs.tsv"), encoding="utf-8-sig", newline=""), delimiter="	", quoting=csv.QUOTE_NONE))
assert len(bbj) == len(wes) == len(refs) == 150
rows = []
for b, w, r in zip(bbj, wes, refs):
    rows.append({"id": int(r["id"]), "cat": r["cat"], "en": r["en"], "fr": r["fr"], "wes": w[1].strip(), "bbj": b[1].strip(), "in_bandjoun": norm(b[1]) in ban_bbj, "audio_bbj": b[0], "audio_wes": w[0]})
write("soreva_aligned.jsonl", rows)
print("SOREVA bbj deja dans Bandjoun:", sum(r["in_bandjoun"] for r in rows), "| Bible:", sum(norm(r["bbj"]) in bib_bbj for r in rows))
print(collections.Counter(r["cat"] for r in rows))
