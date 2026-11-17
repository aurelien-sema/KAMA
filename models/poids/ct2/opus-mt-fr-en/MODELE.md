# Modèle de traduction français → anglais (opus-mt, CTranslate2)

Utilisé par le serveur de KAMA, route `fr>en (1re étape pour traduire en pidgin un texte français)` (`backend/config/routes.json`).

| Élément | Détail |
|---|---|
| Modèle d'origine | [`Helsinki-NLP/opus-mt-fr-en`](https://huggingface.co/Helsinki-NLP/opus-mt-fr-en) (Helsinki-NLP, projet OPUS-MT, Université d'Helsinki) |
| Licence | Apache 2.0 (déclarée sur la fiche du modèle) |
| Modification | Conversion au format CTranslate2 par l'équipe KAMA (`backend/scripts/convertir_modele.py`), poids inchangés |
| Attribution | Tiedemann, J. & Thottingal, S. (2020). OPUS-MT — Building open translation services for the World. EAMT. |

## Fichiers et empreintes SHA-256

| Fichier | Taille (octets) | SHA-256 |
|---|---:|---|
| config.json | 233 | `72901fbd8abd89fb5cf4a388f26fc681f5c4c58a1e1a88b30b879f107270e7ee` |
| model.bin | 76 714 395 | `8c070c110a94dca4693be7c93ecbfdd09bce99eefbf902b1e7b45cbea2a10fd4` |
| shared_vocabulary.json | 1 112 211 | `528a527b3504bda364600f8bd7a2db1b0d7f82ef97a33ba0e80c289c4ae63c24` |
| source.spm | 802 397 | `78d0e717c77053f1c4b856d8661d9cb87c64f083a35418c087b9146300e4f585` |
| target.spm | 778 395 | `173e9f493a668fe396d599e28d414a201193094e6ffd7a4678e5aab0f6d3d838` |
