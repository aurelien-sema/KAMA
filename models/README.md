# Modèles retenus

Ce dossier présente les meilleurs modèles de traduction testés. Leurs poids se trouvent dans le sous-dossier `poids/`, qui n'est pas envoyé sur GitHub : un fichier ne peut pas y dépasser 100 Mo, et ces modèles pèsent jusqu'à 2,3 Go.

Pour les récupérer depuis la racine du dépôt :

```bash
pip install -U huggingface_hub
python models/fetch_models.py ghomala   # pour travailler sur le Ghomala
python models/fetch_models.py pidgin    # pour travailler sur le pidgin
```

## Ghomala

| Modèle | Sens | Note SOREVA (sur 100) | Licence |
|---|---|---|---|
| masakhane/m2m100_418M_fr_bbj_rel_news_ft | français → Ghomala | 18,4 | AFL-3.0 |
| masakhane/m2m100_418M_bbj_fr_rel_news_ft | Ghomala → français | Test en cours | AFL-3.0 |

## Pidgin

| Modèle | Sens | Note SOREVA (sur 100) | Licence | À savoir |
|---|---|---|---|---|
| jamm55/autotrain-improved-pidgin-model-2837583189 | anglais → pidgin nigérian | 37,0 | Non indiquée | Vrai pidgin, mais nigérian |
| fotiecodes/Turaco-NLLB-mt-en-wes | anglais → pidgin camerounais | 30,2 | CC BY-NC 4.0 | Recopie souvent l'anglais |
| Helsinki-NLP/opus-mt-fr-en et opus-mt-en-fr | français ↔ anglais | Non testés | Voir leur fiche | Passage par l'anglais pour le pidgin |

Aucun de ces modèles n'est assez fiable pour traduire seul une phrase bancaire. Les notes complètes sont dans `evaluation/results/summary.csv`.

## Modèles de voix (hors dépôt)

| Dossier dans `models/poids/` | Rôle | Source | Licence |
|---|---|---|---|
| `asr/omnilingual-ctc-300m-onnx` | Reconnaissance vocale pidgin et Ghomala | `OpenVoiceOS/omnilingual-asr-ctc-300m-onnx` (Hugging Face) | Apache 2.0 |
| `tts/mms-tts-pcm` | Synthèse vocale (pidgin nigérian, sans ajustement) | `facebook/mms-tts-pcm` | CC-BY-NC 4.0, non commercial |
| `audio/wes/` | Voix pré-générée et validée des textes de la page de test | Générée par `backend/scripts/audio_catalogue.py` | Voix d'une personne : jamais sur GitHub |

**Pour récupérer les modèles de voix** (par exemple pour un collaborateur) : `python models/telecharger_voix.py` télécharge la synthèse (145 Mo) et la reconnaissance depuis Hugging Face. Ils ne sont pas dans Git, car un fichier GitHub ne peut pas dépasser 100 Mo et le dépôt est public. Les extraits pré-générés se recréent ensuite avec `backend/scripts/audio_catalogue.py synthetiser` (même voix, même résultat).

Le téléchargement des jeux d'essai se fait avec `evaluation/download_stt.py`. Les jeux Common Voice se téléchargent sur Mozilla Data Collective : leurs conditions interdisent de les republier, ils restent hors du dépôt.

## d1-3B : modèle de décision testé (pas génératif)

- **Modèle :** `LiquidAI/d1-3B-GGUF`, quantification `Q4_K_M`, révision `bb1e436ea78eb96a3f1acb6da865f70c2fbeb563`.
- **Poids précédemment testés :** `models/poids/liquidai_d1_3B_GGUF/d1-3B-Q4_K_M.gguf` (1 674 456 672 octets), supprimés à la demande de Dimitri le 13 novembre 2026 pour libérer de l'espace. SHA-256 vérifié avant suppression : `16aff27ea2eefdc32b9897f43854a5d3170c1dc8dccb9c756905af30a4e22402`. Le petit fichier `LICENSE` et le `README.md` restent présents.
- Le modèle renvoie des décisions typées sans générer de tokens de réponse. Il peut aider au classement d'intentions, mais ne peut pas formuler la réponse de Kama. Il ne convient donc pas comme modèle génératif principal. Sa fiche indique l'anglais et le français, pas le pidgin camerounais ni le Ghomálá'.
- **Licence :** LFM Open License v1.0 ; le texte exact est conservé à côté des poids. Vérifier ses conditions d'usage et d'attribution avant tout usage commercial, déploiement ou redistribution.
- **Runtime local :** `llama.cpp` natif, version `b12359`, dans `models/tools/llama-b12359/`. L'archive Windows x64 est conservée à côté ; son SHA-256 publié a été vérifié. Le runtime est sous licence MIT et l'OpenMP fourni sous Apache 2.0 avec exceptions LLVM.
- Le serveur doit rester lié à `127.0.0.1`, protégé par une clé API et une origine CORS explicitement limitée. Vérifier l'antivirus si `llama-server.exe` disparaît ; ne pas contourner sa quarantaine. Ne pas lui envoyer de données bancaires ou personnelles avant d'avoir mis en place et validé le masquage prévu au contrat.
- Trois tests synthétiques anglais/français/hors sujet ont donné respectivement `ask_fees`, `ask_fees` et `unknown`. Ce smoke test ne suffit pas à valider le modèle : créer un jeu Kama représentatif et calibrer les probabilités avant toute intégration. Le modèle et le serveur ne sont pas intégrés au backend.

