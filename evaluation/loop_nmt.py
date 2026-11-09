"""Teste chaque modele des qu'il est telecharge.

Les tests courts passent d'abord. Les corpus longs attendent la fin des telechargements,
pour ne pas retarder les modeles qui n'ont encore aucun resultat.
"""
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HERE, "logs", "download.log")
PY = sys.executable


def finished():
    return os.path.exists(LOG) and "TERMINE" in open(LOG, encoding="utf-8", errors="replace").read()


def run(phase):
    subprocess.run([PY, "-I", os.path.join(HERE, "run_nmt.py"), "--phase", str(phase)], cwd=HERE, check=False)


while True:
    end = finished()  # lu avant le passage : aucun modele ne peut etre oublie
    run(1)
    if end:
        run(2)
        break
    time.sleep(120)
print("BOUCLE TERMINEE")
