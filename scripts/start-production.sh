#!/usr/bin/env bash
# Start the already-deployed GarinKood backend in production.
#
# This is a runtime command for Gunicorn. It deliberately does not install
# packages, create .env files, run migrations, collect static files or seed
# data. Those mutations belong to the explicit deployment step.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=production-preflight.sh
source "$SCRIPT_DIR/production-preflight.sh"

GUNICORN_BIND="${GUNICORN_BIND:-127.0.0.1:8000}"
GUNICORN_THREADS="${GUNICORN_THREADS:-2}"
GUNICORN_TIMEOUT="${GUNICORN_TIMEOUT:-60}"

[[ "$GUNICORN_WORKERS" =~ ^[1-9][0-9]*$ ]] || production_fail "GUNICORN_WORKERS must be a positive integer."
[[ "$GUNICORN_THREADS" =~ ^[1-9][0-9]*$ ]] || production_fail "GUNICORN_THREADS must be a positive integer."
[[ "$GUNICORN_TIMEOUT" =~ ^[1-9][0-9]*$ ]] || production_fail "GUNICORN_TIMEOUT must be a positive integer."

production_preflight

exec "$PYTHON_BIN" -m gunicorn garinkood.wsgi:application \
  --bind "$GUNICORN_BIND" \
  --workers "$GUNICORN_WORKERS" \
  --threads "$GUNICORN_THREADS" \
  --timeout "$GUNICORN_TIMEOUT" \
  --access-logfile - \
  --error-logfile -
