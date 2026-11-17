"""Prepare et importe les enregistrements humains de la voix pidgin.

1) Script a faire lire au locuteur (les morceaux entre les {xN} du catalogue) :
       python backend/scripts/audio_catalogue.py script [--sortie fichier.csv]
2) Import des enregistrements recus, une fois le texte valide par le locuteur :
       python backend/scripts/audio_catalogue.py importer dossier_audio liste.csv --valide-par "Nom du locuteur"
   liste.csv (separateur ;) : id;texte;fichier   (fichier relatif a dossier_audio ; WAV, ou tout format lu par ffmpeg)
   Sortie : models/poids/audio/wes/<id>.wav + manifest.json (hors depot : c'est la voix d'une personne).
3) Voix de synthese pre-generee pour les textes valides (sans enregistrement humain) :
       python backend/scripts/audio_catalogue.py synthetiser --valide-par "Locuteur 1" [--ecoute evaluation/tts_ecoute]
4) Controle : python backend/scripts/audio_catalogue.py verifier
5) Changer de voix pour les extraits deja valides (memes identifiants, memes textes ; l'ancienne voix est gardee a cote) :
       python backend/scripts/audio_catalogue.py revoix --modele models/poids/tts/mms-tts-wes-v1 --speaker-id 12

Les enregistrements sont convertis en WAV 16 bits, 16 kHz, mono, rognes aux extremites et ramenes a un niveau commun.
Un texte avec un chiffre ou une balise est refuse : les nombres sont lus par les extraits de l'extension.
"""
import argparse
import csv
import datetime
import io
import json
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

DEPOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(DEPOT / "backend"))
from app.clips import SAMPLE_RATE, ClipLibrary, piece_key, split_pieces  # noqa: E402
from app.security.masking import SLOT_RE  # noqa: E402

CATALOGUE = DEPOT / "content-data" / "safinum_test_page.json"
DESTINATION = DEPOT / "models" / "poids" / "audio" / "wes"
PEAK = 0.9
SILENCE_DB = -45
MARGE = 0.08  # secondes gardees autour de la voix


def pieces_du_catalogue() -> list[tuple[str, str, bool]]:
    """(identifiant, morceau, phrase_entiere) sans doublon, pour les textes que la memoire de traduction sert vraiment.

    On part de la memoire (valeurs masquees en {xN}) : c'est exactement le texte que l'extension enverra a /v1/tts.
    """
    from app.memory import _load_page

    textes = []
    for fichier in (CATALOGUE, CATALOGUE.with_name("kama_interface.json")):  # page de test, puis phrases et interface de Kama
        if fichier.exists():
            templates, patterns = _load_page(fichier)
            textes += [(t.id, t.translations["wes"]) for t in templates if "wes" in t.translations]
            textes += [(p.id, p.translations["wes"]) for p in patterns if "wes" in p.translations]
    vus, sortie = set(), []
    for ident, texte in textes:
        morceaux = split_pieces(texte)
        for n, morceau in enumerate(morceaux):
            cle = piece_key(morceau)
            if cle and cle not in vus:
                vus.add(cle)
                sortie.append((ident if n == 0 else f"{ident}_{n + 1}", morceau, not SLOT_RE.search(texte)))
    return sortie


def lire_audio(chemin: Path) -> np.ndarray:
    """Onde mono en flottants a 16 kHz. WAV lu directement, le reste par ffmpeg."""
    if chemin.suffix.lower() == ".wav":
        try:
            with wave.open(str(chemin), "rb") as w:
                if w.getsampwidth() == 2:
                    brut = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
                    brut = brut.reshape(-1, w.getnchannels()).mean(axis=1)
                    return reechantillonner(brut, w.getframerate())
        except wave.Error:
            pass
    if shutil.which("ffmpeg") is None:
        raise SystemExit(f"{chemin.name} : format non WAV 16 bits et ffmpeg est absent")
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(chemin), "-f", "s16le", "-ac", "1", "-ar", str(SAMPLE_RATE), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(out, dtype="<i2").astype(np.float32) / 32768


