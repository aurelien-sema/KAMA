# Lance le serveur de Kama dans les conditions de la démonstration (mode production, origine limitée à l'extension).
#
#   .\scripts\lancer_demo.ps1            reconnaissance vocale activée (micro)
#   .\scripts\lancer_demo.ps1 -SansVoix  comme la configuration par défaut : micro désactivé
#
# Dans une autre fenêtre : python scripts\verifier_demo.py   (vérifie que le serveur répond comme l'extension l'attend)
param([switch]$SansVoix)

$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$python = Join-Path $backend '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) { throw "Environnement Python introuvable : $python (voir backend/README.md)" }

$env:KAMA_ENV = 'prod'
# Identifiant FIXE de l'extension (clé publique dans kama_frontend/wxt.config.ts) : il ne change pas d'un ordinateur à l'autre.
$env:KAMA_ALLOWED_ORIGINS = 'chrome-extension://nneecloagollpakilpepnamdaelmgkbn'
$env:KAMA_HOST = '127.0.0.1'
$env:KAMA_PORT = '8000'
$env:KAMA_ROUTES_FILE = Join-Path $backend ($(if ($SansVoix) { 'config\routes.json' } else { 'config\routes.demo.json' }))

Write-Host "Serveur Kama sur http://127.0.0.1:8000  (routes : $($env:KAMA_ROUTES_FILE))"
Write-Host "Ctrl+C pour arrêter. Le chargement des modèles prend environ une minute."
Set-Location $backend
$ErrorActionPreference = 'Continue'  # le journal du serveur écrit sur stderr : ce n'est pas une erreur
& $python -m app
