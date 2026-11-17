# Ajuster m2m100 pour le pidgin financier

Base : `masakhane/m2m100_418M_en_pcm_rel_news_ft` (licence **AFL-3.0**).
Les paires MT560 utilisées pour l'ajustement sont en **CC BY 4.0**. Les données préparées et les poids ne doivent jamais entrer dans Git.

## Pourquoi m2m100

Le modèle local est déjà un m2m100 ajusté anglais → pidgin. Deux détails vérifiés sur son `config.json` et son tokenizer :

- la source est encodée avec `__en__` (`src_lang="en"`) ;
- la sortie pidgin est forcée avec le jeton `__fr__` (`forced_bos_token_id=128028`).

Ne pas remplacer `__fr__` par un code de langue pidgin : le modèle perdrait la connaissance acquise. La branche CTranslate2 de `training/pidgin/pipeline.py` applique `target_prefix=[["__fr__"]]` pour cette raison.

## Étapes

| Étape | Où | Commande |
|---|---|---|
| 1. Préparer les données | Poste local | `python training/pidgin_m2m/01_preparer_donnees.py` |
| 2. Exporter le zip | Poste local | `python training/pidgin_m2m/exporter_drive.py` |
| 3. Mettre `export_drive/KAMA_pidgin_m2m_drive.zip` **tel quel** dans Mon Drive | Google Drive | À la main, sans décompresser |
| 4. Entraîner puis convertir | Colab, GPU T4, Python 3.12 | Importer `entrainement_m2m_colab.ipynb` et suivre les cellules |
| 5. Comparer à la v2 | Poste local | Commandes ci-dessous |

Le zip contient `data/{train,dev,test_soreva}.jsonl`, `data/rapport.json`, le carnet et ce README. Le dossier `data/` et `export_drive/` sont ignorés par Git.

## Préparation

`01_preparer_donnees.py` lit `data_propre/train.jsonl` du zip `KAMA_pidgin_finance_drive.zip` (sources `mt560`, `banque`, `balises`, `mt560-financier-propre`) et applique :

- normalisation Unicode/espaces, sans toucher aux balises `ZZ1ZZ` ;
- `--part_religieux 0.15` : 15 % des phrases religieuses sont gardées, les autres sont retirées ;
- `--normaliser table.json` : remplacement mot à mot côté `wes`, table vide par défaut ;
- `--ajouts ajouts.jsonl` : ajout ultérieur de post-édition ou de rétro-traduction ;
- dédoublonnage des paires ;
- exclusion de toute phrase de `cas_inedits.json`, `data/test_soreva.jsonl`, `datasets/soreva` et `evaluation/soreva_refs.tsv` ;
- `dev` = 600 paires, avec une partie des paires `banque` uniques et le reste en `mt560` non religieux ;
- sur-pondération `banque` et `balises` ×3 après dédoublonnage.

Remarque : `data_propre` contient déjà les répétitions de la v2. Après dédoublonnage il ne reste que 112 paires `banque` uniques ; le dev en réserve la moitié et le train reçoit les 56 restantes ×3. Le rapport `data/rapport.json` donne les comptes exacts.

## Entraînement Colab

Le carnet utilise `Seq2SeqTrainer` avec les réglages demandés : lr `5e-5`, 3 passes, lot 16, max 128 jetons, `warmup_steps=300`, `weight_decay=0.01`, `predict_with_generate`, chrF sur `dev` à chaque passe, `load_best_model_at_end`, `fp16=False` (m2m100 produit des `nan` en fp16).

Le mode `SMOKE = True` utilise 300 paires et 30 pas, puis affiche le temps par pas et 5 traductions de contrôle dont `ZZ1ZZ`. Le vrai entraînement affiche aussi 10 phrases bancaires de contrôle, puis convertit le modèle en CTranslate2 int8 et produit deux zips : `KAMA_m2m100_hf.zip` et `KAMA_m2m100_ct2.zip`.

Sur le poste, mettre le dossier CT2 dans `KAMA/models/poids/ct2/` sous un **nouveau nom**. Ne pas remplacer la v2 avant les comparaisons.

## Comparer à la v2

Depuis `KAMA/training/pidgin` :

```bash
# v2 locale : ../../models/poids/ct2/pidgin_en_wes_ajuste_v2
python 08_comparer_soreva.py v2=<dossier_ct2_v2> m2m=<dossier_ct2_m2m>
python 03_tester_inedit.py --modele <dossier_ct2_m2m> --sortie data/rapport_inedit_m2m.csv
python 10_termes_critiques.py data/rapport_inedit_v2_ct2.csv data/rapport_inedit_m2m.csv
```

La référence v2 déjà mesurée est `data/rapport_inedit_v2_ct2.csv` et son résumé `data/rapport_inedit_v2_ct2.json`. Noter le temps par phrase pour le CT2 m2m100.

## Accepter un modèle

Seulement si :

- 100 % des valeurs (montants, noms, numéros, balises `ZZ...ZZ`) sont conservées ;
- le modèle dépasse la v2 au test inédit et sur les termes critiques ;
- un locuteur ne trouve aucun contresens sur **envoyer**, **confirmer**, **annuler** ou une **alerte**.

## Ce qui reste à faire côté serveur

Le câblage n'est pas inclus : après validation, copier le dossier CT2 dans `KAMA/models/poids/ct2/`, puis déclarer la route dans `config/routes*.json`. Ne pas modifier `KAMA/backend` ni les routes avant d'avoir les résultats de comparaison.
