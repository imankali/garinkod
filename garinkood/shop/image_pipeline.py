"""Server-side responsive image variants for the shop's visual assets.

The frontend renders every product image through <picture> with AVIF and WebP
sources, so somebody has to actually *produce* those files. Doing it here — at
upload time, next to the model — means the API response can hand the SPA real
``srcset`` strings instead of making the browser negotiate formats it cannot.

Design notes:
- The original file is never overwritten; variants live beside it under a
  ``resized/`` child of the upload directory.
- Naming is deterministic: ``<stem>-<width>.<fmt>``. Stems come from the
  storage name Django already de-duplicated on upload, so variants cannot
  collide across products sharing a source filename.
- AVIF is optional by design: some production builds of Pillow ship without
  libavif. A failed AVIF encode logs a warning and simply omits AVIF from the
  result — the save that triggered it still succeeds with WebP + fallback.
"""

import io
import logging
import posixpath
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

TARGET_WIDTHS = (480, 768, 1024)
QUALITY = {"avif": 80, "webp": 85}
RESIZED_SUBDIR = "resized"


def _variant_dir(source_name: str) -> str:
    """``products/slug.jpg`` → ``products/resized``."""
    parent = posixpath.dirname(source_name)
    return posixpath.join(parent, RESIZED_SUBDIR) if parent else RESIZED_SUBDIR


def generate_image_variants(source_file, source_name: str) -> dict:
    """Create width-scaled AVIF/WebP copies of ``source_file``.

    Returns a dict shaped exactly like the ``srcset`` object the SPA consumes::

        {
          "avif": "/media/…-480.avif 480w, /media/…-768.avif 768w, …",
          "webp": "/media/…-480.webp 480w, /media/…-768.webp 768w, …",
          "fallback": "/media/products/slug.jpg",
          "widths": [480, 768, 1024],
          "formats": ["avif", "webp"],
        }

    Missing encoders (notably AVIF on minimal Pillow builds) narrow
    ``formats``; they never raise out of a model ``save()``.
    """
    from PIL import Image  # local import: settings import this module's users

    result = {"avif": "", "webp": "", "fallback": "", "widths": [], "formats": []}
    try:
        source_file.open("rb")
        img = Image.open(source_file)
        img.load()
    except Exception:
        logger.warning("image_pipeline: unreadable source %s", source_name, exc_info=True)
        return result

    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    stem = Path(source_name).stem
    out_dir = _variant_dir(source_name)
    produced = {"avif": [], "webp": []}

    for width in TARGET_WIDTHS:
        if img.width <= width and produced["webp"]:
            # Only downscale: a source smaller than this step adds nothing new
            # beyond the variant we already emitted for the closest width.
            continue
        scale = min(1.0, width / img.width)
        resized = img if scale == 1.0 else img.resize(
            (max(1, round(img.width * scale)), max(1, round(img.height * scale))),
            Image.LANCZOS,
        )
        for fmt, bucket in (("avif", produced["avif"]), ("webp", produced["webp"])):
            buf = io.BytesIO()
            try:
                resized.save(buf, fmt.upper(), quality=QUALITY[fmt])
            except Exception:
                logger.warning("image_pipeline: %s encoding unavailable, skipped", fmt.upper())
                break  # no point retrying this format at other widths
            variant_name = posixpath.join(out_dir, f"{stem}-{width}.{fmt}")
            stored_name = default_storage.save(variant_name, ContentFile(buf.getvalue()))
            bucket.append((width, default_storage.url(stored_name)))

    for fmt in ("avif", "webp"):
        if produced[fmt]:
            result[fmt] = ", ".join(f"{url} {w}w" for w, url in produced[fmt])
            result["formats"].append(fmt)
    result["widths"] = sorted({w for bucket in produced.values() for w, _ in bucket})
    return result


def delete_image_variants(variants: dict) -> None:
    """Remove files recorded in a variants dict (best effort, never raises)."""
    if not variants:
        return
    for fmt in ("avif", "webp"):
        srcset = variants.get(fmt) or ""
        for chunk in srcset.split(","):
            url = chunk.strip().split(" ", 1)[0]
            if not url:
                continue
            # storage backends key off the path relative to MEDIA_URL.
            name = url.split("/media/", 1)[-1]
            try:
                if default_storage.exists(name):
                    default_storage.delete(name)
            except Exception:
                logger.warning("image_pipeline: could not delete %s", name, exc_info=True)
