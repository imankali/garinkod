"""Shipping quotes and carrier-neutral fulfilment helpers.

The deterministic flat-rate adapter is always safe. External carrier adapters
must implement this contract from an authenticated, current provider contract;
none is marked live merely from undocumented third-party endpoint examples.
"""

from dataclasses import asdict, dataclass
from typing import Protocol

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Order, ReturnPolicySettings, Shipment, ShipmentTrackingEvent


@dataclass(frozen=True)
class ShippingQuote:
    provider: str
    service: str
    label: str
    amount: int
    currency: str = "IRT"
    estimated_days_min: int | None = None
    estimated_days_max: int | None = None

    def as_dict(self):
        return asdict(self)


class ShippingProvider(Protocol):
    code: str

    def quote(self, *, subtotal: int, province: str, city: str, weight_grams: int = 0) -> list[ShippingQuote]: ...

    def create_shipment(self, order: Order) -> Shipment: ...

    def refresh_tracking(self, shipment: Shipment) -> Shipment: ...


class ShippingServiceUnavailable(Exception):
    """Raised when a buyer asks for a delivery service that is not on offer.

    Silently downgrading «تحویل فوری» to standard would be the polite answer and
    the wrong one: the fee and the promise both change under the buyer's feet.
    """


class FlatRateShippingProvider:
    """Local fallback: no carrier claim, credential, or network dependency."""

    code = "flat"

    def quote(self, *, subtotal: int, province: str, city: str, weight_grams: int = 0) -> list[ShippingQuote]:
        amount = 0 if subtotal >= settings.SHIPPING_FREE_THRESHOLD else settings.SHIPPING_FLAT_RATE
        quotes = [
            ShippingQuote(
                provider=self.code,
                service="standard",
                label="ارسال استاندارد",
                amount=amount,
                estimated_days_min=2,
                estimated_days_max=7,
            )
        ]
        # Read straight off the row rather than through ``load()``: quoting a
        # delivery price must not create settings on a GET.
        express = ReturnPolicySettings.objects.filter(pk=1).values_list(
            "express_shipping_enabled", "express_shipping_fee"
        ).first()
        if express and express[0]:
            quotes.append(
                ShippingQuote(
                    provider=self.code,
                    service="express",
                    label="تحویل فوری",
                    amount=amount + int(express[1] or 0),
                    estimated_days_min=1,
                    estimated_days_max=1,
                )
            )
        return quotes

    def create_shipment(self, order: Order) -> Shipment:
        return Shipment.objects.create(
            order=order,
            provider="manual",
            service_name="ارسال استاندارد",
            status="pending",
            shipping_cost=order.shipping_price,
        )

    def refresh_tracking(self, shipment: Shipment) -> Shipment:
        # Manual records are updated by authorised fulfilment staff in admin.
        return shipment


flat_rate_provider = FlatRateShippingProvider()


def shipping_options(*, subtotal: int, province: str, city: str, weight_grams: int = 0) -> list[ShippingQuote]:
    """Every delivery service the buyer can actually pick, cheapest promise last."""
    return flat_rate_provider.quote(
        subtotal=subtotal, province=province, city=city, weight_grams=weight_grams
    )


def quote_shipping(*, subtotal: int, province: str, city: str, weight_grams: int = 0,
                   service: str = "standard") -> ShippingQuote:
    quotes = shipping_options(
        subtotal=subtotal, province=province, city=city, weight_grams=weight_grams
    )
    for quote in quotes:
        if quote.service == service:
            return quote
    return quotes[0]


def select_shipping_quote(*, subtotal: int, province: str, city: str, weight_grams: int = 0,
                          service: str = "standard") -> ShippingQuote:
    """Like ``quote_shipping`` but refuses a service that is not on offer."""
    quotes = shipping_options(
        subtotal=subtotal, province=province, city=city, weight_grams=weight_grams
    )
    for quote in quotes:
        if quote.service == service:
            return quote
    raise ShippingServiceUnavailable('گزینه ارسال انتخابی در حال حاضر ارائه نمی‌شود.')


def create_initial_shipment(order: Order) -> Shipment:
    existing = order.shipments.first()
    return existing or flat_rate_provider.create_shipment(order)


def record_tracking_event(
    shipment: Shipment,
    *,
    status: str,
    description: str,
    occurred_at=None,
    location: str = "",
    provider_event_id: str = "",
    raw_payload: dict | None = None,
) -> ShipmentTrackingEvent:
    """Append one event and synchronize shipment/order state atomically."""
    if status not in dict(Shipment.STATUS_CHOICES):
        raise ValueError("Unknown shipment status")
    occurred_at = occurred_at or timezone.now()
    with transaction.atomic():
        locked = Shipment.objects.select_for_update().select_related("order").get(pk=shipment.pk)
        if provider_event_id:
            existing = ShipmentTrackingEvent.objects.filter(
                shipment=locked, provider_event_id=provider_event_id
            ).first()
            if existing:
                return existing
        # The post-save receiver applies this normalized event to Shipment and
        # Order as well, including events entered directly through Django admin.
        return ShipmentTrackingEvent.objects.create(
            shipment=locked,
            provider_event_id=provider_event_id,
            status=status,
            description=description,
            location=location,
            occurred_at=occurred_at,
            raw_payload=raw_payload or {},
        )
