# kama_pidgin_v2 — anglais vers pidgin camerounais

Dataset d'entraînement du modèle de traduction de Kama. Il est produit par `training/pidgin/01_nettoyer_donnees.py` : ne pas le modifier à la main, relancer le script.

> `train.jsonl` et `dev.jsonl` ne sont **pas dans Git** : ils contiennent des textes du corpus MT560, dont des textes religieux, et le dépôt est public. Pour les recréer, télécharger MT560 puis lancer `training/pidgin/01_nettoyer_donnees.py`. Seuls `test_soreva.jsonl`, `rapport.json` et ce fichier sont versionnés.

## Fichiers

| Fichier | Lignes | Rôle |
|---|---|---|
| `train.jsonl` | 18 275 | Entraînement |
| `dev.jsonl` | 870 | Contrôle pendant l'entraînement : choix de la meilleure passe et arrêt anticipé |
| `test_soreva.jsonl` | 77 | Test final, jamais vu par le modèle : pidgin camerounais de la vie courante |
| `rapport.json` | — | Chiffres détaillés du nettoyage |

Chaque ligne contient `en`, `wes`, `source`, `domaine` et `licence`.

## Composition de `train.jsonl`

| Source | Lignes | Domaine |
|---|---|---|
| MT560 nettoyé | 16 517 | Général (14 941) et religieux (2 438) |
| MT560 avec balises `ZZ1ZZ` | 862 | Apprendre à recopier noms et nombres |
| Phrases bancaires du catalogue | 896 (112 paires × 8) | Banque |

## Nettoyage appliqué à MT560

Sur 28 159 paires au départ, 17 408 sont gardées. Les autres ont été écartées pour ces raisons :

- **Ponctuation :** remise en forme normale (`Pharaoh 's` → `Pharaoh's`), guillemets retirés.
- **Références :** versets bibliques et numéros de paragraphe retirés.
- **Longueur et alignement :** rejet des paires trop courtes, trop longues ou déséquilibrées.
- **Nombres différents des deux côtés :** rejet. C'est le signe d'une paire mal alignée, et le modèle ne doit jamais apprendre à changer un nombre.
- **Doublons :** rejet, à la ponctuation près.
- **Religion :** 7 281 phrases religieuses retirées, pour qu'il n'en reste qu'un quart.
- **Fuites :** aucune phrase de SOREVA ou des cas inédits ne se retrouve dans `train` ou `dev`.

## Limites connues

- Les 112 phrases bancaires sont des **brouillons non validés**. Leur poids est volontairement réduit (8) tant qu'elles ne sont pas validées. Après validation, relancer avec `--valide_seulement` : le poids passe à 20.
- MT560 mélange plusieurs orthographes du pidgin (`weti`/`wetin`, `ih`/`e`, `dei`/`dey`).
- Dans `test_soreva.jsonl`, le pidgin est authentique, mais l'anglais a été rédigé à partir du pidgin et reste à relire.

## Sources et licences

| Source | Licence |
|---|---|
| MT560 anglais-pidgin camerounais (michsethowusu, Hugging Face) | CC BY 4.0 (indication Hugging Face) |
| SOREVA, Goethe-Institut (OlameMend, Hugging Face) | CC BY 4.0 |
| Phrases bancaires du catalogue | Projet KAMA |

## Écartées, et pourquoi

| Source | Raison |
|---|---|
| Manuel Peace Corps (1983) | Scan en deux colonnes : l'extraction automatique n'apparie correctement qu'environ la moitié des phrases |
| Livrets Rosetta | Grammaire française, presque pas de phrases traduites |
| Corpus oral d'Oxford | Uniquement de l'audio, sans transcription |
| Stop Arnaque 237 | Seulement 2 messages en pidgin |
