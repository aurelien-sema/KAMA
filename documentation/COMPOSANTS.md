# Déclaration des composants et services tiers

Le règlement (article 9) demande de déclarer les outils, services externes et composants tiers utilisés.
Cette page les recense et renvoie au fichier du dépôt qui donne le détail et la licence.

**À l'exécution, Kama n'appelle aucun service d'IA externe.** L'extension ne parle qu'au serveur de
l'équipe (`https://kama-project.duckdns.org`), qui fait tourner des modèles installés sur la machine.
Aucune clé d'API tierce n'est utilisée ni stockée dans l'extension.

## Modèles

| Composant | Rôle | Licence / source | Déclaration détaillée |
|---|---|---|---|
| `pidgin_en_wes_ajuste_v2` (Marian, CTranslate2) | anglais → pidgin camerounais | modèle de départ `jamm55/autotrain-improved-pidgin-model-2837583189` (licence non déclarée par son auteur) ; ajusté par l'équipe sur MT560 (CC BY 4.0) | `models/poids/ct2/pidgin_en_wes_ajuste_v2/MODELE.md` |
| `Helsinki-NLP/opus-mt-fr-en`, `opus-mt-en-fr` | français ↔ anglais (passage par l'anglais) | voir la fiche Hugging Face de chaque modèle | `models/README.md` |
| `masakhane/m2m100_418M_fr_bbj_rel_news_ft`, `..._bbj_fr_...` | français ↔ Ghomala (routes désactivées) | AFL-3.0 | `models/README.md` |
| `ghomala/tts-vits-v2-final-20261114` (VITS) | synthèse vocale Ghomala, démonstration non commerciale | `facebook/mms-tts-ybb` ajusté sur `flagship-ai/ghomala-spoken-bible` (CC BY-NC 4.0) | `models/README.md` |
| `mms-tts-wes-v1`, `mms-tts-pcm` | synthèse vocale pidgin | `facebook/mms-tts-pcm` (CC BY-NC 4.0) | `models/README.md` |
| `wbert-wes-v1`, `omnilingual-ctc-300m-onnx` | reconnaissance vocale pidgin / Ghomala | `OpenVoiceOS/omnilingual-asr-ctc-300m-onnx` (Apache 2.0) | `models/README.md`, `backend/ARCHITECTURE.md` |
| `LiquidAI/LFM3-1.7B-GGUF` | assistant local (profil de démonstration uniquement) | LFM Open License, empreinte SHA-256 vérifiée au chargement | `models/poids/llm/PROVENANCE.txt` |

## Jeux de données

| Jeu | Usage | Licence | Détail |
|---|---|---|---|
| MAFAND français–Ghomala | évaluation | CC BY-NC 4.0 | `datasets/README.md` |
| `stfotso/french-ghomala-bandjoun` | évaluation | Apache 2.0 | `datasets/README.md` |
| MT560 anglais–pidgin | ajustement du modèle pidgin | CC BY 4.0 | `datasets/README.md` |
| SOREVA | évaluation (150 transcriptions) | CC BY 4.0 | `datasets/README.md` |
| Common Voice, corpus Oxford, Bible parlée | non publiés dans le dépôt (droits) | voir `datasets/README.md` et `.gitignore` | hors dépôt |

## Bibliothèques et outils

| Côté | Composants | Versions |
|---|---|---|
| Serveur | FastAPI, Starlette, Uvicorn, Pydantic, CTranslate2, SentencePiece, NumPy ; en option PyTorch, Transformers, ONNX Runtime, `llama-cpp-python` | épinglées dans `backend/requirements*.txt` |
| Extension | React, WXT, Tailwind CSS, Lucide (icônes), polices DM Sans et Krona One (`@fontsource`, SIL OFL) | épinglées dans `kama_frontend/package-lock.json` |
| Développement | GitHub Actions (CI et déploiement), Hugging Face (téléchargement des poids), Google Colab et Kaggle (entraînement) | `.github/workflows/ci.yml`, `models/README.md` |

## Contributions propres à l'équipe

Le code de l'extension, le serveur, le masquage, les gardes de sortie, la mémoire de traduction, le
catalogue de phrases, les ajustements de modèles et les textes pidgin brouillons sont écrits par
l'équipe. Les textes affichés comme « Vérifié » proviennent d'un locuteur identifié (`validated_by`),
jamais d'un modèle.
