#!/usr/bin/env bash
# Shared production checks. This file is sourced by the deploy/start scripts.

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "Source this file from a production script; do not execute it directly." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/garinkood"
PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
GUNICORN_WORKERS="${GUNICORN_WORKERS:-2}"

production_fail() {
  echo "[GarinKood production] ERROR: $*" >&2
  exit 1
}

production_preflight() {
  [[ -x "$PYTHON_BIN" ]] || production_fail "Python environment not found at $PYTHON_BIN. Provision .venv and install garinkood/requirements-production.txt first."
  [[ -f "$BACKEND_DIR/.env" ]] || production_fail "Missing $BACKEND_DIR/.env. Create a production-only .env; never copy the development template unchanged."
  [[ -f "$ROOT_DIR/frontend/dist/index.html" ]] || production_fail "Frontend build not found. Run npm ci and npm run build in frontend before starting production."
  if [[ "${SKIP_STATIC_CHECK:-0}" != "1" ]]; then
    [[ -f "$BACKEND_DIR/staticfiles/staticfiles.json" ]] || production_fail "Django static files are not collected. Run scripts/deploy-production.sh before starting production."
  fi

  cd "$BACKEND_DIR"
  export DJANGO_SETTINGS_MODULE="garinkood.settings"

  # Read only the already-provisioned Django settings. No network or package
  # installation is performed by this preflight.
  local settings_output
  if ! settings_output="$("$PYTHON_BIN" - <<'PY'
from django.conf import settings

print("1" if settings.DEBUG else "0")
print(getattr(settings, "GARINKOOD_ENV", ""))
print(settings.DATABASES["default"]["ENGINE"])
print(getattr(settings, "CACHE_URL", ""))
print(",".join(settings.ALLOWED_HOSTS))
print(",".join(settings.CORS_ALLOWED_ORIGINS))
print(",".join(settings.CSRF_TRUSTED_ORIGINS))
PY
  )"; then
    production_fail "Django settings could not be loaded. Check the provisioned environment and .env values."
  fi
  mapfile -t APP_SETTINGS <<<"$settings_output"

  [[ "${APP_SETTINGS[0]}" == "0" ]] || production_fail "DEBUG must be False in production."
  [[ "${APP_SETTINGS[1]}" == "production" || "${APP_SETTINGS[1]}" == "prod" ]] || production_fail "Set GARINKOOD_ENV=production in .env."
  [[ "${APP_SETTINGS[2]}" == "django.db.backends.postgresql" ]] || production_fail "Production requires PostgreSQL; set DB_ENGINE=postgresql in .env."
  [[ -n "${APP_SETTINGS[4]}" && "${APP_SETTINGS[4]}" != *"*"* ]] || production_fail "Set an explicit ALLOWED_HOSTS allowlist; wildcard hosts are forbidden."
  [[ -n "${APP_SETTINGS[5]}" && "${APP_SETTINGS[5]}" != *"*"* ]] || production_fail "Set an explicit CORS_ALLOWED_ORIGINS allowlist; wildcard origins are forbidden."
  [[ -n "${APP_SETTINGS[6]}" && "${APP_SETTINGS[6]}" != *"*"* ]] || production_fail "Set an explicit CSRF_TRUSTED_ORIGINS allowlist; wildcard origins are forbidden."

  CACHE_URL="${APP_SETTINGS[3]}"
  if (( GUNICORN_WORKERS > 1 )) && [[ -z "$CACHE_URL" ]]; then
    production_fail "Multiple Gunicorn workers require a shared CACHE_URL (Redis). Set CACHE_URL or use GUNICORN_WORKERS=1."
  fi
  if [[ -n "$CACHE_URL" ]]; then
    "$PYTHON_BIN" -c "import redis" 2>/dev/null || production_fail "CACHE_URL is configured but the Python redis package is missing. Install it during provisioning."
    "$PYTHON_BIN" - <<'PY' >/dev/null 2>&1 || production_fail "The configured shared cache is not reachable. Check Redis and CACHE_URL."
from django.core.cache import cache

key = "garinkood:production-preflight"
cache.set(key, "ok", timeout=10)
if cache.get(key) != "ok":
    raise RuntimeError("cache read-after-write failed")
PY
  fi

  "$PYTHON_BIN" -m pip check
  "$PYTHON_BIN" manage.py check --deploy --fail-level WARNING
}
