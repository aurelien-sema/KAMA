"""Prepare les donnees d'ajustement de m2m100 (anglais -> pidgin camerounais).

Source : data_propre de KAMA_pidgin_finance_drive.zip (mt560, banque, balises,
mt560-financier-propre). Aucun texte de test n'entre dans l'entrainement.

Usage :
  python 01_preparer_donnees.py
  python 01_preparer_donnees.py --zip chemin.zip --part_religieux 0.15
  python 01_preparer_donnees.py --normaliser table.json --ajouts ajouts.jsonl

Sortie : data/train.jsonl, data/dev.jsonl, data/test_soreva.jsonl, data/rapport.json
Puis : python exporter_drive.py, et mettre le zip dans Mon Drive.
"""
import argparse
import csv
import json
import random
import re
import unicodedata
import zipfile
from collections import Counter
from pathlib import Path

ICI = Path(__file__).resolve().parent
DEPOT = ICI.parents[1]
ZIP_DEFAUT = DEPOT / "training" / "pidgin" / "export_drive" / "KAMA_pidgin_finance_drive.zip"
SORTIE_DEFAUT = ICI / "data"
SEED = 13
PART_RELIGIEUX = 0.15
DEV_TOTAL = 600
SURPOIDS = {"banque": 3, "balises": 3}
LICENCES = {
    "mt560": "CC BY 4.0",
    "mt560-financier-propre": "CC BY 4.0",
    "balises": "CC BY 4.0 (derive de MT560)",
    "banque": "KAMA (brouillon a valider)",
    "ajout": "KAMA (a valider)",
    "soreva": "CC BY 4.0",
}

# Memes familles de mots que 01_nettoyer_donnees.py, avec les termes demandes en plus.
RELIGIEUX = re.compile(
    r"\b(?:Jehovah|Jesus|Christ|Bible|God|Lord|Kingdom|apostle|congregation|"
    r"preach(?:er|ers|ing)?|pray(?:er|ers|ing)?|worship(?:ers?|ping)?|gospel|"
    r"disciple|sinner|sin|heaven|angel|prophet|scripture|verse|church|faith|baptism)\b",
    re.I,
)
BALISE = re.compile(r"ZZ\s?(\d+)\s?ZZ")


def normaliser(texte):
    """Forme les espaces sans toucher aux balises ZZ1ZZ."""
    texte = unicodedata.normalize("NFC", str(texte)).replace("\u2019", "'").replace("\u00a0", " ")
    return " ".join(texte.split())


def cle_texte(texte):
    """Forme de comparaison : sans casse, ponctuation ni espaces superflus."""
    return " ".join(re.sub(r"[^\w']+", " ", unicodedata.normalize("NFC", str(texte)).lower()).split())


def charger_table(chemin):
    if not chemin:
        return {}
    contenu = json.loads(Path(chemin).read_text(encoding="utf-8"))
    if isinstance(contenu, dict) and "remplacements" in contenu:
        contenu = contenu["remplacements"]
    if isinstance(contenu, list):
        contenu = {str(x["avant"]): str(x["apres"]) for x in contenu if "avant" in x and "apres" in x}
    if not isinstance(contenu, dict):
        raise ValueError("table de normalisation : objet {mot: remplacement} ou liste {avant, apres} attendu")
    return {str(avant): str(apres) for avant, apres in contenu.items() if str(avant).strip()}


def appliquer_table(texte, table):
    """Remplacement mot a mot cote wes, en laissant les balises ZZ intactes."""
    if not table:
        return texte
    morceaux = re.split(r"(ZZ\s?\d+\s?ZZ)", texte)
    for i in range(0, len(morceaux), 2):
        for avant, apres in sorted(table.items(), key=lambda x: -len(x[0])):
            morceaux[i] = re.sub(
                rf"(?<!\w){re.escape(avant)}(?!\w)", lambda _: apres, morceaux[i], flags=re.I
            )
    return "".join(morceaux)


def est_religieux(en, wes, domaine=None):
    return domaine == "religieux" or bool(RELIGIEUX.search(en) or RELIGIEUX.search(wes))


def trouver_zip(demande):
    if demande:
        chemin = Path(demande)
        if not chemin.exists():
            raise FileNotFoundError(chemin)
        return chemin
    candidats = [
        ZIP_DEFAUT,
        DEPOT / "KAMA_pidgin_finance_drive.zip",
        ICI.parent / "pidgin" / "export_drive" / "KAMA_pidgin_finance_drive.zip",
    ]
    for chemin in candidats:
        if chemin.exists():
            return chemin
    raise FileNotFoundError(
        "KAMA_pidgin_finance_drive.zip introuvable : passe --zip chemin.zip "
        "(genere-le avec training/pidgin/14_preparer_finance.py)"
    )


def lire_jsonl_zip(archive, suffixe):
    noms = [n for n in archive.namelist() if n.endswith(suffixe)]
    if not noms:
        raise FileNotFoundError(f"{suffixe} absent du zip")
    return [json.loads(l) for l in archive.read(noms[0]).decode("utf-8").splitlines() if l.strip()]


