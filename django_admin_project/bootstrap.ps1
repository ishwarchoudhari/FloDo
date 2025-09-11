# bootstrap.ps1
# One-command setup for the Django Admin Dashboard Project on Windows (PowerShell)
# - Creates a virtual environment
# - Installs dependencies
# - Applies migrations
# - Collects static files
# - Starts the development server

param(
    [string]$PyExe = "python",
    [string]$Host = "127.0.0.1",
    [int]$Port = 8000
)

# Stop on first error
$ErrorActionPreference = 'Stop'

Write-Host "[1/5] Creating virtual environment (.venv) ..." -ForegroundColor Cyan
if (!(Test-Path .venv)) {
    & $PyExe -m venv .venv
}

# Activate venv for this session
$venvPath = Join-Path (Get-Location) ".venv"
$activate = Join-Path $venvPath "Scripts/Activate.ps1"
. $activate

Write-Host "[2/5] Installing dependencies ..." -ForegroundColor Cyan
pip install --upgrade pip
pip install -r requirements.txt

Write-Host "[3/5] Applying migrations ..." -ForegroundColor Cyan
$env:DJANGO_SETTINGS_MODULE = "django_admin_project.settings"
python manage.py makemigrations apps.authentication apps.dashboard apps.settings_app
python manage.py migrate --noinput

Write-Host "[4/5] Collecting static files ..." -ForegroundColor Cyan
python manage.py collectstatic --noinput

Write-Host "\nSetup complete. Next steps:" -ForegroundColor Green
Write-Host " - Visit http://$Host:$Port/signup/ to create the single super-admin account."
Write-Host " - Then access the dashboard at http://$Host:$Port/dashboard/"

Write-Host "[5/5] Starting development server at http://$Host:$Port ..." -ForegroundColor Cyan
python manage.py runserver "$Host:$Port"
