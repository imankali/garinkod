# -*- coding: utf-8 -*-
"""Shared placeholder-image helper for the test-data seeds.

Both ``seed_test_catalog`` and ``seed_test_community`` need cover images that
look deliberate (not broken-image icons) without depending on the network or
shipping binary fixtures in git. One small Pillow renderer serves all seeds.
"""

from __future__ import annotations

import io


def make_placeholder_image(slug: str, colour: tuple[int, int, int], shade: int = 0) -> bytes:
    """Render a small branded JPEG placeholder with Pillow (no network).

    Persian text is deliberately *not* drawn: the default bitmap font has no
    Persian glyphs, and shipping a font file for test data is not worth it.
    The ASCII slug keeps every image identifiable in the admin and on disk.
    """
    from PIL import Image, ImageDraw

    width, height = 800, 600
    darken = max(0, min(shade, 2)) * 28
    base = tuple(max(0, c - darken) for c in colour)
    img = Image.new("RGB", (width, height), base)
    draw = ImageDraw.Draw(img)

    # Diagonal stripes for a bit of texture.
    stripe = tuple(max(0, c - 18) for c in base)
    for x in range(-height, width, 56):
        draw.polygon([(x, 0), (x + 26, 0), (x + 26 + height, height), (x + height, height)], fill=stripe)

    # White frame.
    draw.rectangle([14, 14, width - 15, height - 15], outline=(255, 255, 255), width=5)

    # Centered ASCII labels.
    title = "GARINKOOD TEST DATA"
    label = slug[:34]
    sub = f"{width}x{height} PLACEHOLDER"
    for i, text in enumerate((title, label, sub)):
        w = draw.textlength(text)
        draw.text(((width - w) / 2, height / 2 - 30 + i * 34), text, fill=(255, 255, 255))

    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82)
    return buf.getvalue()


# Recognisable colours per test-data area.
TEST_COLOURS = {
    "article": (13, 148, 136),      # teal
    "guide": (101, 163, 13),        # lime
    "team": (99, 102, 241),         # indigo
    "brand": (245, 158, 11),        # amber
    "storefront": (15, 138, 95),    # green
    "desk": (14, 165, 233),         # sky
    "farm": (132, 204, 22),         # lime-light
}