def lire_jsonl(chemin):
    if not chemin or not Path(chemin).exists():
        return []
    return [json.loads(l) for l in Path(chemin).read_text(encoding="utf-8").splitlines() if l.strip()]


def ajouter_textes(depuis_csv, textes, colonnes=None):
    with open(depuis_csv, encoding="utf-8-sig", newline="") as f:
        for ligne in csv.reader(f, delimiter="\t"):
            for i, valeur in enumerate(ligne):
                if colonnes is None or i in colonnes:
                    if str(valeur).strip():
                        textes.append(str(valeur))


def charger_interdits(archive):
    """Toutes les phrases de test, des deux cotes, pour interdire toute fuite."""
    textes = []
    cas = json.loads((ICI.parent / "pidgin" / "cas_inedits.json").read_text(encoding="utf-8"))
    for c in cas.get("cas", []):
        textes += [c.get("fr", ""), c.get("en", "")]
    for t in lire_jsonl_zip(archive, "data_propre/test_soreva.jsonl"):
        textes += [t.get("en", ""), t.get("wes", "")]
    for chemin in (
        DEPOT / "datasets" / "pidgin" / "kama_pidgin_v2" / "test_soreva.jsonl",
        DEPOT / "datasets" / "soreva" / "pcm_cm.test.tsv",
        DEPOT / "evaluation" / "soreva_refs.tsv",
    ):
        if not chemin.exists():
            continue
        if chemin.suffix == ".jsonl":
            for t in lire_jsonl(chemin):
                textes += [t.get("en", ""), t.get("wes", ""), t.get("fr", "")]
        else:
            ajouter_textes(chemin, textes)
    for chemin in (DEPOT / "datasets" / "soreva").glob("*"):
        if chemin.suffix.lower() in (".tsv", ".txt"):
            ajouter_textes(chemin, textes)
        elif chemin.suffix.lower() == ".jsonl":
            for t in lire_jsonl(chemin):
                textes += [t.get("en", ""), t.get("wes", ""), t.get("fr", "")]
    return {cle_texte(t) for t in textes if str(t).strip()}


def preparer_ligne(ligne, table, source_defaut="ajout"):
    en, wes = normaliser(ligne.get("en", "")), normaliser(ligne.get("wes", ""))
    if not en or not wes:
        return None
    wes = appliquer_table(wes, table)
    source = str(ligne.get("source") or source_defaut)
    religieux = est_religieux(en, wes, ligne.get("domaine"))
    if source == "banque":
        domaine = "banque"
    elif religieux:
        domaine = "religieux"
    else:
        domaine = str(ligne.get("domaine") or "general")
    licence = str(ligne.get("licence") or LICENCES.get(source, "a verifier"))
    return {"en": en, "wes": wes, "source": source, "domaine": domaine, "licence": licence, "_religieux": religieux}


