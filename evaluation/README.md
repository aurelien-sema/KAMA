# Évaluation des modèles de traduction

Ce dossier compare des modèles de traduction Ghomala et pidgin sur des phrases de la vie courante et sur des phrases bancaires.

## Ce qui n'est pas dans le dépôt

- Les poids des modèles, dans `models/` à côté du dépôt.
- Les corpus, dans `datasets/` à côté du dépôt.
- Les extraits de MAFAND et de la Bible, ainsi que les sorties qui les citent, à cause de leurs droits. `build_testset.py` les recrée depuis `datasets/`.
- llama.cpp, à installer dans `evaluation/tools/llamacpp_bin` (binaires) et `evaluation/tools/llamacpp_src` (scripts de conversion) pour les modèles GGUF.

## Lancer les tests

Créer un environnement Python avec `torch`, `transformers==4.57.6`, `regex`, `sentencepiece`, `sacremoses`, `sacrebleu`, `huggingface_hub`, `ctranslate2`, `gguf` et `protobuf`, puis :

```bash
python -I build_testset.py      # crée testsets/
python -I supervise.py          # télécharge et teste, avec reprise automatique
python -I score.py              # écrit results/summary.csv
```

`supervise.py` relance tout processus arrêté avant sa fin. Un seul gros modèle tourne à la fois, grâce à `cpulock.py`.

## Lire les résultats

| Colonne de `results/summary.csv` | Sens |
|---|---|
| `chrF` | Ressemblance avec la bonne réponse, sur 100 |
| `exact_%` | Réponses identiques à la référence |
| `nombres_conserves_%`, `noms_conserves_%` | Montants et noms retrouvés dans la traduction |
| `balises_intactes_%` | Balises `ZZ1ZZ` conservées par le modèle |
| `copie_source_%` | Phrases simplement recopiées au lieu d'être traduites |
| `degenere_%` | Sorties vides ou qui tournent en boucle |

Un montant conservé à 100 % ne veut rien dire si `copie_source_%` est élevé. Les références française et anglaise de SOREVA ont été rédigées à partir du pidgin et restent à relire. Seul un locuteur peut juger la qualité réelle du Ghomala.
