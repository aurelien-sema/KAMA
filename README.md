# Kama — Ta banque expliquée dans ta langue

Extension de navigateur (Chrome / Edge) qui explique une interface bancaire en ligne dans la langue maternelle de l'utilisateur (ghomálá' en premier, puis pidgin camerounais), d'abord en audio, avec le texte en appui. Hackathon SAFINUM Innovate Challenge 2026.

## Structure du dépôt

- `backend/` — serveur intermédiaire sans état (Python / FastAPI) : traduction contrôlée, commandes vocales, synthèse vocale. Porte les modèles et les clés ; ne stocke aucune donnée bancaire.
- `content-data/` — phrases bancaires sources (`templates.json`) et grammaire vocale (`intents.json`).
- `evaluation/` — banc d'évaluation des modèles de traduction.
- `documentation/` — `SECURITE.md` (flux de données et garanties), `COMPOSANTS.md` (composants et services tiers, article 9 du règlement), `VOIE3_PIDGIN_A_VALIDER.md` (explications par catégorie, à valider par un locuteur), `JOURNAL.md`.

## Principes de sécurité

- Ne rien stocker, ne rien envoyer : les montants, noms et numéros ne quittent jamais l'écran.
- L'extension masque les données (`{x1}`, `{x2}`…) avant tout envoi ; le serveur rejette tout texte non masqué.
- Aucun modèle ne génère de chiffre ; sortie rejetée si un chiffre apparaît ou si une balise change.
- Audio traité en mémoire, jamais écrit sur disque ; seule l'intention sort.
- Origine filtrée, débit limité, journaux sans contenu, HTTPS en production.

## Règles d'or

1. **Les montants ne passent jamais par un modèle de langue.** Ils sont lus dans la page, recopiés au caractère près et insérés dans les réponses par gabarit. Kama ne calcule aucun montant.
2. **Kama ne clique jamais à la place de la personne** et ne remplit aucun champ : il explique et surligne.
3. **Kama ne modifie pas la page bancaire** : il ajoute seulement ses propres éléments (Shadow DOM).
4. **Aucun texte en langue nationale inventé.** Les textes viennent du glossaire validé par un locuteur ; sinon « Pas encore traduit » et repli sur la langue du navigateur.
5. **Accessibilité** : zones cliquables ≥ 44 px, contraste suffisant, jamais la couleur seule pour une erreur, aucune animation en boucle, tout utilisable au clavier avec des `aria-label`.

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
