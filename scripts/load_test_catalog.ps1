# Load the full test catalogue on a fresh laptop checkout (Windows PowerShell).
#
# Usage (from the repository root):
#   .\scripts\load_test_catalog.ps1
#
# Prerequisites: Python 3.11+ with the backend requirements installed:
#   cd garinkood; pip install -r requirements-dev.txt; Copy-Item .env.example .env
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location (Join-Path $Root "garinkood")

if (-not (Test-Path ".env")) {
  Write-Host "→ .env not found, copying from .env.example (SQLite dev defaults)"
  Copy-Item .env.example .env
}

if (-not $env:DB_ENGINE) { $env:DB_ENGINE = "sqlite" }
if (-not $env:DEBUG) { $env:DEBUG = "True" }

Write-Host "→ migrate"
python manage.py migrate

Write-Host "→ seed locations / agri inputs / site content"
python manage.py seed_locations
python manage.py seed_agri_inputs
try {
  python manage.py seed_site_content --with-landing
} catch {
  python manage.py seed_site_content
}

Write-Host "→ seed legal pages / FAQ / management roles"
python manage.py seed_legal_pages
python manage.py seed_faq_page
python manage.py bootstrap_management_roles

Write-Host "→ seed demo marketplace (storefronts + listings)"
python manage.py seed_demo_marketplace

Write-Host "→ seed test catalogue (all shop sections)"
python manage.py seed_test_catalog

Write-Host "→ seed test community (articles, desk, farm, orders)"
python manage.py seed_test_community

Write-Host "→ build responsive image variants"
try {
  python manage.py process_async_tasks --limit 200
} catch {
  Write-Host "(image worker skipped: $_)"
}

Write-Host ""
Write-Host "✅ Test data ready."
Write-Host "   Backend:  python manage.py runserver 0.0.0.0:8000  → http://localhost:8000/api/products/"
Write-Host "   Frontend: cd ../frontend; npm ci; npm run dev -- --host 0.0.0.0"
Write-Host "   Shop:     http://localhost:5173/products"
