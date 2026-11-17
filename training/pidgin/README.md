# Ajuster le modèle pidgin

Base de départ : `jamm55/autotrain-improved-pidgin-model-2837583189` (anglais vers pidgin).

## Étapes

| Étape | Où | Commande |
|---|---|---|
| 1. Nettoyer les données | Poste local | `python 01_nettoyer_donnees.py`, puis `python exporter_drive.py` |
| 2. Mettre `export_drive/KAMA_pidgin_drive.zip` **tel quel** dans Mon Drive | Google Drive | À la main, sans décompresser |
| 3. Entraîner, puis convertir pour le serveur | Colab, avec GPU | Importer `entrainement_colab.ipynb` dans Colab et tout exécuter |
| 4. Vérifier sur du contenu inédit | Poste local | `python 03_tester_inedit.py --modele <dossier>` |
| 5. Comparer aux documents | Poste local | `python 04_verifier_documents.py traductions.json` |

## Comment une phrase est traduite

1. Les montants, noms et numéros sont cachés derrière des balises.
2. Le jargon bancaire est remplacé par une explication simple (`content-data/jargon_simplification.json`), sauf si un locuteur a validé un équivalent.
3. Si la phrase est en français, elle passe en anglais (`opus-mt-fr-en`).
4. Le modèle la traduit en pidgin.
5. La traduction est contrôlée, puis les valeurs d'origine sont remises.

## Ce qui entre dans l'entraînement

MT560 nettoyé, avec un quart seulement des phrases religieuses, des exemples à balises, et les phrases bancaires du catalogue, répétées pour peser davantage.

Ces phrases bancaires sont encore des brouillons. Une fois le fichier Word validé, reporter les corrections dans `content-data/safinum_test_page.json`, puis relancer avec `--valide_seulement`.

## Accepter un modèle ajusté

Seulement s'il garde 100 % des valeurs, s'il dépasse jamm55 au test inédit, et si un locuteur ne trouve aucun contresens sur envoyer, confirmer, annuler ou une alerte.
