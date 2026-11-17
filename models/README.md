# Modèles retenus

Ce dossier présente les meilleurs modèles de traduction testés. La plupart de leurs poids se trouvent dans le sous-dossier `poids/`, qui n'est pas envoyé sur GitHub : un fichier ne peut pas y dépasser 100 Mo, et certains modèles pèsent jusqu'à 2,3 Go. Les modèles de traduction ajoutés au dépôt (moins de 100 Mo chacun) ont leur fiche `MODELE.md` dans leur dossier.

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

### Modèles ajustés en service sur le serveur (14 novembre 2026)

Poids hors Git (plus de 100 Mo) : ils sont sur le serveur, dans `models/poids/ghomala/`, et sur le Drive de l'équipe.

| Dossier dans `models/poids/` | Rôle | Moteur | Origine |
|---|---|---|---|
| `ghomala/fr-bbj-m2m100-v1-ct2` | français → Ghomala, CTranslate2 int8 (488 Mo) | `m2m100_ct2` | `KAMA_sorties/ghomala/fr-bbj/modele_final` du 13 nov. (chrF++ MAFAND test 25,3 contre 23,9 au départ), converti avec `ctranslate2.converters.TransformersConverter(..., copy_files=["sentencepiece.bpe.model", "kama_config.json"]).convert(..., quantization="int8")` |
| `ghomala/tts-vits-v2-final-20261114` | synthèse Ghomala VITS, 16 kHz | `ghomala_vits` | `KAMA_TTS/ghomala/modele_final` (v2, epoch 55) ; licence CC BY-NC 4.0 héritée de MMS |

Le moteur `m2m100_ct2` applique les substitutions réversibles de `kama_config.json` (ʉ, caron), remet en casse normale une source en majuscules et décode avec une pénalité de répétition (1,2) sans 3-gramme répété. Les textes critiques restent refusés par les garde-fous. Aucun locuteur n'a encore validé ces sorties.

### Candidats locaux reçus le 14 novembre 2026

| Dossier dans `models/poids/` | Rôle | État |
|---|---|---|
| `ghomala/fr-bbj-m2m100-v1` | français → Ghomala, checkpoint M2M100 FP16 | Branché au moteur `m2m100`, route désactivée : smoke test « Bonjour » et « Salut » identique ; aucune route inverse fournie |
| `ghomala/tts-vits-v2-final-20261114` | synthèse Ghomala VITS, 16 kHz, checkpoint final | Branché et activé pour la démonstration non commerciale ; empreinte `model.safetensors` : `50fb9ad152add98a4ed8489e6aa281016cd34132b89c6ee8fee6dcb4009c223d` |

Le checkpoint final vient de `facebook/mms-tts-ybb`, ajuste sur `flagship-ai/ghomala-spoken-bible`, sous licence CC BY-NC 4.0 (attribution requise, usage commercial interdit). Son fichier de configuration rapporte un CER texte de 48,78 % sur le test. Le smoke test local de « Pú cyanyə́ ŋkâp » a produit un WAV mono 16 kHz de 1,17 s en 4,28 s, après 37,44 s de chargement dans le processus. La route TTS Ghomala est active pour la démonstration non commerciale; les routes de traduction et d'ASR Ghomala restent désactivées.

## Pidgin

| Modèle | Sens | Note SOREVA (sur 100) | Licence | À savoir |
|---|---|---|---|---|
| jamm55/autotrain-improved-pidgin-model-2837583189 | anglais → pidgin nigérian | 37,0 | Non indiquée | Vrai pidgin, mais nigérian |
| fotiecodes/Turaco-NLLB-mt-en-wes | anglais → pidgin camerounais | 30,2 | CC BY-NC 4.0 | Recopie souvent l'anglais |
| Helsinki-NLP/opus-mt-fr-en et opus-mt-en-fr | français ↔ anglais | Non testés | Voir leur fiche | Passage par l'anglais pour le pidgin |
| `poids/ct2/pcm_en`, ajusté KAMA depuis NITHUB-AI/marian-mt-bbc-pcm-en | pidgin camerounais → anglais | chrF 34,4 ; BLEU 17,4 | CC BY 4.0 | Dans le dépôt ; voir `models/poids/ct2/pcm_en/MODELE.md` |

Aucun de ces modèles n'est assez fiable pour traduire seul une phrase bancaire. Les notes complètes sont dans `evaluation/results/summary.csv`.

## Modèles de voix (hors dépôt)

| Dossier dans `models/poids/` | Rôle | Source | Licence |
|---|---|---|---|
| `asr/omnilingual-ctc-300m-onnx` | Reconnaissance vocale pidgin et Ghomala | `OpenVoiceOS/omnilingual-asr-ctc-300m-onnx` (Hugging Face) | Apache 2.0 |
| `tts/mms-tts-pcm` | Synthèse vocale (pidgin nigérian, sans ajustement) | `facebook/mms-tts-pcm` | CC-BY-NC 4.0, non commercial |
| `audio/wes/` | Voix pré-générée et validée des textes de la page de test | Générée par `backend/scripts/audio_catalogue.py` | Voix d'une personne : jamais sur GitHub |

**Pour récupérer les modèles de voix** (par exemple pour un collaborateur) : `python models/telecharger_voix.py` télécharge la synthèse (145 Mo) et la reconnaissance depuis Hugging Face. Ils ne sont pas dans Git, car un fichier GitHub ne peut pas dépasser 100 Mo et le dépôt est public. Les extraits pré-générés se recréent ensuite avec `backend/scripts/audio_catalogue.py synthetiser` (même voix, même résultat).

Le téléchargement des jeux d'essai se fait avec `evaluation/download_stt.py`. Les jeux Common Voice se téléchargent sur Mozilla Data Collective : leurs conditions interdisent de les republier, ils restent hors du dépôt.
