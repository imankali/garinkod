#!/usr/bin/env bash
# Load the full test catalogue on a fresh laptop checkout (Linux/macOS/WSL).
#
# Usage (from the repository root):
#   ./scripts/load_test_catalog.sh
#
# What it does:
#   1. applies Django migrations (SQLite dev database)
#   2. seeds locations, agri-input doses, site content and demo marketplace
#   3. seeds the 31-product test catalogue (every shop section)
#   4. runs the background worker once to build AVIF/WebP image variants
#
# Prerequisites: Python 3.11+ with the backend requirements installed:
#   cd garinkood && pip install -r requirements-dev.txt && cp -n .env.example .env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/garinkood"

if [ ! -f ".env" ]; then
  echo "→ .env not found, copying from .env.example (SQLite dev defaults)"
  cp .env.example .env
fi

# Respect an explicit choice in .env (e.g. postgresql on a laptop with an
# existing database): shell env wins, then .env, then these dev defaults.
if [ -z "${DB_ENGINE:-}" ] && ! grep -Eq "^DB_ENGINE=.+" .env 2>/dev/null; then
  export DB_ENGINE="sqlite"
fi
if [ -z "${DEBUG:-}" ] && ! grep -Eq "^DEBUG=.+" .env 2>/dev/null; then
  export DEBUG="True"
fi

echo "→ migrate"
python manage.py migrate

echo "→ seed locations / agri inputs / site content"
python manage.py seed_locations
python manage.py seed_agri_inputs
python manage.py seed_site_content --with-landing || python manage.py seed_site_content

echo "→ seed legal pages / FAQ / management roles"
python manage.py seed_legal_pages
python manage.py seed_faq_page
python manage.py bootstrap_management_roles

echo "→ seed demo marketplace (storefronts + listings)"
python manage.py seed_demo_marketplace

echo "→ seed test catalogue (all shop sections)"
python manage.py seed_test_catalog

echo "→ seed test community (articles, desk, farm, orders)"
python manage.py seed_test_community

echo "→ build responsive image variants"
python manage.py process_async_tasks --limit 200 || true

echo ""
echo "✅ Test data ready."
echo "   Backend:  python manage.py runserver 0.0.0.0:8000  → http://localhost:8000/api/products/"
echo "   Frontend: cd ../frontend && npm ci && npm run dev -- --host 0.0.0.0"
echo "   Shop:     http://localhost:5173/products"
