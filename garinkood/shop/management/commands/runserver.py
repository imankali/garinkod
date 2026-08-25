"""Self-bootstrapping local development server.

This command is intentionally available only with ``DEBUG=True``. Django's
built-in runserver and Vite's development server are not production servers;
production uses the explicit Gunicorn entrypoint under ``scripts/``.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import signal
import subprocess
import time
from pathlib import Path
from typing import Any

from django.conf import settings
from django.contrib.staticfiles.management.commands.runserver import Command as StaticRunserverCommand
from django.core.management import CommandError, call_command


FALSE_VALUES = {"0", "false", "no", "off"}


class Command(StaticRunserverCommand):
    help = "Run Django and automatically prepare the local GarinKood frontend/database."

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            "--no-frontend",
            action="store_true",
            help="Do not install/start the Vite frontend; run only Django.",
        )
        parser.add_argument(
            "--no-demo-data",
            action="store_true",
            help="Do not seed the sample marketplace accounts/listings.",
        )
        parser.add_argument(
            "--frontend-port",
            default=os.environ.get("GARINKOOD_FRONTEND_PORT", "5173"),
            help="Port for the Vite development server (default: 5173).",
        )

    @staticmethod
    def _auto_setup_enabled() -> bool:
        return os.environ.get("GARINKOOD_AUTO_SETUP", "1").strip().lower() not in FALSE_VALUES

    @property
    def repository_dir(self) -> Path:
        return Path(settings.BASE_DIR).parent

    @property
    def frontend_dir(self) -> Path:
        return self.repository_dir / "frontend"

    @staticmethod
    def _file_digest(*files: Path) -> str:
        digest = hashlib.sha256()
        for file in files:
            digest.update(file.read_bytes())
        return digest.hexdigest()

    @staticmethod
    def _npm_command() -> str:
        command = "npm.cmd" if os.name == "nt" else "npm"
        if shutil.which(command) is None or shutil.which("node") is None:
            raise CommandError(
                "Node.js/npm پیدا نشد. ابتدا Node.js 18 یا بالاتر را نصب کنید "
                "و دوباره `python manage.py runserver` را اجرا کنید."
            )

        try:
            node_version = subprocess.run(
                ["node", "--version"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip().lstrip("v")
            npm_version = subprocess.run(
                [command, "--version"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip().lstrip("v")
            node_major = int(node_version.split(".", 1)[0])
            npm_major = int(npm_version.split(".", 1)[0])
        except (OSError, subprocess.CalledProcessError, ValueError, IndexError) as exc:
            raise CommandError("بررسی نسخهٔ Node.js/npm انجام نشد.") from exc

        if node_major < 18 or npm_major < 9:
            raise CommandError(
                "این پروژه به Node.js 18+ و npm 9+ نیاز دارد؛ "
                f"نسخه‌های فعلی Node.js {node_version} و npm {npm_version} هستند."
            )
        return command

    def _ensure_frontend_env(self) -> None:
        env_file = self.frontend_dir / ".env"
        example_file = self.frontend_dir / ".env.example"
        if env_file.exists():
            return
        if not example_file.exists():
            raise CommandError(f"قالب تنظیمات Frontend پیدا نشد: {example_file}")
        env_file.write_bytes(example_file.read_bytes())
        self.stdout.write(self.style.SUCCESS("[GarinKood] فایل frontend/.env ساخته شد."))

    def _ensure_frontend_dependencies(self) -> str:
        if not self.frontend_dir.exists():
            raise CommandError(f"پوشهٔ Frontend پیدا نشد: {self.frontend_dir}")

        npm = self._npm_command()
        package_json = self.frontend_dir / "package.json"
        package_lock = self.frontend_dir / "package-lock.json"
        node_modules = self.frontend_dir / "node_modules"
        stamp_file = self.frontend_dir / ".garinkood-node-deps.stamp"
        expected_digest = self._file_digest(package_json, package_lock)
        current_digest = stamp_file.read_text(encoding="utf-8").strip() if stamp_file.exists() else ""
        vite_dir = node_modules / "vite"

        if not node_modules.exists() or not vite_dir.exists() or current_digest != expected_digest:
            self.stdout.write(self.style.WARNING("[GarinKood] در حال بررسی/نصب وابستگی‌های Frontend با npm ci..."))
            try:
                subprocess.run([npm, "ci"], cwd=str(self.frontend_dir), check=True)
            except OSError as exc:
                raise CommandError(f"اجرای npm ممکن نیست: {exc}") from exc
            stamp_file.write_text(expected_digest + "\n", encoding="utf-8")
        else:
            self.stdout.write("[GarinKood] وابستگی‌های Frontend آماده هستند.")

        return npm

    def _prepare_database(self, seed_demo: bool) -> None:
        self.stdout.write("[GarinKood] در حال بررسی دیتابیس و اجرای migrationها...")
        call_command("migrate", interactive=False, verbosity=0)
        call_command("seed_locations", verbosity=0)
        call_command("seed_agri_inputs", verbosity=0)
        call_command("bootstrap_management_roles", verbosity=0)
        if seed_demo:
            call_command("seed_demo_marketplace", verbosity=0)
        self.stdout.write(self.style.SUCCESS("[GarinKood] دیتابیس و داده‌های مرجع آماده هستند."))

    def _start_frontend(self, npm: str, port: str) -> subprocess.Popen:
        try:
            port_number = int(port)
        except ValueError as exc:
            raise CommandError("مقدار --frontend-port باید یک عدد باشد.") from exc
        if not 1 <= port_number <= 65535:
            raise CommandError("پورت Frontend باید بین 1 و 65535 باشد.")

        command = [
            npm,
            "run",
            "dev",
            "--",
            "--host",
            "0.0.0.0",
            "--port",
            str(port_number),
            "--strictPort",
        ]
        process_options: dict[str, Any] = {
            "cwd": str(self.frontend_dir),
            "env": os.environ.copy(),
        }
        if os.name == "nt":
            process_options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            process_options["start_new_session"] = True

        self.stdout.write(self.style.SUCCESS(f"[GarinKood] اجرای Frontend روی http://localhost:{port_number}"))
        try:
            process = subprocess.Popen(command, **process_options)
        except OSError as exc:
            raise CommandError(f"اجرای Frontend ممکن نیست: {exc}") from exc

        # Catch an immediate npm/Vite failure (for example an occupied port)
        # before starting Django and leaving the user with a half-running stack.
        time.sleep(0.5)
        if process.poll() is not None:
            raise CommandError(
                f"Frontend بلافاصله متوقف شد (کد خروج {process.returncode}). "
                "پورت را بررسی کنید یا با --no-frontend فقط Backend را اجرا کنید."
            )
        return process

    @staticmethod
    def _stop_frontend(process: subprocess.Popen | None) -> None:
        if process is None or process.poll() is not None:
            return

        try:
            if os.name == "nt":
                process.terminate()
            else:
                os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=5)
        except (OSError, subprocess.TimeoutExpired):
            try:
                if os.name == "nt":
                    process.kill()
                else:
                    os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
            except (OSError, subprocess.TimeoutExpired):
                pass

    def handle(self, *args, **options):
        if not settings.DEBUG or settings.GARINKOOD_ENV in {"production", "prod"}:
            raise CommandError(
                "برای محیط Production از Django runserver استفاده نکنید. "
                "DEBUG=False یا GARINKOOD_ENV=production است؛ ابتدا provisioning "
                "را انجام دهید و سپس scripts/start-production.sh را اجرا کنید."
            )

        auto_setup = self._auto_setup_enabled()
        use_reloader = options.get("use_reloader", True)
        reloader_child = os.environ.get("RUN_MAIN") == "true"
        active_server_process = not use_reloader or reloader_child
        frontend_process: subprocess.Popen | None = None
        no_frontend = options.pop("no_frontend", False)
        no_demo_data = options.pop("no_demo_data", False)
        frontend_port = options.pop("frontend_port", "5173")

        try:
            if auto_setup:
                # Start Vite in the reloader parent. Django's reloader child
                # inherits the running frontend process and must not start a
                # second Vite instance on the same port.
                if not no_frontend and not reloader_child:
                    self._ensure_frontend_env()
                    npm = self._ensure_frontend_dependencies()
                    frontend_process = self._start_frontend(
                        npm,
                        str(frontend_port),
                    )

                if active_server_process:
                    self._prepare_database(
                        seed_demo=settings.DEBUG and not no_demo_data,
                    )

            return super().handle(*args, **options)
        finally:
            self._stop_frontend(frontend_process)
