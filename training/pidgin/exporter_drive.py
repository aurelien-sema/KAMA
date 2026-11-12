"""Cree KAMA_pidgin_drive.zip, a mettre tel quel dans Mon Drive."""
import json
import zipfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
DATASET = ICI.parents[1] / "datasets" / "pidgin" / "kama_pidgin_v2"
SORTIE = ICI / "export_drive"
SORTIE.mkdir(exist_ok=True)
FICHIERS = {DATASET / n: f"KAMA/pidgin/data/{n}" for n in ("train.jsonl", "dev.jsonl", "test_soreva.jsonl", "rapport.json", "README.md")}
FICHIERS[ICI / "02_entrainer.py"] = "KAMA/pidgin/02_entrainer.py"
FICHIERS[ICI / "entrainement_colab.ipynb"] = "KAMA/pidgin/entrainement_colab.ipynb"
archive = SORTIE / "KAMA_pidgin_drive.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for source, nom in FICHIERS.items():
        z.write(source, nom)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    compte = {n.rsplit("/", 1)[1]: sum(1 for _ in z.open(n)) for n in z.namelist() if n.endswith(".jsonl")}
    json.loads(z.read("KAMA/pidgin/entrainement_colab.ipynb"))
    print(archive, f"{archive.stat().st_size / 1048576:.1f} Mo", compte)
