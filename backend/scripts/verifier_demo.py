"""Verifie qu'un serveur Kama deja lance repond comme l'extension l'attend (a lancer avant d'ouvrir le navigateur).

Usage : python scripts/verifier_demo.py [adresse] [origine]
  adresse : http://127.0.0.1:8000 par defaut
  origine : chrome-extension://nneecloagollpakilpepnamdaelmgkbn par defaut (identifiant fixe par la cle de wxt.config.ts)

Aucune dependance : bibliotheque standard seulement. Code de sortie 0 si tout ce qui est obligatoire passe.
"""
import io
import json
import sys
import urllib.error
import urllib.request
import wave

ADRESSE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
ORIGINE = sys.argv[2] if len(sys.argv) > 2 else "chrome-extension://nneecloagollpakilpepnamdaelmgkbn"
resultats: list[tuple[str, str, str]] = []  # (etat, nom, detail)


def appel(chemin, corps=None, origine=ORIGINE, type_contenu="application/json", entetes=None):
    donnees = corps if isinstance(corps, bytes) else (json.dumps(corps).encode() if corps is not None else None)
    req = urllib.request.Request(ADRESSE + chemin, data=donnees, method="POST" if donnees is not None else "GET")
    if origine:
        req.add_header("Origin", origine)
    if donnees is not None:
        req.add_header("Content-Type", type_contenu)
    for k, v in (entetes or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except ValueError:
            return e.code, {}


def verifie(nom, condition, detail="", obligatoire=True):
    resultats.append(("OK" if condition else ("ECHEC" if obligatoire else "A VOIR"), nom, detail))


def main():
    try:
        statut, _ = appel("/healthz", origine=None)
    except Exception as e:  # serveur eteint
        print(f"Le serveur ne repond pas sur {ADRESSE} ({type(e).__name__}). Lance d'abord scripts/lancer_demo.ps1.")
        return 2
    verifie("Le serveur repond (/healthz)", statut == 200)

    statut, cap = appel("/v1/capabilities")
    langues = {l["code"]: l for l in cap.get("languages", [])} if statut == 200 else {}
    verifie("Origine de l'extension acceptee (/v1/capabilities)", statut == 200, f"statut {statut}")
    wes = langues.get("wes", {})
    verifie("Pidgin : voix de synthese disponible", bool(wes.get("tts")))
    verifie("Pidgin : reconnaissance vocale (micro) disponible", bool(wes.get("asr")), "sinon le micro dira « La voix ne marche pas encore »", obligatoire=False)
    bbj = langues.get("bbj", {})
    verifie("Ghomala : traduction disponible", bool(bbj.get("translation_from")), "attendu desactive tant que le modele n'est pas valide", obligatoire=False)

    statut, _ = appel("/v1/capabilities", origine="https://autre-site.example")
    verifie("Une autre origine est refusee (403)", statut == 403, f"statut {statut}")

    statut, r = appel("/v1/translate", {"text": "Frais", "source_lang": "fr", "target_lang": "wes", "element": "text"})
    verifie("Libelle valide de la page : « Verifie » depuis la memoire", statut == 200 and r.get("badge") == "verified", json.dumps(r, ensure_ascii=False))
    traduit = r.get("text") or ""

    statut, r = appel("/v1/translate", {"text": "Frais : 500 FCFA.", "source_lang": "fr", "target_lang": "wes", "element": "fee"})
    verifie("Un montant non masque est refuse (422)", statut == 422 and r.get("error", {}).get("code") == "unmasked_content", f"statut {statut}")

    statut, r = appel("/v1/translate", {"text": "Frais : {x1}.", "source_lang": "fr", "target_lang": "wes", "element": "fee"})
    verifie("Phrase critique non validee : jamais de traduction automatique", statut == 200 and r.get("badge") != "machine", json.dumps(r, ensure_ascii=False))

    statut, r = appel("/v1/translate", {"text": "Bienvenue dans la nouvelle version de l'application.", "source_lang": "fr", "target_lang": "wes", "element": "text"})
    verifie("Texte inedit non critique : traduit ou refuse proprement", statut == 200 and r.get("badge") in ("machine", "untranslated"), json.dumps(r, ensure_ascii=False), obligatoire=False)

    if traduit:
        statut, r = appel("/v1/tts", {"text": traduit, "lang": "wes"})
        segments = r.get("segments", []) if statut == 200 else []
        verifie("Synthese vocale d'une phrase validee", statut == 200 and any(s.get("type") == "audio" for s in segments), f"statut {statut}")
    statut, r = appel("/v1/tts", {"text": "You get {x1} for your account.", "lang": "wes"})
    types = [s.get("type") for s in r.get("segments", [])] if statut == 200 else []
    verifie("Le montant n'est jamais synthetise : une balise est renvoyee", statut == 200 and "slot" in types, f"segments {types}", obligatoire=False)

    silence = io.BytesIO()
    with wave.open(silence, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b"\0\0" * 16000)
    statut, r = appel("/v1/voice/intent", silence.getvalue(), type_contenu="audio/wav", entetes={"X-Kama-Lang": "wes"})
    verifie("Reconnaissance d'une commande (silence : « unknown » attendu)", statut == 200 and r.get("intent") == "unknown", f"statut {statut} {r}", obligatoire=False)

    largeur = max(len(n) for _, n, _ in resultats)
    for etat, nom, detail in resultats:
        print(f"[{etat:^7}] {nom:<{largeur}}  {detail if etat != 'OK' else ''}")
    echecs = [n for e, n, _ in resultats if e == "ECHEC"]
    print("\nTout ce qui est obligatoire passe." if not echecs else f"\n{len(echecs)} verification(s) obligatoire(s) en echec.")
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
