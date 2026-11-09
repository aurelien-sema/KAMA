# Modèles retenus

Ce dossier contient les meilleurs modèles de traduction testés. Les poids ne sont pas envoyés sur GitHub : un fichier ne peut pas y dépasser 100 Mo, et ces modèles pèsent jusqu'à 2,3 Go.

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
