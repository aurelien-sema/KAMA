"""Verifie que chaque texte releve sur la page de test est couvert par les regles fixes.

Usage : python -I check_page_catalog.py [releve.json]
Le releve par defaut est testsets/page_test_snapshot.json (produit par walk_test_page.py).
"""
import json
import os
import re
import sys
import unicodedata

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG = os.path.join(os.path.dirname(HERE), "content-data", "safinum_test_page.json")
SNAPSHOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "testsets", "page_test_snapshot.json")


def norm(text):
    text = unicodedata.normalize("NFC", text).replace("’", "'").replace(" ", " ").replace(" ", " ")
    return " ".join(text.split())


catalog = json.load(open(CATALOG, encoding="utf-8"))
exact = {}
for entry in catalog["entries"]:
    for lang in ("fr", "en"):
        values = entry[lang] if isinstance(entry[lang], list) else [entry[lang]]
        for value in values:
            exact[(lang, norm(value))] = entry["id"]
protected = [(p["id"], re.compile(p["regex"])) for p in catalog["protected"]]
patterns = [(p["id"], {lang: re.compile(p[lang]) for lang in ("fr", "en")}) for p in catalog["patterns"]]
ids = [e["id"] for e in catalog["entries"]]
assert len(ids) == len(set(ids)), "identifiants en double"
for p in catalog["patterns"]:
    assert p["wes"].count("{x") == patterns[[i for i, _ in patterns].index(p["id"])][1]["fr"].groups, p["id"]

snapshot = json.load(open(SNAPSHOT, encoding="utf-8"))
counts = {"catalogue": 0, "motif": 0, "protege": 0, "position": 0}
missing, used = {}, set()
for screen, data in snapshot.items():
    lang = screen[:2]
    texts = data["texts"]
    for i, item in enumerate(texts):
        text = norm(item["text"])
        kind = None
        if (lang, text) in exact:
            used.add(exact[(lang, text)])
            kind = "catalogue"
        elif any(rx.fullmatch(text) for _, rx in protected):
            kind = "protege"
        elif any(rx[lang].fullmatch(text) for _, rx in patterns):
            kind = "motif"
        else:
            previous = norm(texts[i - 1]["text"]) if i else ""
            label_entry = exact.get((lang, previous))
            is_dd = item["tag"] == "dd" and label_entry in {"beneficiaire", "telephone", "reference"}
            is_user = bool(re.fullmatch("[A-Z]{2}", previous))  # le nom suit toujours les initiales de la personne
            if is_dd or is_user:
                kind = "position"
        if kind:
            counts[kind] += 1
        else:
            missing.setdefault(text, screen)

print("Occurrences classees :", counts)
print("Entrees du catalogue :", len(ids), "| vues sur la page :", len(used))
print("Non vues au parcours (messages d'erreur ou ecrans conditionnels) :", sorted(set(ids) - used))
if missing:
    print("TEXTES NON COUVERTS :", len(missing))
    for text, screen in missing.items():
        print(" -", screen, "|", text)
    sys.exit(1)
print("OK : tous les textes releves sont couverts.")
