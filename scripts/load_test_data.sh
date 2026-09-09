#!/usr/bin/env bash
# Load the full local/QA dataset in one step (dev only, never production).
# Run from the repository root:  ./scripts/load_test_data.sh
set -euo pipefail

cd "$(dirname "$0")/../garinkood"

echo "==> migrate"
python manage.py migrate
echo "==> seed_locations"
python manage.py seed_locations
echo "==> seed_agri_inputs"
python manage.py seed_agri_inputs
echo "==> seed_site_content --with-landing"
python manage.py seed_site_content --with-landing
echo "==> bootstrap_management_roles"
python manage.py bootstrap_management_roles
echo "==> seed_test_catalog (includes demo marketplace)"
python manage.py seed_test_catalog

echo "OK: test data loaded. Run: python manage.py runserver 0.0.0.0:8000"
