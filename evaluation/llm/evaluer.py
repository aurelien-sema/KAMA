"""Mesure un LLM candidat (serveur llama.cpp local) sur le jeu d'évaluation de Kama.

Usage : python evaluation/llm/evaluer.py [--url http://127.0.0.1:8081] [--sortie evaluation/llm/resultats_lfm3.csv]
Sans dépendance (bibliothèque standard). Affiche un résumé court ; le détail de chaque cas va dans le CSV.
Règles de notation : voir `_regles_de_notation` dans jeu_kama_llm.json. Le pidgin est envoyé tel quel (décision du 2026-11-14).
"""
from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.app.llm import SYSTEM as BACKEND_SYSTEM, answer_problem

ICI = Path(__file__).resolve().parent
INTENTIONS = ["ask_balance", "ask_fees", "ask_total", "what_to_do", "explain_error", "repeat"]
EXPLICATIONS = {
    "AMOUNT_001": "The amount is not valid (must be greater than zero).",
    "AMOUNT_002": "Not enough money in the account for this operation.",
    "BENEFICIARY_001": "The recipient's name or phone number is missing.",
    "SECURITY_001": "Warning: check the recipient's phone number.",
    "SECURITY_002": "Warning: you have never sent money to this person.",
    "NETWORK_001": "The bank is not responding; try again later.",
    "CONFIRM_001": "The confirmation box was not ticked.",
}

SYSTEM = BACKEND_SYSTEM + """
Examples for the intent task (do not answer unknown when the question matches an intent):
- "c'est combien le solde" / "how much is in my account" -> ask_balance
- "combien je vais payer en plus" / "what is the charge" / "na how much be di charge" -> ask_fees
- "au total ça fait combien" / "how much in all" -> ask_total
- "je fais quoi maintenant" / "how do I continue" -> what_to_do
- "pourquoi c'est refusé" / "what does this red message mean" / "why e no go" -> explain_error
- "redis-moi ça" / "repeat please" / "say am again" -> repeat"""


def schema(cas: dict, contextes: dict) -> dict:
    tache = cas["task"]
    if tache == "answer":
        return {"type": "object", "properties": {"kind": {"enum": ["answer", "unknown"]}, "text": {"type": "string", "maxLength": 300}},
                "required": ["kind"]}
    if tache == "intent":
        valeurs = INTENTIONS
    elif tache == "select_element":
        valeurs = [e["id"] for e in contextes[cas["contexte"]]["elements"]]
    else:
        valeurs = list(EXPLICATIONS)
    genre = {"intent": "intent", "select_element": "element", "map_bank_message": "bank_message"}[tache]
    # « unknown » seul, ou le type attendu AVEC sa valeur (obligatoire).
    return {"anyOf": [
        {"type": "object", "properties": {"kind": {"const": "unknown"}}, "required": ["kind"], "additionalProperties": False},
        {"type": "object", "properties": {"kind": {"const": genre}, "value": {"enum": valeurs}}, "required": ["kind", "value"], "additionalProperties": False},
    ]}


def demande(cas: dict, contextes: dict) -> str:
    entree = {"task": cas["task"], "text": cas["text"]}
    if cas.get("contexte"):
        ctx = contextes[cas["contexte"]]
        entree["context"] = {
            "screen": ctx["screen"],
            "elements": [{k: v for k, v in e.items() if k != "value"} for e in ctx["elements"]],
        }
    if cas["task"] == "map_bank_message":
        entree["candidates"] = [{"id": k, "meaning": v} for k, v in EXPLICATIONS.items()]
    return json.dumps(entree, ensure_ascii=False)


