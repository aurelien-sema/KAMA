"""Telecharge les modeles de voix dans models/poids/ (ils ne sont pas dans Git : un fichier GitHub ne peut pas depasser 100 Mo).

Usage : python models/telecharger_voix.py [tts] [asr]       (sans argument : les deux)
Necessite : pip install huggingface_hub
  tts : facebook/mms-tts-pcm (synthese pidgin, 145 Mo, CC-BY-NC 4.0 : usage non commercial, a citer)
  asr : OpenVoiceOS/omnilingual-asr-ctc-300m-onnx (reconnaissance pidgin et Ghomala, Apache 2.0)
Ensuite, pour retrouver la voix pre-generee de la page de test (73 extraits, memes textes, meme voix) :
  cd backend && python scripts/audio_catalogue.py synthetiser --valide-par "<nom du locuteur>" --modele ../models/poids/tts/mms-tts-pcm
"""
import sys
from pathlib import Path

from huggingface_hub import snapshot_download

POIDS = Path(__file__).resolve().parent / "poids"
MODELES = {
    "tts": ("facebook/mms-tts-pcm", POIDS / "tts" / "mms-tts-pcm", ["*.safetensors", "*.json", "*.txt"]),
    "asr": ("OpenVoiceOS/omnilingual-asr-ctc-300m-onnx", POIDS / "asr" / "omnilingual-ctc-300m-onnx", None),
}

if __name__ == "__main__":
    for nom in sys.argv[1:] or MODELES:
        repo, dest, motifs = MODELES[nom]
        print(f"{nom}: {repo} -> {dest}")
        snapshot_download(repo, local_dir=str(dest), allow_patterns=motifs)
    print("termine")
