"""Garde les travaux en vie : relance automatiquement tout processus arrete avant sa fin normale."""
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
LOGS = os.path.join(HERE, "logs")
os.makedirs(LOGS, exist_ok=True)
JOBS = {
    "download_models.py": ("download.log", "TERMINE"),
    "loop_nmt.py": ("nmt.log", "BOUCLE TERMINEE"),
    "run_gguf.py": ("gguf.log", "GGUF TERMINE"),
}
sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)


def running():
    return subprocess.run(
        ["powershell", "-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | ForEach-Object { $_.CommandLine }"],
        capture_output=True, text=True, errors="replace", timeout=120,
    ).stdout


def is_done(log, marker):
    path = os.path.join(LOGS, log)
    if not os.path.exists(path):
        return False
    with open(path, encoding="utf-8", errors="replace") as f:
        return marker in f.read()


while True:
    procs = running()
    pending = 0
    for script, (log, marker) in JOBS.items():
        if is_done(log, marker):
            continue
        pending += 1
        if script in procs or (script == "run_gguf.py" and "debug_e2b.py" in procs):
            continue
        print(f"[{time.strftime('%H:%M:%S')}] relance de {script}")
        with open(os.path.join(LOGS, log), "ab") as out:
            subprocess.Popen([sys.executable, "-I", os.path.join(HERE, script)], cwd=HERE, stdout=out, stderr=subprocess.STDOUT)
    if not pending:
        print(f"[{time.strftime('%H:%M:%S')}] tout est termine")
        break
    time.sleep(60)
