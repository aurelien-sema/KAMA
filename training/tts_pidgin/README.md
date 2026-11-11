# Voix pidgin : ajustement sur Common Voice camerounais

**But.** La voix de base (`facebook/mms-tts-pcm`) parle le pidgin **nigérian** (retour d'un locuteur natif : prononciation légèrement différente, compréhensible). On l'ajuste sur des voix camerounaises pour rapprocher la prononciation.

## Données
Common Voice `wes` 27.0 (CC0), 9 018 enregistrements validés, 10,3 h, 16 voix, mais seulement **998 phrases distinctes** et du son de téléphone. `01_preparer_donnees.py` :
- écarte les phrases hors vocabulaire du modèle (35 caractères : a-z sans q, `'`, `-`, espace) et celles qui contiennent des chiffres ;
- garde les voix avec au moins 100 enregistrements, au plus **450 chacune** (aucune voix ne domine) ;
- retire le quart le plus bruité de chaque voix, les enregistrements saturés, coupe les silences, normalise le niveau, passe à 16 kHz ;
- met de côté **40 phrases de test** jamais vues pendant l'entraînement ;
- remplace les identifiants de locuteurs par une empreinte (les conditions de Common Voice interdisent de les identifier).

Sortie : `datasets/tts/wes_cv/` et `KAMA_tts_wes_drive.zip` (racine du projet). **Ce zip contient des données Common Voice : Drive privé seulement, jamais dans Git.**

## Entraînement (Colab, GPU T4)
`entrainement_tts_colab.ipynb` utilise l'outil `ylacombe/finetune-hf-vits` : conversion du discriminateur MMS (`facebook/mms-tts`, `full_models/pcm`), puis ajustement **multi-locuteurs** (`override_speaker_embeddings`).
1. Lancer d'abord avec `SMOKE = True` : un essai de quelques minutes qui vérifie l'installation et mesure la vitesse.
2. Puis `SMOKE = False` (30 passes par défaut).
3. Le notebook ajoute une voix **« mélange »** (moyenne de toutes les voix) : c'est elle que le serveur utilise, pour qu'aucun contributeur ne soit reproduit.
4. Il produit des échantillons `_base` (voix nigériane d'origine) et `_ajuste` pour comparer à l'oreille.

## Brancher le résultat sur le serveur
1. Décompresser `mms-tts-wes-v1.zip` dans `KAMA/models/poids/tts/mms-tts-wes-v1` (hors Git).
2. Dans `backend/config/routes.json`, remplacer le chemin de `tts.wes` et ajouter le numéro de voix affiché par le notebook :
   ```json
   "tts": { "wes": { "enabled": true, "engine": "mms_vits", "path": "poids/tts/mms-tts-wes-v1", "options": { "threads": 2, "speaker_id": 16 } } }
   ```
   Le serveur refuse de démarrer avec un modèle multi-voix sans `speaker_id` (pour ne jamais parler avec une voix au hasard).
3. Régénérer les clips avec `backend/scripts/audio_catalogue.py synthetiser`, puis écouter.

## Limites à garder en tête
- **Aucune garantie d'amélioration.** Common Voice est bruité et ne couvre pas le vocabulaire bancaire. L'écoute avec un locuteur camerounais fait foi.
- Le modèle ajusté reste **CC-BY-NC 4.0** (licence du modèle de base) : non commercial.
- La vraie solution reste des **enregistrements humains** de phrases validées, avec accord écrit : ils passent déjà avant la synthèse dans le serveur.
