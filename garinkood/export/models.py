"""صادرات - export case files and customs documents as first-class models.

Bounded context contract (identical to logistics/machinery): this module
extends ONE kernel row (``shop.Order``) via ``OneToOneField(..., CASCADE)``
and owns everything trade-specific itself. Deleting the kernel order removes
its export file and every uploaded document with it; the reverse never
happens from here.

Design decisions, no hidden magic:

* ``ExportOrder.status`` is the staff-managed state of the trade file
  (draft -> pending_docs -> customs_clearance -> shipped -> completed);
  documents never silently move it - a file advances when a specialist says
  it advances.
* Destinations are pinned to the export markets Iranian agricultural goods
  realistically reach today, keyed by ISO 3166-1 alpha-2 so the API speaks a
  standard tongue and a typo can never become a country.
* Storage hygiene is a three-sided contract, enforced HERE at the model
  layer: every upload lands under a uuid prefix (no two papers can ever
  overwrite each other, even with identical file names); REPLACING a paper
  on an existing row scrubs the superseded bytes via the ``pre_save``
  receiver below; and every deleted row takes its bytes to the grave via
  the ``post_delete`` receiver. Row count and disk usage can therefore
  never drift apart at holding scale.
"""

from decimal import Decimal
from uuid import uuid4

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver


def export_document_upload_to(instance, filename):
    """Per-case folder + uuid prefix for every stored paper.

    ``uuid4().hex`` guarantees uniqueness, so re-uploading «invoice.pdf» for
    the same trade file creates a sibling instead of overwriting the first
    scan; the original name is kept as a human-readable suffix. The basename
    is stripped of any path components first, because a crafted upload name
    must never be able to walk out of the case folder.
    """
    safe_name = filename.replace("\\", "/").rsplit("/", 1)[-1]
    return f"export/docs/{instance.export_order_id}/{uuid4().hex}_{safe_name}"


class ExportOrder(models.Model):
    """پرونده صادراتی - one trade file per export-bound kernel order."""

    STATUS_DRAFT = "draft"
    STATUS_PENDING_DOCS = "pending_docs"
    STATUS_CUSTOMS_CLEARANCE = "customs_clearance"
    STATUS_SHIPPED = "shipped"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "پیش‌نویس"),
        (STATUS_PENDING_DOCS, "در انتظار اسناد"),
        (STATUS_CUSTOMS_CLEARANCE, "در حال ترخیص گمرکی"),
        (STATUS_SHIPPED, "ارسال شد"),
        (STATUS_COMPLETED, "تکمیل شد"),
    )

    CURRENCY_USD = "USD"
    CURRENCY_EUR = "EUR"
    CURRENCY_AED = "AED"
    CURRENCY_IRT = "IRT"
    CURRENCY_CHOICES = (
        (CURRENCY_USD, "دلار آمریکا"),
        (CURRENCY_EUR, "یورو"),
        (CURRENCY_AED, "درهم امارات"),
        (CURRENCY_IRT, "تومان ایران"),
    )

    # ISO 3166-1 alpha-2 codes; labels in Persian for the ops board.
    COUNTRY_IRAQ = "IQ"
    COUNTRY_UAE = "AE"
    COUNTRY_TURKEY = "TR"
    COUNTRY_RUSSIA = "RU"
    COUNTRY_AFGHANISTAN = "AF"
    COUNTRY_PAKISTAN = "PK"
    COUNTRY_AZERBAIJAN = "AZ"
    COUNTRY_ARMENIA = "AM"
    COUNTRY_KAZAKHSTAN = "KZ"
    COUNTRY_TURKMENISTAN = "TM"
    COUNTRY_OMAN = "OM"
    COUNTRY_QATAR = "QA"
    COUNTRY_KUWAIT = "KW"
    COUNTRY_CHINA = "CN"
    COUNTRY_INDIA = "IN"
    DESTINATION_COUNTRY_CHOICES = (
        (COUNTRY_IRAQ, "عراق"),
        (COUNTRY_UAE, "امارات متحده عربی"),
        (COUNTRY_TURKEY, "ترکیه"),
        (COUNTRY_RUSSIA, "روسیه"),
        (COUNTRY_AFGHANISTAN, "افغانستان"),
        (COUNTRY_PAKISTAN, "پاکستان"),
        (COUNTRY_AZERBAIJAN, "جمهوری آذربایجان"),
        (COUNTRY_ARMENIA, "ارمنستان"),
        (COUNTRY_KAZAKHSTAN, "قزاقستان"),
        (COUNTRY_TURKMENISTAN, "ترکمنستان"),
        (COUNTRY_OMAN, "عمان"),
        (COUNTRY_QATAR, "قطر"),
        (COUNTRY_KUWAIT, "کویت"),
        (COUNTRY_CHINA, "چین"),
        (COUNTRY_INDIA, "هند"),
    )

    order = models.OneToOneField(
        "shop.Order",
        on_delete=models.CASCADE,
        related_name="export_details",
        verbose_name="سفارش",
    )
    destination_country = models.CharField(
        max_length=2,
        choices=DESTINATION_COUNTRY_CHOICES,
        db_index=True,
        verbose_name="کشور مقصد",
    )
    currency = models.CharField(
        max_length=3,
        choices=CURRENCY_CHOICES,
        default=CURRENCY_USD,
        verbose_name="ارز توافق‌شده",
    )
    total_value_foreign = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        verbose_name="ارزش کل به ارز توافق‌شده",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True,
        verbose_name="وضعیت پرونده",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "پرونده صادراتی"
        verbose_name_plural = "پرونده‌های صادراتی"
        indexes = [
            # Hot ops board: open cases per market.
            models.Index(
                fields=("status", "destination_country"),
                name="export_status_country_idx",
            ),
        ]

    def __str__(self):
        order = getattr(self, "order", None)
        code = order.code if order else f"#{self.pk}"
        return f"پرونده صادراتی {code} » {self.get_destination_country_display()}"


