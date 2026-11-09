# Backend de Kama

Serveur intermédiaire sans état : traduction contrôlée, commandes vocales, synthèse vocale. La conception est décrite dans [ARCHITECTURE.md](ARCHITECTURE.md).

## Lancer en local

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt     # Windows
.venv/Scripts/python -m pip install -r requirements-mt.txt  # moteurs de traduction
.venv/Scripts/python -m app
```

Le serveur écoute sur `http://127.0.0.1:8000`. La documentation interactive est sur `/docs`, uniquement hors production.

## Tests

```bash
.venv/Scripts/python -m pip install -r requirements-dev.txt
.venv/Scripts/python -m pytest
```

## Contrat pour l'extension

- `contracts/openapi.json` : routes et formats. Régénérer avec `python -m app.export_openapi`.
- `contracts/masking_vectors.json` : exemples que le masquage de l'extension doit reproduire.

## Configuration

Les variables sont listées dans [.env.example](.env.example). En production, `KAMA_ENV=prod` et `KAMA_ALLOWED_ORIGINS` sont obligatoires, et le serveur doit rester derrière un proxy HTTPS.

Les poids des modèles ne sont pas dans ce dépôt : `KAMA_MODELS_DIR` indique leur dossier.
