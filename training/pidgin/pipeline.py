"""Chaine complete de traduction : masquage, simplification, passage par l'anglais, pidgin, controles."""
import json
import os
import re
import sys
from pathlib import Path

os.environ.update(USE_TF="0", USE_FLAX="0", TRANSFORMERS_NO_TF="1", TOKENIZERS_PARALLELISM="false")

import torch  # noqa: E402
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, MarianTokenizer  # noqa: E402

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


# Prefixe demande par certains modeles multilingues (mT5). Vide = rien a ajouter.
PREFIXES = {"mt5": ""}


class M2M100CT2:
    """m2m100 converti en CTranslate2 : source __en__, cible pidgin __fr__."""

    LANGUE_SOURCE = "__en__"
    LANGUE_CIBLE = "__fr__"

    def __init__(self, chemin, beam_size=4, threads=2):
        import ctranslate2
        from transformers import M2M100Tokenizer

        chemin = Path(chemin)
        self._tok = M2M100Tokenizer.from_pretrained(str(chemin), local_files_only=True)
        self._tok.src_lang = "en"
        self._beam_size = beam_size
        self._modele = ctranslate2.Translator(
            str(chemin), device="cpu", compute_type="int8", inter_threads=1, intra_threads=threads
        )

    def translate(self, texte):
        return " ".join(self._une_phrase(p) for p in decouper_phrases(texte))

    def _une_phrase(self, texte):
        jetons = self._tok.convert_ids_to_tokens(self._tok.encode(texte))
        limite = min(256, 3 * len(jetons) + 24)
        resultat = self._modele.translate_batch(
            [jetons],
            target_prefix=[[self.LANGUE_CIBLE]],
            beam_size=self._beam_size,
            max_decoding_length=limite,
            no_repeat_ngram_size=3,
        )
        sortie = resultat[0].hypotheses[0]
        if sortie and sortie[0] == self.LANGUE_CIBLE:
            sortie = sortie[1:]
        texte_sortie = self._tok.decode(
            self._tok.convert_tokens_to_ids(sortie), skip_special_tokens=True
        ).strip()
        return re.sub(r"Z\s?Z\s?(\d+)\s?Z\s?Z", r"ZZ\1ZZ", texte_sortie, flags=re.I)


class Marian:
    """Charge un modele anglais -> pidgin du disque, quel que soit son type.

    Trois formats : CTranslate2 (dossier avec model.bin), Marian classique
    (source.spm/target.spm) et les modeles Hugging Face mT5 / M2M100. Le type
    vient de config.json ; le decodage reste le meme pour tous.
    """

    def __init__(self, chemin):
        # Version convertie (CTranslate2, dossier avec model.bin) : on la lit comme le serveur, avec le meme decodage.
        # C'est le seul format que renvoie le notebook Colab (la version Hugging Face reste sur le disque temporaire de Colab).
        self.ct2 = None
        self.forced_bos_token_id = None
        self.prefixe = ""
        chemin = Path(chemin)
        if (chemin / "model.bin").exists():
            config = {}
            if (chemin / "config.json").exists():
                config = json.loads((chemin / "config.json").read_text(encoding="utf-8"))
            m2m = config.get("model_type") in ("m2m100", "m2m_100") or (
                (chemin / "sentencepiece.bpe.model").exists() and (chemin / "vocab.json").exists()
            )
            if m2m:
                self.ct2 = M2M100CT2(chemin)
            else:
                from app.engines import MarianCT2Translator

                self.ct2 = MarianCT2Translator(chemin)
            return
        config = json.loads((chemin / "config.json").read_text(encoding="utf-8"))
        self.type = config.get("model_type")
        if self.type in ("m2m100", "m2m_100"):
            from transformers import M2M100Tokenizer

            self.tok = M2M100Tokenizer.from_pretrained(chemin, local_files_only=True)
            self.tok.src_lang = "en"
            # La langue cible n'est pas dans le tokenizer : elle est forcee a la generation.
            self.forced_bos_token_id = config.get("forced_bos_token_id")
        elif self.type == "mt5":
            self.tok = AutoTokenizer.from_pretrained(chemin, local_files_only=True)
            self.prefixe = PREFIXES.get("mt5", "")
        else:
            self.tok = MarianTokenizer.from_pretrained(chemin, local_files_only=True)
        self.modele = AutoModelForSeq2SeqLM.from_pretrained(chemin, local_files_only=True).eval()

    def traduire(self, texte):
        if self.ct2 is not None:
            # Le serveur rend les balises en {xN} ; cette chaine de test les attend en ZZnZZ.
            return re.sub(r"\{x(\d+)\}", r"ZZ\1ZZ", self.ct2.translate(texte))
        # Phrase par phrase : le modele a appris sur des phrases seules, et oubliait la
        # premiere phrase d'un message qui en contient deux.
        return " ".join(self._une_phrase(p) for p in decouper_phrases(texte))

    def _une_phrase(self, texte):
        enc = self.tok([self.prefixe + texte], return_tensors="pt", truncation=True, max_length=256)
        plafond = 3 * int(enc["attention_mask"].sum()) + 24
        supplement = {}
        if self.forced_bos_token_id is not None:
            supplement["forced_bos_token_id"] = self.forced_bos_token_id
        with torch.inference_mode():
            sortie = self.modele.generate(**enc, num_beams=4, no_repeat_ngram_size=3, max_new_tokens=plafond, **supplement)
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
