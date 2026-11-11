"""Prepare l'essai « reentrainement avec les donnees financieres » pour Colab. Rien n'est entraine ici.

Comparaison honnete avec v2 : meme base (jamm55), memes reglages (02_entrainer.py, 8 passes max), memes donnees v2 ; seul change le poids des phrases d'argent.
  data_propre : v2 + les emplois financiers PROPRES (12_emplois_financiers.py : sans religion, sans faux sens, chiffres identiques, orthographe a l'anglaise) repetes 4 fois
  data_brut   : v2 + toutes les paires v2 contenant un mot financier (comme le fichier finance_en_wes.csv : religion et faux sens compris) repetees 2 fois
Garde-fous : aucune phrase du dev ni du test SOREVA dans l'entrainement ; les brouillons de candidats_banque.json (non valides) n'y entrent pas.
Sortie : export_drive/KAMA_pidgin_finance_drive.zip (a mettre dans Mon Drive, comme KAMA_pidgin_drive.zip). Aucun texte du corpus n'est ajoute a Git.
Usage : python 14_preparer_finance.py
"""
import json
import re
import sys
import zipfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
DEPOT = ICI.parents[1]
V2 = DEPOT / "datasets" / "pidgin" / "kama_pidgin_v2"
SORTIE = ICI / "export_drive"
TMP = ICI / "data" / "essai_finance"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

MOTS_FINANCIERS = re.compile(
    r"\b(money|pay|pays|paid|paying|tax|taxes|buy|buys|bought|sell|sells|sold|bank|banks|owe|owed|debt|debts|loan|loans|price|prices|cost|costs|"
    r"cash|salary|wage|wages|budget|savings|expenses?|insurance|credit|debit|fees?|rich|poor|wealth|coins?|market|markets|borrow(ed)?|lend(ing)?|"
    r"repay|finance[sd]?|financial(ly)?|economic|amount|transfer|exchange|bills?)\b", re.I)


def lire(chemin):
    return [json.loads(l) for l in chemin.read_text(encoding="utf-8").splitlines() if l.strip()]


def ecrire(chemin, lignes):
    chemin.write_text("\n".join(json.dumps(l, ensure_ascii=False) for l in lignes) + "\n", encoding="utf-8")


def main():
    train, dev, test = lire(V2 / "train.jsonl"), lire(V2 / "dev.jsonl"), lire(V2 / "test_soreva.jsonl")
    interdits = {x["en"].strip().lower() for x in dev + test}
    propres = []
    vus = set()
    for r in lire(ICI / "data" / "emplois_financiers.jsonl"):
        cle = r["en"].strip().lower()
        if r["style"] != "anglais" or cle in vus or cle in interdits:
            continue
        vus.add(cle)
        propres.append({"en": r["en"], "wes": r["wes"], "source": "mt560-financier-propre", "domaine": "banque", "licence": "CC BY 4.0"})
    bruts = [l for l in train if MOTS_FINANCIERS.search(l["en"]) and l["en"].strip().lower() not in interdits]

    variantes = {"propre": train + propres * 4, "brut": train + bruts * 2}
    for nom, lignes in variantes.items():
        assert not ({l["en"].strip().lower() for l in lignes} & interdits), "fuite : une phrase du dev ou du test est dans l'entrainement"
        d = TMP / f"data_{nom}"
        d.mkdir(parents=True, exist_ok=True)
        ecrire(d / "train.jsonl", lignes)
        ecrire(d / "dev.jsonl", dev)
        ecrire(d / "test_soreva.jsonl", test)
        print(f"data_{nom}: train {len(lignes)} (v2 {len(train)} + {len(lignes) - len(train)} lignes financieres), dev {len(dev)}, test {len(test)}")
    print(f"emplois propres distincts : {len(propres)} ; paires v2 avec un mot financier (brut) : {len(bruts)}")

    SORTIE.mkdir(exist_ok=True)
    archive = SORTIE / "KAMA_pidgin_finance_drive.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
        for nom in variantes:
            for f in ("train.jsonl", "dev.jsonl", "test_soreva.jsonl"):
                z.write(TMP / f"data_{nom}" / f, f"KAMA/pidgin_finance/data_{nom}/{f}")
        z.write(ICI / "02_entrainer.py", "KAMA/pidgin_finance/02_entrainer.py")
        z.write(ICI / "entrainement_finance_colab.ipynb", "KAMA/pidgin_finance/entrainement_finance_colab.ipynb")
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        json.loads(z.read("KAMA/pidgin_finance/entrainement_finance_colab.ipynb"))
    print(archive, f"{archive.stat().st_size / 1048576:.1f} Mo")


if __name__ == "__main__":
    main()
