# Modèle de traduction pidgin camerounais → anglais

Modèle utilisé par le serveur pour relire en anglais un texte pidgin (route `wes>en` de
`backend/config/routes.json`). Il sert à l'assistant vocal : la question reconnue en pidgin est
d'abord traduite en anglais avant d'être confiée au LLM local, puis la réponse repart en pidgin
par la route `en>wes`. Il ne sert jamais à afficher une traduction « Vérifié » : une sortie de
modèle reste une traduction automatique.

## Provenance

| Élément | Détail |
|---|---|
| Architecture | Marian (encodeur-décodeur), converti au format CTranslate2 (`backend/scripts/convertir_modele.py`) |
| Modèle de départ | [`NITHUB-AI/marian-mt-bbc-pcm-en`](https://huggingface.co/NITHUB-AI/marian-mt-bbc-pcm-en) (pidgin → anglais, licence CC BY 4.0) |
| Ajustement | Équipe KAMA (novembre 2026), carnet `training/pidgin_pcm_en/entrainement_pcm_en_kaggle.ipynb` |
| Données d'ajustement | Paires pidgin → anglais inversées depuis `training/pidgin_m2m/data` : 12 242 entraînement, 600 développement, 77 test SOREVA, sans fuite ; textes religieux réduits, balises `ZZnZZ` vérifiées |
| Conversion | `backend/scripts/convertir_modele.py`, CTranslate2 int8, CPU |

## Mesures

Sur les 77 phrases SOREVA (pidgin camerounais jamais vues à l'entraînement) :

| Modèle | chrF (word_order=2) | BLEU | Phrases identiques |
|---|---:|---:|---:|
| Ajusté (ce dossier) | 34,4 | 17,4 | 6/77 |
| `pcm_en` précédent (BBC Pidgin, nigérian) | 37,6 | 10,7 | 1/77 |

Le BLEU et le nombre de phrases exactes progressent ; le chrF baisse légèrement. Sur des phrases
bancaires complexes, le modèle peut encore produire un contresens (par exemple « Di transfer don
fail » → « The translation has been vain »). C'est pourquoi il est réservé à l'entrée de
l'assistant et ne remplace jamais le glossaire validé.

## Fichiers et empreintes SHA-256

| Fichier | Taille (octets) | SHA-256 |
|---|---:|---|
| config.json | 223 | `8f6496adfc930cbfecbe8281112197705c488fab47d34b4829b06d7f478909af` |
| model.bin | 57 375 075 | `b65581c102e39ce383c0634bd9cc48ecb5b70ff45e8363fcec3310e32af4dfc3` |
| shared_vocabulary.json | 701 409 | `6bbd8bac9443fe2d5b6f771256d8a72de585bbc823b3ea45a0dbe6fa5431843e` |
| source.spm | 507 029 | `534be973a18f057dd851e5d848b5e83467a5018f2c77f55beef714c2cc7b933f` |
| target.spm | 441 186 | `9ecd6e611aed515dd99ba012c445b5462fff7418709fb8903cd56915f41f1f03` |

## Licences

- **Modèle de départ** : `NITHUB-AI/marian-mt-bbc-pcm-en`, CC BY 4.0 (attribution : NITHUB-AI).
- **Ajustement et conversion** : équipe KAMA. Le modèle ajusté est distribué sous la même
  licence CC BY 4.0, avec attribution du modèle de départ.

## Limites connues

- Qualité inégale sur le pidgin camerounais bancaire : les phrases courtes et courantes passent,
  les phrases longues ou critiques peuvent être mal comprises.
- Ne doit pas être utilisé pour décider d'un montant, d'une alerte ou d'une confirmation.
- Les balises `{xN}` sont conservées dans les cas mesurés, mais le serveur vérifie quand même
  chaque sortie (`output_problem`) avant de l'utiliser.
