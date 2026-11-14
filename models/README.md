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
