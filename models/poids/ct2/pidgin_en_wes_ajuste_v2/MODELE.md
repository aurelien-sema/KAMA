# Modèle de traduction anglais → pidgin camerounais (v2)

Modèle utilisé par le serveur de KAMA pour traduire en pidgin camerounais (`wes`) un texte que le glossaire validé et la
mémoire de traduction ne connaissent pas (route `en>wes_modele` de `backend/config/routes.json`). Un texte français passe
d'abord par `opus-mt-fr-en`. Un message critique (montant, alerte, confirmation) ne passe jamais par ce modèle sans les
contrôles du serveur, et ce qu'il produit est toujours affiché avec le badge « Traduction automatique ».

## Provenance

| Élément | Détail |
|---|---|
| Architecture | Marian (encodeur-décodeur), converti au format CTranslate2 (`backend/scripts/convertir_modele.py`) |
| Modèle de départ | [`jamm55/autotrain-improved-pidgin-model-2837583189`](https://huggingface.co/jamm55/autotrain-improved-pidgin-model-2837583189) (anglais → pidgin) |
| Ajustement | Par l'équipe KAMA (novembre 2026), carnet `training/pidgin/entrainement_colab.ipynb` |
| Données d'ajustement | MT560 anglais–pidgin camerounais (OPUS, via `michsethowusu/english-cameroon-pidgin_sentence-pairs_mt560`, CC BY 4.0), filtré pour réduire les textes religieux ; phrases bancaires de la page de test et exemples à balises écrits par l'équipe |
| Mesures | SOREVA (77 phrases) : chrF 33,8, BLEU 10,6 ; messages bancaires inédits : 38/60 sans problème détecté ; termes critiques : 60/70 (`evaluation/logs/`) |

## Licences

- **Données** : MT560 sous CC BY 4.0 (attribution : OPUS / MT560, Gowda et al. 2021 ; jeu de paires par michsethowusu).
- **Modèle de départ** : la fiche Hugging Face de jamm55 **ne déclare aucune licence**. Tant que son auteur n'a pas précisé
  les conditions, ce modèle dérivé est fourni pour la démonstration du SAFINUM Innovate Challenge uniquement, sans usage
  commercial ni redistribution séparée.
- **Ajustement et conversion** : équipe KAMA.

## Fichiers et empreintes SHA-256

| Fichier | Taille (octets) | SHA-256 |
|---|---:|---|
| config.json | 233 | `72901fbd8abd89fb5cf4a388f26fc681f5c4c58a1e1a88b30b879f107270e7ee` |
| model.bin | 75 979 635 | `07cacb5c75626ec925f3b15e1ea011a5a6574d2828585967628ce2796e23c54d` |
| shared_vocabulary.json | 1 051 929 | `c32eadf3db9b4884a959858d7294f7c61e20067fc47564ae3c56d180c1ee6178` |
| source.spm | 768 489 | `678f2a1177d8389f67b66299762dcc4fc567e89b07e212ba91b0c56daecf47ce` |
| target.spm | 796 845 | `bbd1f495eea99c8e21ae086d9146e0fa7b096c3dfdd9ba07ab8b631889df5c9b` |

## Limites connues

- Pidgin appris surtout sur des textes religieux : risque de vocabulaire religieux, filtré par le serveur (`religious_drift`).
- Contresens possibles sur des messages critiques (ex. « annuler » rendu par « close ») : c'est pourquoi le serveur ne lui
  confie pas les messages critiques sans contrôle des termes et des négations.
- Orthographe du pidgin variable ; les textes affichés comme « Vérifié » viennent du glossaire validé par un locuteur, jamais
  de ce modèle.
