# Journal de documentation de KAMA

Ce fichier retrace ce qui a été implémenté dans le projet et la démarche suivie. Il est mis à jour à la demande de Dimitri, et non à chaque modification du code.

## Format d'une entrée

```markdown
## AAAA-MM-JJ — Sujet

**Auteur :** Dimitri

### Ce qui a été implémenté

### Démarche utilisée

### Résultats et limites connues

### Composants tiers utilisés
```

La section « Composants tiers utilisés » liste chaque modèle, jeu de données ou service externe avec sa licence, car le règlement du SAFINUM Innovate Challenge impose de les déclarer.

## Entrées

## 2026-11-09 — Données, banc d'évaluation et backend

**Auteur :** Dimitri

### Ce qui a été implémenté

**Décision de langues :** le projet porte sur le Ghomala en premier, puis le pidgin camerounais. Le Fulfulde est mis de côté.

**Dans le dépôt, `backend/` :** serveur intermédiaire sans état, en Python et FastAPI.

- `POST /v1/translate` : traduction de textes déjà masqués, dans cet ordre : phrase validée, phrase validée très proche, modèle sous contrôle, sinon « Pas encore traduit ».
- `POST /v1/voice/intent` : audio WAV vers intention fermée. Le serveur ne renvoie que l'intention.
- `POST /v1/tts` : synthèse des morceaux situés entre les balises, sans jamais recevoir les nombres.
- `GET /v1/capabilities` et `GET /healthz`.
- Sécurité : refus des textes non masqués, contrôle d'origine, limitation de débit en mémoire, limite de taille, journal sans contenu, erreurs sans recopie du texte reçu.
- Contrat pour le front dans `backend/contracts/` : `openapi.json` et `masking_vectors.json`.

**Dans le dépôt, `content-data/` :** 64 phrases bancaires sources en français et en anglais (`templates.json`), et la grammaire des commandes vocales (`intents.json`). Les traductions restent à fournir par des locuteurs natifs.

**Hors dépôt, dans le dossier du projet :**

- `datasets/` : corpus Ghomala, pidgin et Fulfulde collectés.
- `models/` : poids des modèles testés.
- `evaluation/` : banc de test de traduction.

### Démarche utilisée

1. Collecte des corpus, puis mesure de leur contenu : orthographe, recouvrements, vocabulaire bancaire.
2. Lecture du règlement, du document UX et du document de sécurité, pour en déduire les contraintes du backend.
3. Construction d'un jeu de test sans fuite d'entraînement. Toutes les phrases de MAFAND se retrouvent dans le corpus Bandjoun : MAFAND ne vaut donc pas comme test pour les modèles entraînés sur Bandjoun. SOREVA, guide de conversation aligné Ghomala–pidgin, sert de référence indépendante. Ses versions française et anglaise ont été rédigées à partir du pidgin et restent à relire.
4. Sélection de 20 modèles selon leur sens de traduction et les scores publiés par Masakhane.
5. Conception du backend autour d'une règle : aucun montant, nom ou numéro ne doit atteindre le serveur.
6. Vérification par tests automatiques, puis démarrage du serveur réel.

Choix de conception à noter :

- Les balises sont numérotées (`{x1}`, `{x2}`), car une langue cible peut changer l'ordre des mots.
- Le contenu critique (argent, conditions, alertes) n'est jamais confié à un modèle non validé par défaut.
- La traduction automatique est désactivée par défaut, conformément à la règle « aucun texte en langue nationale inventé ».
- Le micro envoie du WAV PCM 16 kHz, pour éviter un décodeur audio complexe côté serveur.

### Résultats et limites connues

- Backend : 92 tests automatiques réussis.
- Évaluation des modèles : en cours au moment de cette entrée, sans score final. Un premier essai sur quelques phrases montre que le modèle Flagship perd les montants et invente du contenu sur les phrases bancaires.
- Le corpus collecté ne contient presque aucun vocabulaire bancaire. Les traductions doivent venir de locuteurs natifs.
- Tant que `templates.json` n'est pas rempli, le serveur répond surtout « Pas encore traduit ».
- La reconnaissance et la synthèse vocales ont leurs routes, mais aucun moteur n'est branché.
- La voix peut contenir un montant prononcé par l'utilisateur. Elle n'est ni stockée ni journalisée.
- Avant tout déploiement avec une banque, la loi camerounaise n° 2024/017 impose une validation par un juriste, notamment pour un hébergement hors du Cameroun.

### Composants tiers utilisés

**Logiciels du backend**

| Composant | Licence |
|---|---|
| FastAPI, Pydantic, CTranslate2 | MIT |
| Uvicorn | BSD-3-Clause |
| SentencePiece | Apache 2.0 |

**Service externe prévu :** VPS Contabo pour l'hébergement du backend.

**Outil d'évaluation :** llama.cpp (MIT), hors dépôt.

**Données**

| Ressource | Licence ou statut | Usage |
|---|---|---|
| MAFAND fr-bbj | CC BY-NC 4.0 | Évaluation |
| french-ghomala-bandjoun | Apache 2.0 (indication Hugging Face) | Analyse |
| Bible parlée Ghomala | CC BY 4.0 sur l'apport du projet ; textes bibliques aux éditeurs | Analyse |
| MT560 anglais-pidgin | CC BY 4.0 (indication Hugging Face) | Évaluation prévue |
| SOREVA | CC BY 4.0 | Évaluation |
| Stop Arnaque 237 | CC BY 4.0 | Inspiration des cas de test |
| Common Voice Fulfulde | CC0 | Collecté, non utilisé |
| Corpus oral Oxford du pidgin | Droits à clarifier (sources divergentes) | Collecté, non utilisé |

**Modèles en cours d'évaluation**

| Modèle | Licence indiquée |
|---|---|
| flagship-ai/cameroon-int8 | CC BY-NC 4.0 |
| masakhane/m2m100_418M (6 variantes fr-bbj et bbj-fr) | AFL-3.0 |
| fotiecodes/Turaco-mt-fr-gh | MIT indiqué, mais fine-tuning de NLLB (CC BY-NC) |
| fotiecodes/Turaco-NLLB-mt-en-wes | CC BY-NC 4.0 |
| fotiecodes/Turaco-E2B-it-mt-en-wes | Apache 2.0 |
| fotiecodes/Turaco-gem-mt-en-wes | Conditions Gemma |
| stfotso/t5_tuned_french_ghomala | Apache 2.0 |
| stfotso/llama-3.2-tuned-french-ghomala-bandjoun-1B | Licence Llama 3.2 |
| stfotso/deepseek-R1-qween-french-ghomala-bandjoun-1.5B | MIT |
| DS4H-ICTU/linguo_mt_en_bbj et linguo_mt_bbj_en | Apache 2.0 |
| DS4H-ICTU/english-ghomala-translation-model-encoderdecoder | Apache 2.0 |
| joseph-scripture/nllb-en-ghomala | Non indiquée |
| jamm55/autotrain-improved-pidgin-model-2837583189 | Non indiquée (comparaison avec le pidgin nigérian) |
