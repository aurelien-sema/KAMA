# Kama — Ta banque expliquée dans ta langue

Extension de navigateur (Chrome / Edge) qui explique une interface bancaire en ligne dans la langue maternelle de l'utilisateur (ghomálá' en premier, puis pidgin camerounais), d'abord en audio, avec le texte en appui. Hackathon SAFINUM Innovate Challenge 2026.

## Structure du dépôt

- `backend/` — serveur intermédiaire sans état (Python / FastAPI) : traduction contrôlée, commandes vocales, synthèse vocale. Porte les modèles et les clés ; ne stocke aucune donnée bancaire.
- `content-data/` — phrases bancaires sources (`templates.json`) et grammaire vocale (`intents.json`).
- `documentation/` — `CLARIFICATIONS.md`, `JOURNAL.md`.

## Principes de sécurité

- Ne rien stocker, ne rien envoyer : les montants, noms et numéros ne quittent jamais l'écran.
- L'extension masque les données (`{x1}`, `{x2}`…) avant tout envoi ; le serveur rejette tout texte non masqué.
- Aucun modèle ne génère de chiffre ; sortie rejetée si un chiffre apparaît ou si une balise change.
- Audio traité en mémoire, jamais écrit sur disque ; seule l'intention sort.
- Origine filtrée, débit limité, journaux sans contenu, HTTPS en production.

## Lancer le backend en local

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m app
```

Le serveur écoute sur `http://127.0.0.1:8000` ; documentation interactive sur `/docs` hors production.

## Tests

```bash
cd backend
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest
```

## Configuration

Variables listées dans `backend/.env.example`. En production : `KAMA_ENV=prod` et `KAMA_ALLOWED_ORIGINS` obligatoires, serveur derrière un proxy HTTPS. Le serveur ne lit pas de fichier `.env` tout seul.
