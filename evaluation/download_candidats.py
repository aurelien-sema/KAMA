"""Telecharge les modeles et jeux candidats pidgin (hors depot) : python download_candidats.py [traduction|retour|stt|donnees]
Poids dans models/poids/candidats/, jeux dans ../datasets/pidgin/web/ (a cote du depot, jamais dedans). Saute ce qui est deja la.
Licences : verifier la fiche de chaque modele avant tout usage hors essai ; rien de ceci n'est envoye sur GitHub."""
import sys
from pathlib import Path

from huggingface_hub import snapshot_download

DEPOT = Path(__file__).resolve().parent.parent
POIDS = DEPOT / "models" / "poids" / "candidats"
DONNEES = DEPOT.parent / "datasets" / "pidgin" / "web"
sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

GROUPES = {
    # sens aller (anglais -> pidgin) : concurrents du modele actuel
    "traduction": ["NITHUB-AI/marian-mt-bbc-en-pcm", "Enutrof/marian-mt-en-pcm", "masakhane/m2m100_418M_en_pcm_rel_news_ft",
                   "Davlan/mt5-small-en-pcm", "jamm55/autotrain-pidgintranslationmix-2798982563"],
    # sens retour (pidgin -> anglais) : garde par retraduction
    "retour": ["NITHUB-AI/marian-mt-bbc-pcm-en", "Enutrof/marian-mt-pcm-en", "masakhane/m2m100_418M_pcm_en_rel_news_ft",
               "Davlan/mt5-small-pcm-en"],
    "stt": ["KhayaAI/w2v-bert-pcm", "ocansey/whisper-small-nigerian-pidgin", "michaelodafe/whisper-pidgin-v1",
            "Mansa-Labs/obum-whisper-medium-nigerian-pidgin"],
}
JEUX = ["Ephraimmm/pidgin_bank_dataset", "Bytte-AI/Pidgin-to-English-conversational-translations", "prince4332/unfiltered-pidgin-english-lexicon",
        "ananselabs/unfiltered-pidgin-english-lexicon", "michsethowusu/english-nigerian-pidgin_sentence-pairs_mt560",
        "ffatty/plaintext-wikipedia-full-nigerian-pidgin", "Bytte-AI/BBC_Igbo-Pidgin_Gold-Standard_NLP_Corpus",
        "Guavacoderepo/gclm-pidgin-text-corpus", "WAZOBIALABS/nigerian-pidgin-eval", "Britzzy/nigerian-pidgin-evaluation"]


def prendre(repo, dest_dir, kind):
    dest = dest_dir / repo.replace("/", "__")
    try:
        snapshot_download(repo, repo_type=kind, local_dir=str(dest), ignore_patterns=["*.msgpack", "*.h5", "*.ot", "optimizer.pt", "*.onnx_data"])
        print("OK ", repo)
    except Exception as e:
        print("ECHEC", repo, type(e).__name__, str(e)[:120])


if __name__ == "__main__":
    for g in sys.argv[1:] or ["traduction", "retour", "stt", "donnees"]:
        if g == "donnees":
            DONNEES.mkdir(parents=True, exist_ok=True)
            for r in JEUX:
                prendre(r, DONNEES, "dataset")
        else:
            POIDS.mkdir(parents=True, exist_ok=True)
            for r in GROUPES[g]:
                prendre(r, POIDS, "model")
