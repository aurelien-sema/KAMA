"""Convertit un modele Marian (dossier Hugging Face) au format CTranslate2 int8 utilise par le serveur.

Usage, depuis la racine du depot, avec transformers, torch et ctranslate2 installes :
    python backend/scripts/convertir_modele.py <dossier_du_modele> <nom_de_sortie>
Exemple pour le modele pidgin ajuste sur Colab :
    python backend/scripts/convertir_modele.py chemin/vers/final pidgin_en_wes
La sortie va dans models/poids/ct2/<nom_de_sortie> ; une version existante est remplacee.
"""
import shutil
import sys
from pathlib import Path

from ctranslate2.converters import TransformersConverter

DEPOT = Path(__file__).resolve().parents[2]
SORTIE = DEPOT / "models" / "poids" / "ct2"
FICHIERS = ("source.spm", "target.spm")


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    source, nom = Path(sys.argv[1]).resolve(), sys.argv[2]
    if not (source / "config.json").exists() or not all((source / f).exists() for f in FICHIERS):
        raise SystemExit(f"{source} doit contenir config.json, source.spm et target.spm")
    if not any((source / f).exists() for f in ("model.safetensors", "pytorch_model.bin")):
        raise SystemExit(f"{source} ne contient pas de poids")
    cible = SORTIE / nom
    temporaire = SORTIE / (nom + ".tmp")
    shutil.rmtree(temporaire, ignore_errors=True)
    SORTIE.mkdir(parents=True, exist_ok=True)
    # Le convertisseur ne charge que des fichiers locaux, sans executer de code du depot du modele.
    TransformersConverter(str(source), copy_files=list(FICHIERS), trust_remote_code=False).convert(str(temporaire), quantization="int8")
    shutil.rmtree(cible, ignore_errors=True)
    temporaire.rename(cible)  # une conversion coupee ne remplace jamais le modele en service
    taille = sum(f.stat().st_size for f in cible.iterdir()) / 1048576
    print(f"Converti : {cible} ({taille:.0f} Mo)")


if __name__ == "__main__":
    main()
