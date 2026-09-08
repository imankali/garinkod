"""Regression tests for the products/products/ double-directory anomaly.

Two guards are locked in here:

1. ``shop.checks.media_layout_check`` must stay silent with the normalized
   layout (``MEDIA_ROOT`` = ``media``) and must warn the moment anyone points
   ``MEDIA_ROOT`` back at a domain-named directory like ``products``.
2. ``normalize_media_paths`` moves legacy-root files into ``MEDIA_ROOT``
   keeping storage names — and therefore URLs — byte-identical, refuses to
   overwrite existing destinations, and is idempotent on re-run.
"""

from __future__ import annotations

import shutil
import tempfile
from io import BytesIO, StringIO
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase, override_settings

from shop.checks import media_layout_check
from shop.models import Product


class MediaLayoutCheckTests(SimpleTestCase):
    """The sentinel never fires on the healthy layout, always fires on the
    anomalous one."""

    def test_clean_layout_passes_silently(self):
        self.assertEqual(media_layout_check(app_configs=None), [])

    def test_domain_named_root_is_flagged(self):
        with override_settings(MEDIA_ROOT=Path(tempfile.gettempdir()) / "products"):
            warnings = media_layout_check(app_configs=None)
        self.assertEqual(len(warnings), 1)
        self.assertEqual(warnings[0].id, "shop.W200")
        self.assertIn("shop.Product.image", warnings[0].msg)


@override_settings(DEBUG=True)
class NormalizeMediaPathsTests(TestCase):
    """End-to-end safety contract of the migration command on a scratch
    storage pair that mimics the incident exactly."""

    def setUp(self):
        self.scratch = Path(tempfile.mkdtemp(prefix="media-norm-"))
        self.legacy = self.scratch / "products"
        self.fresh = self.scratch / "media"
        self.addCleanup(shutil.rmtree, self.scratch, True)

        self.settings_ctx = override_settings(
            MEDIA_ROOT=self.fresh, LEGACY_MEDIA_ROOT=self.legacy
        )
        self.settings_ctx.enable()
        self.addCleanup(self.settings_ctx.disable)

        # Upload THROUGH the legacy root, exactly like production did.
        from django.contrib.auth import get_user_model

        author = get_user_model().objects.create_user(username="media-norm-author")
        with override_settings(MEDIA_ROOT=self.legacy):
            buf = BytesIO()
            from PIL import Image

            Image.new("RGB", (32, 24), (10, 90, 40)).save(buf, "JPEG")
            self.product = Product(
                title="تست نرمال‌سازی", slug="media-norm-test", price=1000, author=author
            )
            self.product.image.save("sample.jpg", ContentFile(buf.getvalue()), save=True)
            self.original_name = self.product.image.name
            self.original_srcset = self.product.get_image_srcset()

        assert (self.legacy / self.original_name).is_file(), "fixture must start in the anomaly"

    def _run(self, **options):
        kwargs = {
            "model": "all",
            "legacy_root": str(self.legacy),
            "stdout": StringIO(),
            "stderr": StringIO(),
        }
        kwargs.update(options)
        call_command("normalize_media_paths", **kwargs)

    def test_dry_run_moves_nothing(self):
        self._run()
        self.assertTrue((self.legacy / self.original_name).exists())
        self.assertFalse((self.fresh / self.original_name).exists())

    def test_execute_moves_files_without_touching_names(self):
        self._run(execute=True)

        self.product.refresh_from_db()
        self.assertEqual(self.product.image.name, self.original_name)  # zero DB harm
        self.assertTrue((self.fresh / self.original_name).is_file())
        self.assertFalse((self.legacy / self.original_name).exists())
        self.assertEqual(self.product.get_image_srcset(), self.original_srcset)  # URLs byte-identical

    def test_execute_is_idempotent(self):
        self._run(execute=True)
        self._run(execute=True)  # second pass: everything reported "already"
        self.assertTrue((self.fresh / self.original_name).is_file())

    def test_execute_never_overwrites_destination(self):
        self.fresh.mkdir(parents=True)
        destination = self.fresh / self.original_name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"pre-existing-content")

        with self.assertRaises(CommandError):  # conflict is an operator-stopper
            self._run(execute=True)
        self.assertEqual(destination.read_bytes(), b"pre-existing-content")
        self.assertTrue((self.legacy / self.original_name).is_file())  # source untouched

    def test_refuses_when_roots_are_identical(self):
        # legacy_root == MEDIA_ROOT (self.fresh here) must abort immediately.
        with self.assertRaises(CommandError):
            self._run(execute=True, legacy_root=str(self.fresh))
