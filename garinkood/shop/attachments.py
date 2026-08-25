"""Validation for chat attachments (voice notes, photos and short clips).

Uploads are the highest-risk input the messaging feature accepts, so the rules
live in one place rather than being re-derived at each call site:

* the declared content type must be on an explicit allow-list — never inferred
  from the filename, which the client controls;
* images are additionally decoded by Pillow, because a permissive
  ``Content-Type`` header is trivially forged and a file that is not actually
  an image should not reach storage;
* the size ceiling is per kind, since a 25 MB budget that makes sense for a
  video would be absurd for an avatar-sized photo.
"""

from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError

# Extensions that must never be stored regardless of the declared MIME type.
# A file called `x.php` served back from the media root is a remote-code-
# execution vector on a misconfigured server; refusing it here is cheap.
FORBIDDEN_EXTENSIONS = {
    '.php', '.phtml', '.phar', '.py', '.pl', '.rb', '.sh', '.bash', '.exe',
    '.dll', '.so', '.jar', '.js', '.mjs', '.html', '.htm', '.svg', '.xhtml',
}

MEGABYTE = 1024 * 1024


def _kind_for_content_type(content_type: str) -> str | None:
    """Map a declared MIME type onto one of our three attachment kinds."""
    for kind, allowed in settings.MESSAGE_ATTACHMENT_CONTENT_TYPES.items():
        if content_type in allowed:
            return kind
    return None


def validate_message_attachment(upload) -> str:
    """Check one uploaded attachment and return its kind.

    Returns ``'image'``, ``'audio'`` or ``'video'``. Raises ``ValidationError``
    with a user-facing Persian message when the file is not acceptable.
    """
    if upload is None:
        raise ValidationError('فایلی برای ارسال انتخاب نشده است.')

    name = (getattr(upload, 'name', '') or '').lower()
    for extension in FORBIDDEN_EXTENSIONS:
        if name.endswith(extension):
            raise ValidationError('این نوع فایل مجاز نیست.')

    # Strip any parameters, e.g. "audio/webm;codecs=opus".
    content_type = (getattr(upload, 'content_type', '') or '').split(';')[0].strip().lower()
    kind = _kind_for_content_type(content_type)
    if kind is None:
        raise ValidationError('فقط تصویر، ویدیو یا فایل صوتی می‌توانید بفرستید.')

    max_bytes = settings.MESSAGE_ATTACHMENT_MAX_BYTES[kind]
    if upload.size > max_bytes:
        raise ValidationError(
            f'حجم فایل باید کمتر از {max_bytes // MEGABYTE} مگابایت باشد.'
        )
    if upload.size == 0:
        raise ValidationError('فایل انتخابی خالی است.')

    if kind == 'image':
        _assert_decodable_image(upload)

    return kind


def _assert_decodable_image(upload) -> None:
    """Confirm the bytes really are an image, not just labelled as one."""
    try:
        from PIL import Image
    except ImportError:  # pragma: no cover - Pillow is a hard dependency
        return

    try:
        upload.seek(0)
        with Image.open(upload) as image:
            image.verify()
    except Exception as error:  # noqa: BLE001 - any decode failure is a reject
        raise ValidationError('فایل تصویری معتبر نیست.') from error
    finally:
        # Rewind so the storage backend writes the file from the beginning.
        upload.seek(0)
