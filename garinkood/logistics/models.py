"""لجستیک - buyer-facing shipment tracking as a first-class domain model.

Platform-kernel contract identical to agri_inputs/machinery: this bounded
context extends ONE existing kernel row (``shop.Order``) and owns everything
else itself. Cascade flows one way - deleting the order removes the parcel
and its whole timeline.

Coexistence contract with ``shop.models.Shipment`` (honest, deliberate):

* ``shop.models.Shipment`` is the *fulfilment* record: multiple parcels per
  order, provider integrations (postex/tipax/chapar), synced via signals into
  the order state machine, written by the ops desk.
* ``logistics.Shipment`` is the holding's *customer projection*: exactly one
  primary parcel per order (OneToOne), the human-readable carrier name, the
  public tracking code, and an append-only timeline the buyer reads on the
  tracking page.

Design decisions, no hidden magic:

* ``Shipment.status`` is the staff-managed CURRENT state; ``ShipmentEvent``
  rows are the append-only audit trail of how that state advanced. Nothing
  here silently syncs one from the other - every write is a conscious staff
  action, so a drift between the two is always a choice, never a bug.
* ``tracking_code`` is unique AND indexed: it is the primary public lookup
  key a buyer reads off the carrier receipt.
"""

from django.db import models


class Shipment(models.Model):
    """مرسوله - the one primary parcel an order travels home with."""

    STATUS_PENDING = "pending"
    STATUS_PICKED_UP = "picked_up"
    STATUS_IN_TRANSIT = "in_transit"
    STATUS_OUT_FOR_DELIVERY = "out_for_delivery"
    STATUS_DELIVERED = "delivered"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = (
        (STATUS_PENDING, "در انتظار پذیرش"),
        (STATUS_PICKED_UP, "تحویل به حامل شد"),
        (STATUS_IN_TRANSIT, "در مسیر"),
        (STATUS_OUT_FOR_DELIVERY, "در حال توزیع"),
        (STATUS_DELIVERED, "تحویل داده شد"),
        (STATUS_FAILED, "تحویل ناموفق"),
    )

    order = models.OneToOneField(
        "shop.Order",
        on_delete=models.CASCADE,
        related_name="logistics_shipment",
        verbose_name="سفارش",
    )
    tracking_code = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        verbose_name="کد رهگیری",
        help_text="کدی که حامل روی رسید مرسوله درج می‌کند؛ کلید اصلی پیگیری مشتری.",
    )
    carrier_name = models.CharField(max_length=100, verbose_name="نام حامل")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
        verbose_name="وضعیت",
    )
    estimated_delivery_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاریخ تخمینی تحویل",
    )
    shipped_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان خروج از انبار",
    )
    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان تحویل",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "مرسوله لجستیک"
        verbose_name_plural = "مرسوله‌های لجستیک"
        indexes = [
            # Hot staff board: open shipments ordered by the promised date.
            models.Index(
                fields=("status", "estimated_delivery_date"),
                name="logi_ship_status_eta_idx",
            ),
        ]

    def __str__(self):
        return f"مرسوله {self.tracking_code} ({self.carrier_name})"


class ShipmentEvent(models.Model):
    """رویداد رهگیری - append-only: one honest line per scan or phone call."""

    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name="events",
        verbose_name="مرسوله",
    )
    status = models.CharField(
        max_length=20,
        choices=Shipment.STATUS_CHOICES,
        verbose_name="وضعیت در این نقطه",
    )
    description = models.CharField(max_length=300, verbose_name="توضیح رویداد")
    location = models.CharField(max_length=120, blank=True, verbose_name="مکان")
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        # Newest first, with the primary key as deterministic tiebreak: two
        # rows written inside one millisecond still render in write order.
        ordering = ("-timestamp", "-id")
        verbose_name = "رویداد رهگیری لجستیک"
        verbose_name_plural = "رویدادهای رهگیری لجستیک"

    def __str__(self):
        tracking_code = getattr(self.shipment, "tracking_code", "?")
        return f"{tracking_code} » {self.get_status_display()}"