def reechantillonner(x: np.ndarray, taux: int) -> np.ndarray:
    if taux == SAMPLE_RATE:
        return x
    from scipy.signal import resample_poly

    from math import gcd

    g = gcd(taux, SAMPLE_RATE)
    return resample_poly(x, SAMPLE_RATE // g, taux // g).astype(np.float32)


def rogner_et_niveler(x: np.ndarray) -> np.ndarray:
    seuil = 10 ** (SILENCE_DB / 20)  # seuil absolu : un enregistrement tres faible reste rogne de la meme facon
    actifs = np.flatnonzero(np.abs(x) > seuil)
    if actifs.size == 0:
        raise ValueError("enregistrement silencieux")
    marge = int(MARGE * SAMPLE_RATE)
    x = x[max(actifs[0] - marge, 0) : actifs[-1] + marge]
    return x * (PEAK / float(np.abs(x).max()))


def ecrire_wav(chemin: Path, x: np.ndarray) -> None:
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2").tobytes()
    with wave.open(str(chemin), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)


def commande_script(a):
    pieces = pieces_du_catalogue()
    sortie = Path(a.sortie)
    with open(sortie, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["id", "texte a lire", "fichier (a remplir)"])
        for ident, morceau, _ in pieces:
            w.writerow([ident, morceau, f"{ident}.wav"])
    print(f"{len(pieces)} morceaux a enregistrer -> {sortie}")


def commande_importer(a):
    dossier, liste = Path(a.dossier), Path(a.liste)
    DESTINATION.mkdir(parents=True, exist_ok=True)
    manifeste = DESTINATION / "manifest.json"
    clips = {c["id"]: c for c in json.loads(manifeste.read_text(encoding="utf-8"))["clips"]} if manifeste.exists() else {}
    refuses = 0
    for ligne in csv.DictReader(open(liste, encoding="utf-8-sig", newline=""), delimiter=";"):
        ident, texte, fichier = ligne["id"].strip(), ligne["texte"].strip(), ligne["fichier"].strip()
        if not ident or not texte or any(c.isdigit() for c in texte) or SLOT_RE.search(texte):
            print(f"REFUSE {ident or '?'} : texte vide, avec chiffre ou avec balise")
            refuses += 1
            continue
        try:
            onde = rogner_et_niveler(lire_audio(dossier / fichier))
            if len(onde) / SAMPLE_RATE > 15:
                raise ValueError("plus de 15 secondes")
            ecrire_wav(DESTINATION / f"{ident}.wav", onde)
        except Exception as e:
            print(f"REFUSE {ident} : {e}")
            refuses += 1
            continue
        clips[ident] = {"id": ident, "text": texte, "file": f"{ident}.wav", "validated_by": a.valide_par, "date": datetime.date.today().isoformat()}
        print(f"OK {ident} ({len(onde) / SAMPLE_RATE:.1f} s)")
    manifeste.write_text(json.dumps({"sample_rate": SAMPLE_RATE, "clips": list(clips.values())}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(clips)} enregistrements dans {DESTINATION} ; {refuses} refuse(s)")


def commande_synthetiser(a):
    """Genere une fois pour toutes la voix de synthese des textes valides, pour ne pas dependre du modele a l'execution.

    Les phrases deja ecoutees et validees (dossier --ecoute) sont reprises telles quelles ; le reste est genere avec
    le meme modele, la meme graine et les memes pauses. Origine : synthetic.
    """
    from app.voice_engines import MmsVitsSynthesizer

    synth = MmsVitsSynthesizer(Path(a.modele), speaker_id=a.speaker_id)
    ecoute = Path(a.ecoute) if a.ecoute else None
    DESTINATION.mkdir(parents=True, exist_ok=True)
    clips, repris, generes = {}, 0, 0
    for ident, morceau, entiere in pieces_du_catalogue():
        source = ecoute / f"{ident}.wav" if ecoute and entiere else None
        if source is not None and source.exists():
            wav, repris = source.read_bytes(), repris + 1
        else:
            wav, generes = synth.synthesize(morceau), generes + 1
        (DESTINATION / f"{ident}.wav").write_bytes(wav)
        clips[ident] = {"id": ident, "text": morceau, "file": f"{ident}.wav", "validated_by": a.valide_par,
                        "date": datetime.date.today().isoformat(), "origin": "synthetic"}
    (DESTINATION / "manifest.json").write_text(
        json.dumps({"sample_rate": SAMPLE_RATE, "clips": list(clips.values())}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(clips)} clips synthetiques ({repris} repris de l'ecoute validee, {generes} generes) -> {DESTINATION}")


def commande_revoix(a):
    """Regenere la voix de synthese des extraits deja valides avec un autre modele (meme texte, meme identifiant).

    Seuls les extraits d'origine « synthetic » changent ; un enregistrement humain (« recorded ») n'est jamais remplace.
    Le texte reste celui que le locuteur a valide ; la nouvelle voix est notee (champ « voix ») et marquee a reecouter
    (« audio_a_reecouter ») tant que le locuteur ne l'a pas entendue. L'ancien dossier est copie dans <langue>_ancienne_voix.
    """
    from app.voice_engines import MmsVitsSynthesizer

    manifeste = DESTINATION / "manifest.json"
    donnees = json.loads(manifeste.read_text(encoding="utf-8"))
    sauvegarde = DESTINATION.with_name(DESTINATION.name + "_ancienne_voix")
    if not sauvegarde.exists():
        shutil.copytree(DESTINATION, sauvegarde)
    synth = MmsVitsSynthesizer(Path(a.modele), speaker_id=a.speaker_id)
    voix = f"{Path(a.modele).name}" + (f"#{a.speaker_id}" if a.speaker_id is not None else "")
    changes = 0
    for clip in donnees["clips"]:
        if clip.get("origin") != "synthetic":
            continue
        (DESTINATION / clip["file"]).write_bytes(synth.synthesize(clip["text"]))
        clip.update(voix=voix, date=datetime.date.today().isoformat(), audio_a_reecouter=True)
        changes += 1
    manifeste.write_text(json.dumps(donnees, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{changes} extraits regeneres avec {voix} -> {DESTINATION} (ancienne voix : {sauvegarde})")


def commande_verifier(_):
    bib = ClipLibrary.load(DESTINATION)
    voulus = pieces_du_catalogue()
    manquants = [(i, m) for i, m, _ in voulus if bib.find(m) is None]
    print(f"{len(bib)} enregistrements valides ; catalogue : {len(voulus)} morceaux, {len(manquants)} sans enregistrement")
    for i, m in manquants[:40]:
        print(f"  manque : {i} : {m}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("script")
    s.add_argument("--sortie", default="script_enregistrement_pidgin.csv")
    i = sub.add_parser("importer")
    i.add_argument("dossier")
    i.add_argument("liste")
    i.add_argument("--valide-par", required=True, help="Nom ou pseudonyme du locuteur qui a valide le texte")
    y = sub.add_parser("synthetiser")
    y.add_argument("--valide-par", required=True)
    y.add_argument("--modele", default=str(DEPOT / "models" / "poids" / "tts" / "mms-tts-pcm"))
    y.add_argument("--ecoute", help="Dossier des WAV deja ecoutes et valides (evaluation/tts_ecoute)")
    y.add_argument("--speaker-id", type=int, help="Voix a utiliser pour un modele a plusieurs voix (12 = melange de mms-tts-wes-v1)")
    v = sub.add_parser("revoix")
    v.add_argument("--modele", required=True)
    v.add_argument("--speaker-id", type=int)
    sub.add_parser("verifier")
    a = ap.parse_args()
    {"script": commande_script, "importer": commande_importer, "synthetiser": commande_synthetiser, "revoix": commande_revoix,
     "verifier": commande_verifier}[a.cmd](a)


if __name__ == "__main__":
    main()