class ExportDocument(models.Model):
    """سند گمرکی - one uploaded paper of the trade file, verified by staff."""

    TYPE_COMMERCIAL_INVOICE = "commercial_invoice"
    TYPE_CERTIFICATE_OF_ORIGIN = "certificate_of_origin"
    TYPE_PHYTOSANITARY = "phytosanitary"
    TYPE_PACKING_LIST = "packing_list"
    DOCUMENT_TYPE_CHOICES = (
        (TYPE_COMMERCIAL_INVOICE, "فاکتور تجاری"),
        (TYPE_CERTIFICATE_OF_ORIGIN, "گواهی مبدأ"),
        (TYPE_PHYTOSANITARY, "گواهی بهداشت گیاهی"),
        (TYPE_PACKING_LIST, "لیست بسته‌بندی"),
    )

    export_order = models.ForeignKey(
        ExportOrder,
        on_delete=models.CASCADE,
        related_name="documents",
        verbose_name="پرونده صادراتی",
    )
    document_type = models.CharField(
        max_length=24,
        choices=DOCUMENT_TYPE_CHOICES,
        verbose_name="نوع سند",
    )
    file = models.FileField(upload_to=export_document_upload_to, verbose_name="فایل سند")
    issue_date = models.DateField(verbose_name="تاریخ صدور")
    is_verified = models.BooleanField(default=False, db_index=True, verbose_name="تأیید کارشناس")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان بارگذاری")

    class Meta:
        ordering = ("-created_at", "-id")
        verbose_name = "سند گمرکی"
        verbose_name_plural = "اسناد گمرکی"

    def __str__(self):
        return f"{self.get_document_type_display()} » پرونده {self.export_order_id}"


@receiver(pre_save, sender=ExportDocument)
def delete_stale_document_file_on_replace(sender, instance, **kwargs):
    """Replacing a paper must scrub the bytes it supersedes.

    The mirror of the ``post_delete`` contract below: when a specialist
    uploads a fresh scan on an EXISTING row (same row, new file), the old
    bytes would otherwise stay on disk unreferenced forever. Here we read
    the pre-edit row from the database and, iff the incoming file differs
    from the stored one, drop the old object through the storage API - so
    the same code scrubs local disk today and the S3 bucket tomorrow.
    Fresh rows (no pk yet) and metadata-only edits (a verification flip, a
    date change, where ``instance.file.name`` still equals the stored name)
    touch nothing, which keeps the desk's routine updates cheap and safe.
    """
    if not instance.pk:
        return
    try:
        old_instance = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return
    if old_instance.file and old_instance.file.name != instance.file.name:
        old_instance.file.delete(save=False)


@receiver(post_delete, sender=ExportDocument)
def delete_document_file_on_row_delete(sender, instance, **kwargs):
    """A deleted row must take its bytes to the grave.

    Registered HERE, next to the model it guards - the file and its storage
    contract are one concern, so they live in one file. ``FieldFile.delete``
    is save=False (the row is already gone) and storage-backed, so the same
    code scrubs local disk today and the S3 bucket tomorrow; a missing object
    is not an error, which keeps cascade deletes (order -> file -> papers)
    idempotent.
    """
    if instance.file:
        instance.file.delete(save=False)
