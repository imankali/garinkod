# frontend counterpart: ImageSrcset in frontend/src/types/shop.ts
"""Shared model mixins for the shop app (domain-split models package)."""

from django.db import models


class ImageVariantsMixin(models.Model):
    """Adds server-generated responsive image variants to any model with an
    ImageField named ``image_source_field`` (default: ``image``).

    Concrete models get:

    - ``image_variants``: JSON dict shaped like the SPA's ``ImageSrcset``
      (``avif``/``webp`` srcset strings plus ``fallback`` URL); empty until a
      real raster image has been processed.
    - change-aware ``save()`` helpers: ``_image_has_changed()`` runs before the
      DB write, ``_refresh_image_variants()`` after it, so the original file is
      locked in storage before variants reference it.
    - ``get_image_srcset()``: the exact payload serializers hand to <picture>.

    AVIF-less Pillow builds degrade to WebP + fallback inside the pipeline;
    variant bookkeeping never raises out of ``save()``.
    """

    image_variants = models.JSONField(
        default=dict, blank=True, editable=False, verbose_name="واریانت‌های بهینه تصویر"
    )

    #: Name of the ImageField the mixin watches; override when a model stores
    #: its primary photo elsewhere.
    image_source_field = "image"

    class Meta:
        abstract = True

    def _image_file(self):
        return getattr(self, self.image_source_field, None)

    @property
    def image_url(self):
        """Fallback URL of the source image; models may override with their
        own placeholder (Product and MarketplaceListing already do)."""
        image = self._image_file()
        return image.url if image else ""

    def _image_has_changed(self) -> bool:
        """True when the DB row's image name differs from the in-memory one —
        run this BEFORE super().save(), because the write stamps the new name."""
        if not self.pk:
            return bool(self._image_file())
        old_name = (
            type(self)
            .objects.filter(pk=self.pk)
            .values_list(self.image_source_field, flat=True)
            .first()
        )
        current = self._image_file().name if self._image_file() else None
        return current != old_name

    def _refresh_image_variants(self) -> None:
        """Defer variant generation to the background outbox (non-blocking).

        The request thread only records intent (OutboxTask.process_image)
        and clears the stale srcset cache so serializers keep answering with
        the original URL until the worker finishes. The worker — the
        `process_async_tasks` management command — re-generates AVIF/WebP,
        re-fills ``image_variants`` and GCs the orphan files carried in the
        task payload. A save() must never take a nine-encode hit again.
        """
        from ..task_queue import enqueue_image_variants

        old_variants = dict(self.image_variants or {})
        image = self._image_file()
        if not image:
            return
        enqueue_image_variants(self, old_variants=old_variants)
        if self.image_variants:
            # Clear NOW: better to serve the original for a few seconds than
            # to point srcset at files that belong to the replaced image.
            type(self).objects.filter(pk=self.pk).update(image_variants={})
            self.image_variants = {}

    def get_image_srcset(self) -> dict:
        """The exact shape the SPA's <picture> blocks consume."""
        variants = dict(self.image_variants or {})
        return {
            "avif": variants.get("avif", ""),
            "webp": variants.get("webp", ""),
            "fallback": self.image_url,
        }