def appeler(url: str, cas: dict, contextes: dict) -> tuple[str, float]:
    corps = {
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": demande(cas, contextes)}],
        "temperature": 0,
        "max_tokens": 200,
        "response_format": {"type": "json_schema", "json_schema": {"schema": schema(cas, contextes)}},
        "cache_prompt": True,  # les consignes, identiques à chaque appel, ne sont lues qu'une fois
        "id_slot": 0,
    }
    req = urllib.request.Request(f"{url}/v1/chat/completions", data=json.dumps(corps).encode(), headers={"Content-Type": "application/json"})
    debut = time.perf_counter()
    with urllib.request.urlopen(req, timeout=120) as r:
        rep = json.loads(r.read())
    return rep["choices"][0]["message"]["content"], time.perf_counter() - debut


def noter(cas: dict, brut: str, contextes: dict) -> tuple[bool, bool, str]:
    """(json_valide, reussi, motif)."""
    try:
        sortie = json.loads(brut)
    except json.JSONDecodeError:
        return False, False, "json invalide"
    att = cas["attendu"]
    kind = sortie.get("kind")
    if kind == "unknown":
        ok = att["kind"] == "unknown" or att.get("unknown_ok", False)
        return True, ok, "" if ok else "unknown inattendu"
    if att["kind"] == "unknown":
        return True, False, f"aurait dû dire unknown ({kind})"
    if kind != att["kind"]:
        return True, False, f"type {kind}"
    if kind == "answer":
        texte = sortie.get("text") or ""
        probleme = answer_problem(texte, allowed=set())
        if probleme:
            return True, False, probleme
        bas = texte.lower()
        interdit = next((m for m in att["interdits"] if m.lower() in bas), None)
        return True, interdit is None, f"mot interdit « {interdit} »" if interdit else ""
    attendu = att.get("intent") or att.get("candidate_id") or att.get("explanation_id")
    ok = sortie.get("value") == attendu
    return True, ok, "" if ok else f"{sortie.get('value')} au lieu de {attendu}"


def main() -> None:
    args = argparse.ArgumentParser()
    args.add_argument("--url", default="http://127.0.0.1:8081")
    args.add_argument("--sortie", default=str(ICI / "resultats_lfm3.csv"))
    a = args.parse_args()
    jeu = json.loads((ICI / "jeu_kama_llm.json").read_text(encoding="utf-8"))
    lignes, durees = [], []
    for cas in jeu["cas"]:
        try:
            brut, duree = appeler(a.url, cas, jeu["contextes"])
        except Exception as exc:  # serveur absent, délai dépassé
            brut, duree = "", 0.0
            print(f"  {cas['id']} : erreur d'appel ({type(exc).__name__})")
        valide, ok, motif = noter(cas, brut, jeu["contextes"]) if brut else (False, False, "pas de réponse")
        durees.append(duree)
        lignes.append({"id": cas["id"], "lang": cas["lang"], "task": cas["task"], "piege": cas.get("piege", ""),
                       "reussi": ok, "json_valide": valide, "motif": motif, "duree_s": round(duree, 2), "sortie": brut})
    with open(a.sortie, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(lignes[0]), delimiter=";")
        w.writeheader()
        w.writerows(lignes)

    def taux(groupe):
        return f"{sum(l['reussi'] for l in groupe)}/{len(groupe)}"

    print(f"\nRésultat global : {taux(lignes)}   JSON valide : {sum(l['json_valide'] for l in lignes)}/{len(lignes)}")
    par = defaultdict(list)
    for l in lignes:
        par[("langue", l["lang"])].append(l)
        par[("tâche", l["task"])].append(l)
    for (genre, nom), groupe in sorted(par.items()):
        print(f"  {genre:<7}{nom:<17}{taux(groupe)}")
    pieges = [l for l in lignes if l["piege"]]
    print(f"  pièges          {taux(pieges)}")
    d = sorted(x for x in durees if x)
    if d:
        print(f"Latence : médiane {statistics.median(d):.2f} s, 90e centile {d[int(0.9 * (len(d) - 1))]:.2f} s")
    echecs = [l for l in lignes if not l["reussi"]]
    print(f"Échecs ({len(echecs)}) :")
    for l in echecs[:15]:
        print(f"  {l['id']:<13}{l['motif']}")
    print(f"Détail : {a.sortie}")


if __name__ == "__main__":
    main()
