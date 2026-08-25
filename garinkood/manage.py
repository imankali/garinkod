#!/usr/bin/env python
"""Django's command-line utility for administrative tasks.

The ``runserver`` command is intentionally self-bootstrapping for local
development: it creates a project virtual environment when needed, installs the
pinned backend requirements and creates the local ``.env`` file before Django
is imported. The matching management command also prepares the database and
starts the Vite frontend.

Set ``GARINKOOD_AUTO_SETUP=0`` to disable this convenience and use the normal
Django management-command behaviour.
"""

from __future__ import annotations

import hashlib
import importlib.util
import os
import subprocess
import sys
import venv as venv_module
from pathlib import Path


MANAGE_DIR = Path(__file__).resolve().parent
REPOSITORY_DIR = MANAGE_DIR.parent
ENV_FILE = MANAGE_DIR / ".env"
ENV_EXAMPLE_FILE = MANAGE_DIR / ".env.example"
REQUIREMENTS_FILE = MANAGE_DIR / "requirements.txt"
REQUIREMENTS_STAMP = REPOSITORY_DIR / ".garinkood-python-requirements.stamp"


def _is_runserver_command() -> bool:
    """Return whether this invocation is the local server shortcut."""

    return len(sys.argv) > 1 and sys.argv[1] == "runserver"


def _auto_setup_enabled() -> bool:
    return os.environ.get("GARINKOOD_AUTO_SETUP", "1").strip().lower() not in {
        "0",
        "false",
        "no",
        "off",
    }


def _ensure_local_env() -> None:
    """Create a safe local environment file without overwriting user config."""

    if ENV_FILE.exists():
        return
    if not ENV_EXAMPLE_FILE.exists():
        raise RuntimeError(f"Missing local environment template: {ENV_EXAMPLE_FILE}")

    ENV_FILE.write_bytes(ENV_EXAMPLE_FILE.read_bytes())
    print(f"[GarinKood] Created {ENV_FILE.name} from .env.example")


def _venv_python(venv_dir: Path) -> Path:
    if os.name == "nt":
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


def _reexecute_in_project_venv(python_path: Path) -> None:
    """Replace this process with the project interpreter.

    Installing packages into the system Python is both unreliable and often
    impossible without administrator privileges. Re-executing keeps all local
    dependencies inside ``.venv`` while preserving the original arguments.
    """

    env = os.environ.copy()
    env["GARINKOOD_BOOTSTRAP_REEXEC"] = "1"
    command = [str(python_path), str(Path(__file__).resolve()), *sys.argv[1:]]
    print(f"[GarinKood] Using project virtual environment: {python_path.parent.parent}")
    os.execve(str(python_path), command, env)


def _ensure_project_venv() -> None:
    """Create/use ``.venv`` when runserver was called from system Python."""

    if sys.version_info < (3, 11):
        raise RuntimeError(
            "GarinKood به Python 3.11 یا بالاتر نیاز دارد. "
            f"نسخهٔ فعلی: {sys.version_info.major}.{sys.version_info.minor}"
        )

    # An already activated environment is respected. This also allows a
    # developer to use a separately managed venv or a CI environment.
    if sys.prefix != sys.base_prefix:
        return

    venv_dir = REPOSITORY_DIR / ".venv"
    python_path = _venv_python(venv_dir)
    if not python_path.exists():
        print(f"[GarinKood] Creating virtual environment: {venv_dir}")
        venv_module.EnvBuilder(with_pip=True, clear=False).create(venv_dir)

    if os.environ.get("GARINKOOD_BOOTSTRAP_REEXEC") != "1":
        _reexecute_in_project_venv(python_path)


def _requirements_digest() -> str:
    return hashlib.sha256(REQUIREMENTS_FILE.read_bytes()).hexdigest()


def _missing_runtime_modules() -> list[str]:
    """Check imports before Django starts, so missing packages can be fixed."""

    modules = {
        "django": "django",
        "rest_framework": "rest_framework",
        "decouple": "decouple",
        "Pillow": "PIL",
        "corsheaders": "corsheaders",
        "django_filters": "django_filters",
        "whitenoise": "whitenoise",
        "psycopg2": "psycopg2",
    }
    return [name for name, module in modules.items() if importlib.util.find_spec(module) is None]


def _ensure_python_requirements() -> None:
    """Install pinned runtime packages only when they are missing or changed."""

    digest = _requirements_digest()
    stamp = REQUIREMENTS_STAMP.read_text(encoding="utf-8").strip() if REQUIREMENTS_STAMP.exists() else ""
    missing = _missing_runtime_modules()
    if not missing and stamp == digest:
        return

    reason = ", ".join(missing) if missing else "requirements.txt changed"
    print(f"[GarinKood] Installing backend dependencies ({reason})")
    subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "-r",
            str(REQUIREMENTS_FILE),
        ],
        check=True,
        cwd=str(MANAGE_DIR),
    )
    REQUIREMENTS_STAMP.write_text(digest + "\n", encoding="utf-8")


def main() -> None:
    """Run administrative tasks, bootstrapping runserver when requested."""

    runserver = _is_runserver_command()
    if runserver:
        # python-decouple searches the current directory. This makes both
        # ``cd garinkood && python manage.py runserver`` and
        # ``python garinkood/manage.py runserver`` work identically.
        os.chdir(MANAGE_DIR)
        if _auto_setup_enabled():
            _ensure_local_env()
            _ensure_project_venv()
            _ensure_python_requirements()

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "garinkood.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Run `python manage.py runserver` to let "
            "GarinKood install the local dependencies, or install "
            "garinkood/requirements.txt manually."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
