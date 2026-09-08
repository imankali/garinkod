"""Normalize on-disk media layout onto settings.MEDIA_ROOT — safely, and
idempotently.

Historical context
------------------
``MEDIA_ROOT`` used to be ``BASE_DIR / "products"``. Combined with
``upload_to="products/"`` that physically stored files at
``garinkood/products/products/…`` (the "double directory" anomaly). The
storage root has since been renamed to a neutral ``media/`` directory; this
command physically relocates every file that still lives under the legacy
root, keeping the *relative storage name* of every field — and therefore
every URL — byte-identical.

Per-record safety contract (the user's checklist, implemented literally):

1. Detect whether the record's file actually resides under the legacy root
   (the anomaly pattern), not just assume it.
2. Skip (with a WARNING) records whose source file no longer exists on disk.
3. Never overwrite: if the destination file already exists, the pair is
   reported as a conflict and left untouched.
4. ``shutil.move`` the file (same filesystem → atomic rename; cross-device →
   copy2 + unlink), then prune now-empty parents.
5. Update the DB field **iff the name itself needed normalization** (any
   duplicated first segment inside the stored name). For the canonical
   legacy-root anomaly the name is already correct, so the update is a
   no-op by construction — URLs, srcset JSON and fallbacks cannot break.
6. ``shutil.move`` removes the source itself; the final orphan sweep reports
   whatever remains under the legacy root for a manual cleanup pass.

Variants: ``image_variants`` JSON stores public URLs; URLs are translated
back to storage-relative names by stripping ``MEDIA_URL``. A disk-side glob
of ``<dir>/resized/<stem>-*.`` catches anything the JSON missed.

Failure policy: a failing record never aborts the run — it is logged as
WARNING (self.style.WARNING) and the loop continues with the next record.
Exit code is non-zero when ``failed > 0``.

Usage:
    python manage.py normalize_media_paths              # dry-run (default)
    python manage.py normalize_media_paths --execute    # actually move
    python manage.py normalize_media_paths --model product --execute
"""

from __future__ import annotations

import shutil
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import models as dj_models

MODEL_FILTERS = {
    "product": ("shop", "Product"),
    "listing": ("shop", "MarketplaceListing"),
    "gallery": ("shop", "ProductImage"),
}


