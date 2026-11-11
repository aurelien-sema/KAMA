"""Chaine complete de traduction : masquage, simplification, passage par l'anglais, pidgin, controles."""
import os
import re
import sys
from pathlib import Path

os.environ.update(USE_TF="0", USE_FLAX="0", TRANSFORMERS_NO_TF="1", TOKENIZERS_PARALLELISM="false")

import torch  # noqa: E402
from transformers import AutoModelForSeq2SeqLM, MarianTokenizer  # noqa: E402

ICI = Path(__file__).resolve().parent
DEPOT = ICI.parents[1]
sys.path.insert(0, str(DEPOT / "backend"))
sys.path.insert(0, str(ICI))
from app.engines import split_sentences as decouper_phrases  # noqa: E402
from app.security.masking import mask  # noqa: E402
from simplifier import simplifier  # noqa: E402

POIDS = DEPOT / "models" / "poids"
JAMM55 = POIDS / "jamm55__autotrain-improved-pidgin-model-2837583189"
OPUS_FR_EN = POIDS / "Helsinki-NLP__opus-mt-fr-en"
OPUS_EN_FR = POIDS / "Helsinki-NLP__opus-mt-en-fr"
BALISE = re.compile(r"ZZ\s?(\d+)\s?ZZ")
LOT = 1


class Marian:
    def __init__(self, chemin):
        self.tok = MarianTokenizer.from_pretrained(chemin)
        self.modele = AutoModelForSeq2SeqLM.from_pretrained(chemin).eval()

    def traduire(self, texte):
        # Phrase par phrase : le modele a appris sur des phrases seules, et oubliait la
        # premiere phrase d'un message qui en contient deux.
        return " ".join(self._une_phrase(p) for p in decouper_phrases(texte))

    def _une_phrase(self, texte):
        enc = self.tok([texte], return_tensors="pt", truncation=True, max_length=256)
        plafond = 3 * int(enc["attention_mask"].sum()) + 24
        with torch.inference_mode():
            sortie = self.modele.generate(**enc, num_beams=4, no_repeat_ngram_size=3, max_new_tokens=plafond)
        return self.tok.decode(sortie[0], skip_special_tokens=True).strip()


def controler(source, sortie, lexique=None):
    """Motifs de rejet d'une traduction."""
    motifs = []
    balises_source, balises_sortie = sorted(BALISE.findall(source)), sorted(BALISE.findall(sortie))
    if balises_source != balises_sortie:
        motifs.append("balises_changees")
    if re.search(r"\d", BALISE.sub("", sortie)):
        motifs.append("chiffre_invente")
    mots = sortie.lower().split()
    if not mots:
        motifs.append("vide")
    if any(mots[i] == mots[i + 1] == mots[i + 2] for i in range(len(mots) - 2)):
        motifs.append("repetition")
    if sortie.lower().strip(" .") == source.lower().strip(" ."):
        motifs.append("recopie")
    if lexique is not None:
        inconnus = [m for m in re.findall(r"[a-zà-ÿ']+", BALISE.sub(" ", sortie).lower()) if m not in lexique]
        if inconnus:
            motifs.append("mots_inconnus:" + ",".join(sorted(set(inconnus))))
    return motifs


class Chaine:
    def __init__(self, modele=JAMM55, fr_en=OPUS_FR_EN, lexique=None):
        torch.set_num_threads(2)
        self.wes = Marian(str(modele))
        self.fr_en = Marian(str(fr_en))
        self.lexique = lexique

    def traduire(self, texte, langue):
        masque = mask(texte)
        entree = re.sub(r"\{x(\d+)\}", r"ZZ\1ZZ", masque.text)
        simple = simplifier(entree, langue)
        anglais = simple if langue == "en" else self.fr_en.traduire(simple)
        sortie = self.wes.traduire(anglais)
        motifs = controler(anglais, sortie, self.lexique)
        rendu = BALISE.sub(lambda m: masque.values.get("x" + m.group(1), m.group()), sortie)
        return {"source": texte, "simplifie": simple, "anglais": anglais, "brut": sortie, "pidgin": rendu, "motifs": motifs, "valeurs": list(masque.values.values())}
