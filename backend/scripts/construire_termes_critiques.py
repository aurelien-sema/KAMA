"""Construit content-data/termes_critiques_wes.json.

Sources : content-data/dictionnaire_pidgin.json et, si disponible,
training/pidgin/data/attestations.json (fichier hors depot). Les termes absents du
dictionnaire gardent une forme minimale, marquee a_valider, pour que le garde refuse
une sortie qui ne rend pas le terme important de la source.

Usage :
    python backend/scripts/construire_termes_critiques.py
    python backend/scripts/construire_termes_critiques.py --attestations <chemin>
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

DEPOT = Path(__file__).resolve().parents[2]
DICO = DEPOT / "content-data" / "dictionnaire_pidgin.json"
SORTIE = DEPOT / "content-data" / "termes_critiques_wes.json"

GROUPES = [
    {
        "id": "cancel",
        "sources": ["annul", "cancel"],
        "dico": ["cancel"],
        "formes": ["cancel", "canceled", "cancelled"],
    },
    {
        "id": "confirm",
        "sources": ["confirm"],
        "dico": ["confirm"],
        "formes": ["confirm", "confirmed", "confirm say"],
    },
    {
        "id": "send",
        "sources": ["envoi", "envoy", "send"],
        "dico": ["send"],
        "formes": ["send", "sent", "sen", "transfer"],
    },
    {
        "id": "transfer",
        "sources": ["transfert", "transfer", "virement"],
        "dico": [],
        "formes": ["send", "sent", "sen", "transfer", "transferred", "send money", "send di money"],
    },
    {
        "id": "block",
        "sources": ["bloqu", "block"],
        "dico": [],
        "formes": ["block", "blocked", "lock", "locked", "no open"],
    },
    {
        "id": "suspend",
        "sources": ["suspend"],
        "dico": ["for now, temporarily"],
        "formes": ["suspend", "suspended", "stop", "stopped", "hold", "held", "no work"],
    },
    {
        "id": "decline",
        "sources": ["refus", "declin"],
        "dico": [],
        "formes": ["refuse", "refused", "deny", "denied", "no gree", "no accept"],
    },
    {
        "id": "fail",
        "sources": ["echou", "échou", "fail"],
        "dico": [],
        "formes": ["fail", "failed", "no work", "problem", "mistake"],
    },
    {
        "id": "fee",
        "sources": ["frais", "fee"],
        "dico": ["fee, charge"],
        "formes": ["charge", "fee", "fees", "cost"],
    },
    {
        "id": "limit",
        "sources": ["plafond", "limit"],
        "dico": [],
        "formes": ["limit", "maximum", "pass", "no pass"],
    },
    {
        "id": "balance",
        "sources": ["solde", "balance"],
        "dico": ["balance, remain"],
        "formes": ["money weh remain", "money wey remain", "money weh go remain", "money weh you get",
                   "money wey you get", "remain", "remaining", "balance"],
    },
    {
        "id": "code",
        "sources": ["code secret", "code", "pin", "otp", "password", "mot de passe"],
        "dico": [],
        "formes": ["code", "pin", "otp", "password", "passcode", "secret code"],
    },
    {
        "id": "refund",
        "sources": ["rembours", "refund"],
        "dico": [],
        "formes": ["refund", "pay back", "return money", "give back"],
    },
]


def charger_dico() -> dict[str, dict]:
    if not DICO.exists():
        return {}
    termes = json.loads(DICO.read_text(encoding="utf-8"))["termes"]
    index: dict[str, dict] = {}
    for terme in termes:
        for nom in terme.get("en", "").split(","):
            index[nom.strip().lower()] = terme
    return index


def formes_du_dico(dico: dict[str, dict], noms: list[str]) -> tuple[list[str], str | None]:
    formes: list[str] = []
    statut = None
    for nom in noms:
        terme = dico.get(nom.lower())
        if not terme:
            continue
        statut = terme.get("statut") or statut
        formes.append(terme["pidgin"])
        formes.extend(terme.get("variantes", []))
    return formes, statut


def charger_attestations(chemin: Path | None) -> dict:
    if not chemin or not chemin.exists():
        return {}
    return json.loads(chemin.read_text(encoding="utf-8"))


def preuves_attestations(attestations: dict, groupe: str) -> int:
    cle = {"send": "send", "confirm": "confirm", "cancel": "cancel", "fee": "fee / charge",
           "balance": "balance / remain"}.get(groupe)
    return int(attestations.get(cle, {}).get("paires", 0)) if cle else 0


def construire(attestations: dict) -> dict:
    dico = charger_dico()
    termes = []
    for groupe in GROUPES:
        formes_dico, statut = formes_du_dico(dico, groupe["dico"])
        formes = []
        for forme in [*groupe["formes"], *formes_dico]:
            if forme and forme.lower() not in {f.lower() for f in formes}:
                formes.append(forme)
        termes.append(
            {
                "id": groupe["id"],
                "sources": groupe["sources"],
                "formes": formes,
                "statut": statut or "a_valider",
                "paires_attestations": preuves_attestations(attestations, groupe["id"]),
            }
        )
    return {
        "_note": "Termes critiques pour le garde de sortie. Formes issues de content-data/dictionnaire_pidgin.json "
                 "et, si disponible, training/pidgin/data/attestations.json. Les formes a_valider restent a confirmer "
                 "par un locuteur : le garde refuse une sortie qui ne les rend pas.",
        "genere_par": "backend/scripts/construire_termes_critiques.py",
        "terms": termes,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--attestations", type=Path, default=DEPOT / "training" / "pidgin" / "data" / "attestations.json")
    ap.add_argument("--sortie", type=Path, default=SORTIE)
    args = ap.parse_args()
    donnees = construire(charger_attestations(args.attestations))
    args.sortie.write_text(json.dumps(donnees, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(donnees['terms'])} termes -> {args.sortie}")


if __name__ == "__main__":
    main()
