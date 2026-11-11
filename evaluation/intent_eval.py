"""Mesure la reconnaissance d'intention pidgin sur les transcriptions deja produites par stt_eval.py (aucun modele a recharger).

Usage (depuis KAMA/backend) : .venv/Scripts/python.exe ../evaluation/intent_eval.py [omni300 w2v_pidgin ...]
Lit evaluation/results/stt/<modele>_<jeu>.jsonl (champs ref = texte dit, hyp = texte reconnu).
  - Faux declenchements : parmi les phrases qui ne sont PAS des commandes (SOREVA, Common Voice), combien declenchent une intention ?
  - Phrases de commande : combien des phrases d'intention (texte exact) sont reconnues apres passage par la reconnaissance vocale ?
    Il n'existe pas d'audio humain de ces commandes : on les fait dire par la voix de synthese (backend/scripts), voir --synthese.
"""
import json
import sys
from pathlib import Path

DEPOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPOT / "backend"))
from app.services import IntentMatcher  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
DOSSIERS = [DEPOT / "evaluation" / "results" / "stt", DEPOT.parent / "evaluation" / "results" / "stt"]  # depot, puis dossier du projet


def main():
    matcher = IntentMatcher.from_file(DEPOT / "content-data" / "intents.json")
    modeles = sys.argv[1:] or ["omni300", "w2v_pidgin"]
    for modele in modeles:
        for jeu in ("soreva", "cv"):
            chemin = next((d / f"{modele}_{jeu}.jsonl" for d in DOSSIERS if (d / f"{modele}_{jeu}.jsonl").exists()), None)
            if chemin is None:
                continue
            lignes = [json.loads(l) for l in chemin.read_text(encoding="utf-8").splitlines() if l.strip()]
            declenchees = [(l, matcher.match(l["hyp"], "wes")) for l in lignes]
            faux = [(l, r) for l, r in declenchees if r.intent != "unknown"]
            vrais_sur_texte = [l for l in lignes if matcher.match(l["ref"], "wes").intent != "unknown"]
            print(f"{modele:<12} {jeu:<7} {len(lignes)} phrases : {len(faux)} faux declenchement(s) sur la parole reconnue ; "
                  f"{len(vrais_sur_texte)} phrase(s) dont le texte exact est deja une commande")
            for l, r in faux[:8]:
                print(f"     dit {l['ref'][:50]!r} / reconnu {l['hyp'][:50]!r} -> {r.intent} ({r.confidence})")


if __name__ == "__main__":
    main()
