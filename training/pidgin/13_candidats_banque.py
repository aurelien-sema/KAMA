"""Controle les phrases candidates (candidats_banque.json) et prepare les ajouts au dictionnaire, a partir de 12_emplois_financiers.py.

1. Candidats : pour chacun, verifie (a) que les balises {x1}... sont les memes en anglais, francais et pidgin, (b) que les mots pidgin sont connus
   (lexique des corpus + textes valides de la page + dictionnaire), sinon ils sont listes pour qu'un locuteur les regarde, (c) que le terme cle
   est rendu par une forme attestee. Rien n'est ecrit dans les textes valides.
2. Dictionnaire : propose des entrees pour les termes financiers absents, avec le nombre d'emplois propres du corpus (statut 'atteste' a partir de 5,
   sinon 'a_valider'). Ecrit dictionnaire_pidgin_ajouts.json (non charge par le serveur ; 10_termes_critiques.py le lit en plus du dictionnaire).
Usage : python 13_candidats_banque.py
"""
import json
import re
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
DEPOT = ICI.parents[1]
DATA = ICI / "data"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
MOT = re.compile(r"[a-zà-ÿ']+")
BALISE = re.compile(r"\{x\d+\}")

FORMES = {  # terme cle -> formes pidgin acceptees (dictionnaire, corpus, page validee)
    "cancel": ["cancel"], "money": ["money"], "pay": ["pay"], "tax": ["tax"], "price": ["price"], "bill": ["bill"], "owe": ["owe"], "debt": ["debt"],
    "loan": ["loan", "borrow"], "insurance": ["insurance"], "cash": ["cash"], "buy": ["buy"], "deposit": ["put"], "withdraw": ["comot"],
    "interest": ["interest"], "savings": ["keep"], "take": ["take"], "account": ["account"], "fee": ["charge"], "bank": ["bank"], "send": ["send"],
    "confirm": ["confirm"], "salary": ["salary"], "check": ["check"], "safe": ["safe"], "person": ["person"], "receive": ["get"], "shop": ["shop"],
    "balance": ["money"],
}
AJOUTS = {  # concept du corpus -> (francais, anglais, forme proposee)
    "tax": ("impôt, taxe", "tax", "tax"), "buy": ("acheter", "buy", "buy"), "sell": ("vendre", "sell", "sell"),
    "price": ("prix", "price", "price"), "cash": ("espèces", "cash", "cash"), "insurance": ("assurance", "insurance", "insurance"),
    "owe": ("devoir (une somme)", "owe", "owe"), "debt": ("dette", "debt", "debt"), "loan": ("prêt", "loan", "loan"),
    "savings": ("épargne", "savings", "money weh you don keep"), "credit_card": ("carte bancaire", "card", "card"),
    "expenses": ("dépenses", "expenses", "money weh you spend"),
}


def main():
    lexique = set((DATA / "lexique_atteste.txt").read_text(encoding="utf-8").split())
    page = json.loads((DEPOT / "content-data" / "safinum_test_page.json").read_text(encoding="utf-8"))
    dico = json.loads((DEPOT / "content-data" / "dictionnaire_pidgin.json").read_text(encoding="utf-8"))
    connus = lexique | {m for e in page["entries"] for m in MOT.findall(e["wes"].lower())}
    connus |= {m for t in dico["termes"] for f in [t["pidgin"], *t.get("variantes", [])] for m in MOT.findall(f.lower())}

    candidats = json.loads((ICI / "candidats_banque.json").read_text(encoding="utf-8"))["candidats"]
    inconnus_total = {}
    problemes = 0
    for c in candidats:
        mots = MOT.findall(BALISE.sub(" ", c["wes"]).lower())
        inconnus = [m for m in mots if m not in connus]
        balises = [sorted(BALISE.findall(c[k])) for k in ("en", "fr", "wes")]
        sans_forme = [t for t in c["termes"] if t in FORMES and not any(f in mots for f in FORMES[t])]
        ok = not inconnus and balises[0] == balises[1] == balises[2] and not sans_forme
        problemes += not ok
        if not ok:
            print(f"A REVOIR {c['id']:<16} {c['wes']!r}")
            if inconnus:
                print(f"      mots inconnus des corpus : {inconnus}")
            if balises[0] != balises[1] or balises[0] != balises[2]:
                print(f"      balises differentes : {balises}")
            if sans_forme:
                print(f"      terme sans forme attestee : {sans_forme}")
        for m in inconnus:
            inconnus_total[m] = inconnus_total.get(m, 0) + 1
    print(f"\n{len(candidats)} candidats : {len(candidats) - problemes} sans alerte, {problemes} a regarder")
    print(f"mots inconnus : {inconnus_total}\n")

    synthese = json.loads((DATA / "emplois_financiers.json").read_text(encoding="utf-8"))
    existants = {t["en"].split(",")[0].strip() for t in dico["termes"]} | {x.strip() for t in dico["termes"] for x in t["en"].split(",")}
    ajouts, lacunes = [], []
    for concept, (fr, en, forme) in AJOUTS.items():
        s = synthese.get(concept)
        if concept in existants or s is None:
            continue
        n = s["rendu_par_forme_attendue"]
        variantes = sorted({f.split(" (")[0] for f in s["formes"] if f.split(" (")[0] != forme.lower()})
        ajouts.append({"fr": fr, "en": en, "pidgin": forme, "variantes": variantes, "statut": "atteste" if n >= 5 else "a_valider",
                       "preuves": {"MT560 (emplois financiers propres)": n, "phrases trouvees": s["phrases"]},
                       "exemple": s["exemples"][0] if s["exemples"] else None})
    for terme in ("deposit", "withdraw", "refund", "transfer"):
        s = synthese.get(terme, {"rendu_par_forme_attendue": 0, "phrases": 0})
        lacunes.append({"en": terme, "emplois_propres_dans_le_corpus": s["rendu_par_forme_attendue"], "phrases": s["phrases"]})
    sortie = {
        "_note": "Ajouts PROPOSES au dictionnaire, tires des emplois financiers propres du corpus (sans texte religieux, sans faux sens, chiffres identiques). "
                 "Non charge par le serveur. statut 'atteste' = au moins 5 emplois propres ; 'a_valider' = moins, a faire confirmer par un locuteur natif. "
                 "'lacunes' = termes bancaires essentiels sans aucun emploi exploitable dans le corpus : seul un locuteur peut les fournir.",
        "termes": ajouts, "lacunes": lacunes,
    }
    (ICI / "dictionnaire_pidgin_ajouts.json").write_text(json.dumps(sortie, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"dictionnaire_pidgin_ajouts.json : {len(ajouts)} termes proposes ({sum(a['statut'] == 'atteste' for a in ajouts)} attestes, "
          f"{sum(a['statut'] == 'a_valider' for a in ajouts)} a valider), {len(lacunes)} lacunes")
    for a in ajouts:
        print(f"   {a['en']:<14}{a['pidgin']:<24}{a['statut']:<10}{a['preuves']}  variantes {a['variantes']}")
    for l in lacunes:
        print(f"   LACUNE {l}")


if __name__ == "__main__":
    main()