## Modèles génératifs Liquid AI à comparer (aucun choix final)

Les trois fiches annoncent l'anglais et le français, mais pas le pidgin camerounais ni le Ghomálá'. Ils ne pourront pas remplacer l'étape de traduction de Kama.

| Modèle | GGUF Q4_K_M publié | Atouts pour Kama | Points de vigilance |
|---|---:|---|---|
| [LFM3-1.7B](https://huggingface.co/LiquidAI/LFM3-1.7B) | 1 099 627 808 octets | Modèle génératif récent, format GGUF CPU, sorties structurées annoncées ; le runtime actuel `llama.cpp` b12359 dépasse le minimum b11960 indiqué dans sa fiche GGUF. | Le raisonnement est activé par défaut dans la fiche ; vérifier qu'il peut être désactivé et qu'aucune chaîne de raisonnement n'est exposée. |
| [LFM2.5-1.2B-Instruct](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct) | 730 895 168 octets | Baseline plus petite, instruction-tunée, GGUF CPU ; adaptée à une comparaison sur la machine locale. | La fiche la marque comme remplacée par LFM3-1.7B ; qualité de réponse Kama à mesurer. |
| [LFM2.5-8B-A1B](https://huggingface.co/LiquidAI/LFM2.5-8B-A1B) | 5 155 564 768 octets | Modèle reasoning-tuné ; option de comparaison plus lourde si les deux petits modèles ne répondent pas assez bien. | 8,3B paramètres au total (1,5B actifs) : la taille des poids reste importante ; le fichier ne tient pas dans l'espace disque actuellement libre sur le PC. Latence CPU et marge mémoire VPS à mesurer. |

Les modèles ci-dessus relèvent de la **LFM Open License v1.0** ; ses conditions d'usage commercial et d'attribution doivent être vérifiées avant déploiement. Aucun modèle n'est sélectionné pour l'intégration. LFM3-1.7B a été téléchargé uniquement pour un essai local, décrit ci-dessous.

**Première comparaison proposée :** LFM3-1.7B contre LFM2.5-1.2B-Instruct, en génération anglaise puis traduction pidgin avec le badge « Traduction automatique ». Évaluer la justesse, les omissions et ajouts dangereux, la brièveté, la latence et la qualité du pidgin avec un locuteur natif. Les montants, noms et identifiants bancaires restent hors des modèles et sont insérés localement par Kama.

### Essai local préliminaire de LFM3-1.7B — 13 novembre 2026

- Poids `poids/lfm3_1_7B/LFM3-1.7B-Q4_K_M.gguf` : 1 099 627 808 octets ; SHA-256 vérifié : `3793e1e6e2266919d6e015287221b41100175a98eddaba92e111aed3b05c93c4`. `LICENSE` et `README.md` sont présents.
- Le runtime local `llama.cpp` b12359 charge le modèle. Le serveur a été lié à `127.0.0.1`, protégé par une clé temporaire, limité à CORS `localhost`, puis arrêté après l'essai. Seules des requêtes synthétiques ont été envoyées.
- Une explication simple des frais a produit un JSON valide avec `response_format` JSON Schema en 6,57 s (49 tokens, environ 10 tokens/s), sans chiffre ni montant calculé.
- Deux pièges ont échoué malgré le schéma JSON : à la demande de calcul, le texte a proposé une formule avec les balises de montant ; à la demande de confirmer, il a affirmé à tort que le bouton n'était pas visible. Le JSON contraint ne garantit donc pas un contenu sûr ou fidèle.
- Avec `llama-cli`, la sortie libre initiale n'était pas un JSON valide et exposait un marqueur `<think>` vide. La contrainte `--json-schema-file` échouait dans ce mode à cause du préfixe de chat LFM3 ; le point d'accès serveur avec JSON Schema strict a, lui, fonctionné.
- Résultat préliminaire uniquement : ne pas intégrer ni considérer le modèle validé. Le jeu actuel (`evaluation/llm/jeu_kama_llm.json`) contient 48 cas au total (19 fr, 15 en, 14 wes) et signale que les phrases pidgin restent à relire ; une mesure complète reste nécessaire.
