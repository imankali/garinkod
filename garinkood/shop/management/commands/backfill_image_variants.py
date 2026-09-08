"""Backfill responsive image variants for images that predate the pipeline.

    python manage.py backfill_image_variants --dry-run
    python manage.py backfill_image_variants --model listing
    python manage.py backfill_image_variants --model gallery --force

Design contract:
- Idempotent by default: rows that already carry variants are skipped unless
  ``--force`` is given (rebuild every image from scratch).
- Never crashes on a single bad file: per-row failures are logged as warnings
  and processing continues; the summary always reports all three counters.
- ``--dry-run`` changes nothing on disk or in the database; it reports what a
  real run *would* do and raises the known "double media directory" advisory
  so operators can plan that cleanup separately.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

import shutil

from ...models import MarketplaceListing, Product, ProductImage

MODEL_TARGETS = {
    "product": Product,
    "listing": MarketplaceListing,
    "gallery": ProductImage,
}


class Command(BaseCommand):
    help = (
        "Generate AVIF/WebP srcset variants for existing images. "
        "Targets: product (default), listing, gallery."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--model",
            choices=sorted(MODEL_TARGETS.keys()),
            default="product",
            help="Which model's images to process (default: product).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate: count and report only; touch neither files nor DB.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Rebuild variants even for rows that already have them.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Process at most N rows (0 = no limit); handy for canary runs.",
        )

    def _warn_double_directory(self, model, qs):
        """Advisory — never blocks the run.

        MEDIA_ROOT is ``<project>/products`` and some upload_to paths start
        with ``products/`` again (e.g. upload_to='products/'), so files land in
        ``products/products/…``. Harmless but worth flagging for a future
        cleanup, as requested in the earlier audit.
        """
        media_tail = str(settings.MEDIA_ROOT).rstrip("/").rsplit("/", 1)[-1]
        probe = qs.exclude(**{"image__exact": b""}).values_list("image", flat=True).first()
        if probe and media_tail and probe.startswith(f"{media_tail}/"):
            self.stdout.write(
                self.style.NOTICE(
                    f"⚠️  هشدار تمیزکاری آینده: مسیر دوتایی «{media_tail}/{media_tail}/…» "
                    f"برای مدل {model.__name__} دیده می‌شود (MEDIA_ROOT={media_tail} + "
                    "upload_to هم‌نام). ادغام این دو سطح به مهاجرت فایل‌ها و URLها نیاز "
                    "دارد و عمداً در این فرمان انجام نمی‌شود."
                )
            )

    #: A backfill writes MANY media files; refusing to start without headroom
    #: is cheaper than discovering a full disk half-way through 10k encodes.
    MIN_FREE_BYTES = 500 * 1024 * 1024  # ۵۰۰ مگابایت

    def handle(self, *args, model, dry_run, force, limit, **options):
        # ── disk-headroom gate BEFORE any processing, DB touch or encode ──
        free_bytes = shutil.disk_usage(settings.MEDIA_ROOT).free
        if free_bytes < self.MIN_FREE_BYTES:
            raise CommandError(
                f'فضای دیسک ناکافی: {free_bytes // (1024 * 1024)} MB موجود، '
                'حداقل ۵۰۰ MB لازم است'
            )

        target = MODEL_TARGETS[model]
        qs = target.objects.exclude(image__isnull=True).exclude(image__exact="").order_by("pk")
        if limit:
            qs = qs[:limit]
        rows = list(qs)

        self._warn_double_directory(target, target.objects.all())

        total = len(rows)
        self.stdout.write(
            f"مدل هدف: {target.__name__} | ردیف‌های دارای تصویر: {total}"
            + (" | حالت شبیه‌سازی (بدون تغییر)" if dry_run else "")
            + (" | بازسازی اجباری" if force else "")
        )

        done = skipped = failed = 0
        for row in rows:
            if not force and row.image_variants and row.image_variants.get("webp"):
                skipped += 1
                continue
            if dry_run:
                done += 1
                continue
            try:
                row._refresh_image_variants()
                formats = row.image_variants.get("formats", [])
                done += 1
            except Exception as exc:  # keep going: one bad file must not stop the batch
                failed += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"خطا در پردازش {target.__name__} #{row.pk} "
                        f"({getattr(row.image, 'name', '?')}): {exc}"
                    )
                )

        summary_style = self.style.SUCCESS if failed == 0 else self.style.WARNING
        self.stdout.write(
            summary_style(
                f"— پایان — کل: {total} | پردازش‌شده: {done} | "
                f"رد شده (دارای واریانت): {skipped} | خطا: {failed}"
            )
        )
        if dry_run and done:
            self.stdout.write(
                self.style.NOTICE("برای اجرای واقعی همین دستور را بدون --dry-run تکرار کنید.")
            )
        if failed:
            raise CommandError(f"{failed} ردیف با خطا مواجه شد (به هشدارهای بالا نگاه کنید).")
