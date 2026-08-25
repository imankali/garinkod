#!/usr/bin/env bash
# Provision Python/Node dependencies and build the frontend for production.
# Run this during deployment, not from a service restart hook.

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/garinkood"
FRONTEND_DIR="$ROOT_DIR/frontend"
PRODUCTION_REQUIREMENTS_FILE="$BACKEND_DIR/requirements-production.txt"
VENV_DIR="${VENV_DIR:-$ROOT_DIR/.venv}"
PYTHON_CMD="${PYTHON_CMD:-python3.11}"

fail() {
  echo "[GarinKood provision] ERROR: $*" >&2
  exit 1
}

[[ -f "$BACKEND_DIR/.env" ]] || fail "Missing $BACKEND_DIR/.env. Create and review the production environment file first."
[[ -f "$PRODUCTION_REQUIREMENTS_FILE" ]] || fail "Missing $PRODUCTION_REQUIREMENTS_FILE."
if ! grep -Eiq '^[[:space:]]*GARINKOOD_ENV[[:space:]]*=[[:space:]]*(production|prod)[[:space:]]*$' "$BACKEND_DIR/.env"; then
  fail "Production .env must contain GARINKOOD_ENV=production."
fi
if grep -Eiq '^[[:space:]]*DEBUG[[:space:]]*=[[:space:]]*(true|1|yes|on)[[:space:]]*$' "$BACKEND_DIR/.env"; then
  fail "DEBUG must be False in the production .env."
fi
if ! grep -Eiq '^[[:space:]]*DB_ENGINE[[:space:]]*=[[:space:]]*postgresql[[:space:]]*$' "$BACKEND_DIR/.env"; then
  fail "Production .env must contain DB_ENGINE=postgresql."
fi
command -v "$PYTHON_CMD" >/dev/null 2>&1 || fail "$PYTHON_CMD not found. Install Python 3.11+ first."
command -v npm >/dev/null 2>&1 || fail "npm not found. Install Node.js 18+ first."

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  echo "[GarinKood provision] Creating $VENV_DIR"
  "$PYTHON_CMD" -m venv "$VENV_DIR"
fi

PYTHON_BIN="$VENV_DIR/bin/python"
"$PYTHON_BIN" -m pip install --upgrade pip
"$PYTHON_BIN" -m pip install -r "$PRODUCTION_REQUIREMENTS_FILE"

cd "$FRONTEND_DIR"
npm ci
npm run build

echo "[GarinKood provision] Dependencies installed and frontend built."
echo "[GarinKood provision] Start the backend with scripts/start-production.sh."