class Command(BaseCommand):
    help = (
        "Move media files out of the legacy storage root (the products/products/ "
        "anomaly) into settings.MEDIA_ROOT, with dry-run by default."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=True,
            help="Only report what would move (default).",
        )
        parser.add_argument(
            "--execute",
            action="store_true",
            help="Actually move files and apply any needed DB updates.",
        )
        parser.add_argument(
            "--model",
            choices=[*MODEL_FILTERS, "all"],
            default="all",
            help="Restrict the sweep to one model (product | listing | gallery).",
        )
        parser.add_argument(
            "--legacy-root",
            default=getattr(settings, "LEGACY_MEDIA_ROOT", None) or "",
            help="Override the legacy storage root (default: settings.LEGACY_MEDIA_ROOT).",
        )

    # ------------------------------------------------------------------ utils

    def _file_fields(self, filter_key: str):
        """Yield (model, field) pairs for every concrete FileField in the
        project, optionally narrowed by --model."""
        if filter_key == "all":
            for model in apps.get_models():
                for field in model._meta.get_fields():
                    if isinstance(field, dj_models.FileField):
                        yield model, field
            return
        app_label, model_name = MODEL_FILTERS[filter_key]
        model = apps.get_model(app_label, model_name)
        source = getattr(model, "image_source_field", "image")
        for field in model._meta.get_fields():
            if isinstance(field, dj_models.FileField) and (field.name == source or filter_key):
                yield model, field

    @staticmethod
    def _strip_media_url(url: str) -> str:
        """'/media/products/resized/x-480.avif' → 'products/resized/x-480.avif'."""
        prefix = settings.MEDIA_URL.rstrip("/") + "/"
        if url.startswith(prefix):
            return url[len(prefix):]
        return url.lstrip("/")

    def _variant_names(self, instance) -> list[str]:
        """Storage-relative names of every generated variant of this record's
        image, taken from the image_variants JSON (URLs stripped to names)."""
        names: list[str] = []
        variants = getattr(instance, "image_variants", None) or {}
        for bucket in variants.values():
            if not isinstance(bucket, str):
                continue
            for candidate in bucket.split(","):
                url = candidate.strip().split(" ")[0]
                if url:
                    names.append(self._strip_media_url(url))
        return names

    @staticmethod
    def _normalize_name(name: str) -> str:
        """Strip an immediately-duplicated first segment ('products/products/x'
        → 'products/x') in case a *stored name* itself carries the anomaly."""
        parts = [part for part in name.replace("\\", "/").split("/") if part]
        while len(parts) > 1 and parts[0] == parts[1]:
            parts.pop(0)
        return "/".join(parts)

    def _glob_variants_fallback(self, legacy_root: Path, name: str) -> list[str]:
        """Disk-side catch-all: '<dir>/resized/<stem>-*.*' under the legacy root."""
        rel_dir = Path(name).parent
        stem = Path(name).stem
        resized_dir = legacy_root / rel_dir / "resized"
        if not resized_dir.is_dir():
            return []
        return [
            str(rel_dir / "resized" / hit.name)
            for hit in sorted(resized_dir.glob(f"{stem}-*.*"))
        ]

    # ------------------------------------------------------------------ main

    def handle(self, *args, **options):
        execute = options["execute"]
        mode = "EXECUTE" if execute else "DRY-RUN"

        media_root = Path(settings.MEDIA_ROOT).resolve()
        legacy_root = Path(options["legacy_root"]).resolve() if options["legacy_root"] else None

        # --- configuration guards --------------------------------------
        if not legacy_root:
            raise CommandError(
                "settings.LEGACY_MEDIA_ROOT تعریف نشده است؛ در settings.py کنار "
                "MEDIA_ROOT مقدار آن را بگذارید یا با --legacy-root پاس کنید."
            )
        if legacy_root == media_root:
            raise CommandError(
                "MEDIA_ROOT با ریشه‌ی قدیمی یکی است؛ ابتدا MEDIA_ROOT را به مسیر "
                "جدید (مثلاً BASE_DIR / 'media') تغییر بدهید و دوباره اجرا کنید."
            )
        if not legacy_root.exists():
            self.stdout.write(
                self.style.SUCCESS(f"ریشه‌ی قدیمی ({legacy_root}) اصلاً وجود ندارد؛ چیزی برای مهاجرت نیست.")
            )

        self._tracked: set[str] = set()
        stats = {
            "scanned": 0,
            "moved": 0,
            "already": 0,   # destination already in place (idempotent re-run)
            "empty": 0,     # field has no file
            "missing": 0,   # DB points to a file that exists nowhere
            "conflict": 0,  # source AND destination both exist → untouched
            "db_updates": 0,
            "failed": 0,
        }

        self.stdout.write(
            f"حالت: {mode} | legacy: {legacy_root} | مقصد: {media_root} | مدل: {options['model']}"
        )

        for model, field in self._file_fields(options["model"]):
            qs = model._default_manager.all().exclude(**{f"{field.name}__exact": ""})
            for instance in qs.iterator():
                stats["scanned"] += 1
                label = f"{model._meta.label}#{instance.pk}"
                # Per-record error isolation: one bad record never stops the run.
                try:
                    self._process_record(instance, model, field, label, stats, legacy_root, media_root, execute)
                except Exception as exc:  # noqa: BLE001 — audit-first command; keep going
                    stats["failed"] += 1
                    self.stdout.write(self.style.WARNING(f"  [⚠] {label}: خطای غیرمنتظره — {exc!r}"))

        self._finalize(stats, legacy_root, execute)

    def _process_record(self, instance, model, field, label, stats, legacy_root, media_root, execute):
                try:
                    name = getattr(instance, field.name).name or ""
                except (ValueError, OSError):
                    name = ""
                if not name:
                    stats["empty"] += 1
                    return

                new_name = self._normalize_name(name)
                names = [new_name] + self._variant_names(instance)
                names += [n for n in self._glob_variants_fallback(legacy_root, new_name) if n not in names]

                if not execute:
                    under_legacy = [n for n in names if (legacy_root / n).is_file()]
                    if under_legacy:
                        self.stdout.write(
                            f"  [DRY] {label}: {len(under_legacy)} فایل جابه‌جا می‌شود "
                            f"(مثل {under_legacy[0]})"
                            + (f" | به‌روزرسانی نام DB: {name} → {new_name}" if new_name != name else "")
                        )

                record_moved = 0
                for relative in dict.fromkeys(names):  # de-dupe, keep order
                    self._tracked.add(relative)
                    source = legacy_root / relative
                    destination = media_root / relative

                    if destination.is_file() and not source.is_file():
                        stats["already"] += 1  # previously migrated; idempotent
                        continue
                    if not source.is_file() and not destination.is_file():
                        stats["missing"] += 1
                        self.stdout.write(
                            self.style.WARNING(f"  [⚠] {label}: فایل در هیچ‌یک از دو ریشه نیست: {relative}")
                        )
                        continue
                    if source.is_file() and destination.is_file():
                        stats["conflict"] += 1
                        self.stdout.write(
                            self.style.WARNING(
                                f"  [⚠] {label}: مقصد از قبل موجود است؛ بازنویسی نمی‌کنم: {relative}"
                            )
                        )
                        continue
                    if execute:
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(source), str(destination))
                        # Prune the now-empty parent chain upwards; rmdir only
                        # succeeds on genuinely empty dirs, so this stops
                        # exactly where leftover content begins (never above
                        # legacy_root).
                        current = legacy_root / Path(relative).parent
                        while current != legacy_root and current.is_dir():
                            try:
                                current.rmdir()
                            except OSError:
                                break
                            current = current.parent
                    record_moved += 1

                stats["moved"] += record_moved

                # Step 5 — DB update ONLY when the stored name itself was
                # anomalous. Canonical legacy-root records keep their name.
                if execute and new_name != name:
                    model._default_manager.filter(pk=instance.pk).update(**{field.name: new_name})
                    stats["db_updates"] += 1
                    self.stdout.write(f"  [DB] {label}: نام فیلد اصلاح شد: {name} → {new_name}")

    def _finalize(self, stats, legacy_root, execute):
        # --- step 6: orphan sweep of the legacy root -------------------------
        orphans: list[str] = []
        if legacy_root.exists():
            for orphan in sorted(legacy_root.rglob("*")):
                if orphan.is_file():
                    relative = str(orphan.relative_to(legacy_root))
                    if relative not in self._tracked:
                        orphans.append(relative)

        if orphans:
            self.stdout.write(
                self.style.WARNING(
                    f"\n{len(orphans)} فایل یتیم (ارجاع دیتابیسی ندارند) در ریشه‌ی قدیمی ماند؛ "
                    "پاکسازی دستی لازم است:"
                )
            )
            for orphan in orphans[:15]:
                self.stdout.write(f"  - {orphan}")
        elif execute and legacy_root.exists():
            # Any directories that survived per-file pruning are empty by now;
            # collapse them bottom-up, then remove the legacy root itself.
            for child_dir in sorted(
                (p for p in legacy_root.rglob("*") if p.is_dir()),
                key=lambda p: -len(p.parts),
            ):
                try:
                    child_dir.rmdir()
                except OSError:
                    pass
            try:
                legacy_root.rmdir()
                self.stdout.write(self.style.SUCCESS(f"ریشه‌ی قدیمی خالی شد و حذف گردید: {legacy_root}"))
            except OSError:
                pass

        # --- summary ----------------------------------------------------------
        self.stdout.write(
            "\n— خلاصه —\n"
            f"  رکوردهای بررسی‌شده : {stats['scanned']}\n"
            f"  فایل جابه‌جاشده    : {stats['moved']}" + (" (پیش‌نمایش)" if not execute else "") + "\n"
            f"  از قبل نرمال       : {stats['already']}\n"
            f"  فیلد خالی          : {stats['empty']}\n"
            f"  فایل گمشده         : {stats['missing']}\n"
            f"  تداخل (دست‌نخورده) : {stats['conflict']}\n"
            f"  به‌روزرسانی DB     : {stats['db_updates']}\n"
            f"  خطا                : {stats['failed']}"
        )
        if not execute:
            self.stdout.write(
                self.style.NOTICE("\nفقط پیش‌نمایش بود. برای اجرای واقعی: --execute")
            )
        elif stats["missing"] or stats["conflict"] or stats["failed"]:
            raise CommandError(
                "نرمال‌سازی کامل نشد؛ موارد ⚠ بالا را بررسی کنید و دوباره اجرا کنید (فرمان idempotent است)."
            )
        else:
            self.stdout.write(self.style.SUCCESS("نرمال‌سازی مسیرها کامل شد؛ ساختار حالا media/ استاندارد است."))
