"""Cree KAMA_pidgin_m2m_drive.zip, a mettre tel quel dans Mon Drive."""
import json
import zipfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
DATA = ICI / "data"
SORTIE = ICI / "export_drive"
SORTIE.mkdir(exist_ok=True)

FICHIERS = {
    DATA / "train.jsonl": "data/train.jsonl",
    DATA / "dev.jsonl": "data/dev.jsonl",
    DATA / "test_soreva.jsonl": "data/test_soreva.jsonl",
    DATA / "rapport.json": "data/rapport.json",
    ICI / "entrainement_m2m_colab.ipynb": "entrainement_m2m_colab.ipynb",
    ICI / "README.md": "README.md",
}
for source in FICHIERS:
    if not source.exists():
        raise SystemExit(f"manquant : {source} (lance d'abord 01_preparer_donnees.py)")

archive = SORTIE / "KAMA_pidgin_m2m_drive.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for source, nom in FICHIERS.items():
        z.write(source, f"KAMA/pidgin_m2m/{nom}")
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    compte = {n.rsplit("/", 1)[1]: sum(1 for _ in z.open(n)) for n in z.namelist() if n.endswith(".jsonl")}
    json.loads(z.read("KAMA/pidgin_m2m/entrainement_m2m_colab.ipynb"))
    print(archive, f"{archive.stat().st_size / 1048576:.1f} Mo", compte)
