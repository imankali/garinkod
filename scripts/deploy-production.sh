#!/usr/bin/env bash
# Run the explicit GarinKood production deployment steps.
#
# Dependency installation and build happen here, never in the service's
# runtime start command. Use --start when this command should hand over to
# Gunicorn after the deployment is complete.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/garinkood"
VENV_DIR="${VENV_DIR:-$ROOT_DIR/.venv}"
PYTHON_BIN="${PYTHON_BIN:-$VENV_DIR/bin/python}"
export PYTHON_BIN VENV_DIR
START_AFTER_DEPLOY=0

for argument in "$@"; do
  case "$argument" in
    --start)
      START_AFTER_DEPLOY=1
      ;;
    *)
      echo "Usage: $0 [--start]" >&2
      exit 2
      ;;
  esac
done

"$SCRIPT_DIR/provision-production.sh"

# provision-production.sh creates the default venv unless VENV_DIR/PYTHON_CMD
# were explicitly overridden. The start/deploy scripts use PYTHON_BIN instead.
if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "[GarinKood production] ERROR: Python environment not found at $PYTHON_BIN." >&2
  exit 1
fi

# shellcheck source=production-preflight.sh
source "$SCRIPT_DIR/production-preflight.sh"
# collectstatic is the final deployment mutation, so the runtime-only static
# artifact check is intentionally deferred while this deployment runs.
SKIP_STATIC_CHECK=1 production_preflight

"$PYTHON_BIN" manage.py migrate --noinput
"$PYTHON_BIN" manage.py seed_locations
"$PYTHON_BIN" manage.py seed_agri_inputs
"$PYTHON_BIN" manage.py bootstrap_management_roles
"$PYTHON_BIN" manage.py collectstatic --noinput

echo "[GarinKood production] Database migration, reference data and collectstatic completed."

if (( START_AFTER_DEPLOY )); then
  exec "$SCRIPT_DIR/start-production.sh"
fi

echo "[GarinKood production] Deployment is ready. Start/restart the service with scripts/start-production.sh or systemctl."