def choisir_dev(lignes, total):
    """600 paires : une partie des banque uniques, le reste en mt560 non religieux.

    Les banque de data_propre contiennent deja les repetitions de la v2 : apres
    dedoublonnage il n'en reste que ~112. On en reserve la moitie au dev pour ne
    pas vider le train, puis on complete avec mt560.
    """
    banque = [l for l in lignes if l["source"] == "banque" and not l["_religieux"]]
    mt560 = [l for l in lignes if l["source"] == "mt560" and not l["_religieux"]]
    random.shuffle(banque)
    random.shuffle(mt560)
    dev, vus = [], set()
    n_banque = min(total // 2, len(banque) // 2)
    if banque and n_banque == 0:
        n_banque = 1

    def prendre(pool, nombre):
        pris = 0
        for ligne in pool:
            if pris >= nombre:
                break
            cle = cle_texte(ligne["en"])
            if cle in vus:
                continue
            vus.add(cle)
            dev.append(ligne)
            pris += 1

    prendre(banque, n_banque)
    prendre(mt560, total - len(dev))
    if len(dev) < total:
        for pool in (banque, mt560):
            prendre(pool, total - len(dev))
    return dev


def sans_marqueur(ligne):
    return {k: v for k, v in ligne.items() if not k.startswith("_")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", help="KAMA_pidgin_finance_drive.zip (sinon recherche automatique)")
    ap.add_argument("--sortie", default=str(SORTIE_DEFAUT))
    ap.add_argument("--part_religieux", type=float, default=PART_RELIGIEUX, help="part des phrases religieuses gardee (0.15 par defaut)")
    ap.add_argument("--normaliser", help="table JSON de remplacement mot a mot cote wes")
    ap.add_argument("--ajouts", help="fichier JSONL a ajouter (post-edition, retro-traduction)")
    ap.add_argument("--dev", type=int, default=DEV_TOTAL)
    ap.add_argument("--poids_banque", type=int, default=SURPOIDS["banque"])
    ap.add_argument("--poids_balises", type=int, default=SURPOIDS["balises"])
    ap.add_argument("--seed", type=int, default=SEED)
    a = ap.parse_args()
    if not 0 <= a.part_religieux <= 1:
        raise SystemExit("--part_religieux doit etre entre 0 et 1")
    random.seed(a.seed)
    zip_path = trouver_zip(a.zip)
    sortie = Path(a.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    table = charger_table(a.normaliser)

    with zipfile.ZipFile(zip_path) as archive:
        assert archive.testzip() is None, "zip abime"
        brut = lire_jsonl_zip(archive, "data_propre/train.jsonl")
        test = lire_jsonl_zip(archive, "data_propre/test_soreva.jsonl")
        interdits = charger_interdits(archive)

    ajouts = lire_jsonl(a.ajouts)
    toutes, vues = [], set()
    stats = Counter(lues=len(brut) + len(ajouts), ajouts=len(ajouts), fuites_test=0, vides=0, doublons=0)
    for ligne in brut + ajouts:
        if cle_texte(normaliser(ligne.get("en", ""))) in interdits or cle_texte(normaliser(ligne.get("wes", ""))) in interdits:
            stats["fuites_test"] += 1
            continue
        preparee = preparer_ligne(ligne, table)
        if preparee is None:
            stats["vides"] += 1
            continue
        if cle_texte(preparee["en"]) in interdits or cle_texte(preparee["wes"]) in interdits:
            stats["fuites_test"] += 1
            continue
        paire = (cle_texte(preparee["en"]), cle_texte(preparee["wes"]))
        if paire in vues:
            stats["doublons"] += 1
            continue
        vues.add(paire)
        toutes.append(preparee)

    religieuses = [l for l in toutes if l["_religieux"]]
    autres = [l for l in toutes if not l["_religieux"]]
    random.shuffle(religieuses)
    gardees = religieuses[: round(len(religieuses) * a.part_religieux)]
    stats.update(
        religieux_avant=len(religieuses),
        religieux_gardes=len(gardees),
        religieux_retires=len(religieuses) - len(gardees),
    )
    toutes = autres + gardees

    dev = choisir_dev(toutes, a.dev)
    dev_paires = {(cle_texte(l["en"]), cle_texte(l["wes"])) for l in dev}
    dev_en = {cle_texte(l["en"]) for l in dev}
    train = [
        l
        for l in toutes
        if (cle_texte(l["en"]), cle_texte(l["wes"])) not in dev_paires
        and cle_texte(l["en"]) not in dev_en
    ]

    poids = {"banque": a.poids_banque, "balises": a.poids_balises}
    train_final = []
    for ligne in train:
        train_final += [sans_marqueur(ligne)] * poids.get(ligne["source"], 1)
    random.shuffle(train_final)

    for ligne in train_final + dev:
        assert cle_texte(ligne["en"]) not in interdits, f"fuite test : {ligne['en']}"
        assert cle_texte(ligne["wes"]) not in interdits, f"fuite test : {ligne['wes']}"
    assert not ({cle_texte(l["en"]) for l in train_final} & {cle_texte(l["en"]) for l in dev}), "fuite dev -> train"

    ecrire = lambda nom, lignes: (sortie / nom).write_text(
        "\n".join(json.dumps(sans_marqueur(l), ensure_ascii=False) for l in lignes) + "\n", encoding="utf-8"
    )
    ecrire("train.jsonl", train_final)
    ecrire("dev.jsonl", dev)
    ecrire("test_soreva.jsonl", [{**t, "licence": LICENCES["soreva"]} for t in test])

    longueur = lambda lignes, cote: round(sum(len(l[cote].split()) for l in lignes) / max(len(lignes), 1), 2)
    rapport = {
        "zip": str(zip_path),
        "graine": a.seed,
        "part_religieux": a.part_religieux,
        "poids": poids,
        **stats,
        "apres_filtrage": len(toutes),
        "dev": len(dev),
        "test_soreva": len(test),
        "train_avant_surpoids": len(train),
        "train": len(train_final),
        "retires_car_dans_dev": len(toutes) - len(dev) - len(train),
        "banque_uniques": len({cle_texte(l["en"]) for l in toutes if l["source"] == "banque"}),
        "repartition_train": dict(Counter(l["source"] for l in train_final)),
        "domaines_train": dict(Counter(l["domaine"] for l in train_final)),
        "repartition_dev": dict(Counter(l["source"] for l in dev)),
        "paires_avec_balises": sum(bool(BALISE.search(l["en"]) or BALISE.search(l["wes"])) for l in train_final),
        "longueur_moyenne_en": longueur(train_final, "en"),
        "longueur_moyenne_wes": longueur(train_final, "wes"),
    }
    (sortie / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(rapport, ensure_ascii=False, indent=1))
    if len(dev) < a.dev:
        print(f"ATTENTION : seulement {len(dev)} paires de dev (demande {a.dev}).")


if __name__ == "__main__":
    main()
