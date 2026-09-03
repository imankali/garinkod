"""Payment provider registry and the official Zarinpal v4 lifecycle.

Catalogue integers are تومان. Zarinpal is therefore called with ``currency=IRT``
for both request and verify, avoiding an implicit tenfold conversion. Provider
I/O happens outside checkout's stock transaction; durable PaymentAttempt rows
carry the authority and make callback replay safe.
"""

from dataclasses import dataclass
from datetime import timedelta
import logging
from uuid import uuid4

import requests
from django.conf import settings
from django.db import IntegrityError, transaction
from django.urls import reverse
from django.utils import timezone

from .models import Order, PaymentAttempt
from .rewards import mark_order_paid_and_reward

logger = logging.getLogger(__name__)


class PaymentError(Exception):
    """Safe payment failure whose message may be shown to a customer."""


class PaymentConfigurationError(PaymentError):
    pass


class PaymentProviderError(PaymentError):
    def __init__(self, message: str, *, code=None, payload=None, retryable=False):
        super().__init__(message)
        self.code = code
        self.payload = payload or {}
        self.retryable = retryable


@dataclass(frozen=True)
class ProviderOption:
    code: str
    label: str
    currency: str
    enabled: bool
    configured: bool
    reason: str


def provider_options() -> list[ProviderOption]:
    configured = settings.PAYMENT_PROVIDER_CONFIG
    zarinpal_ready = bool(
        configured["zarinpal"]["enabled"] and configured["zarinpal"]["merchant_id"]
    )
    return [
        ProviderOption(
            code="coordination",
            label="هماهنگی با کارشناس",
            currency="IRT",
            enabled=True,
            configured=True,
            reason="ثبت سفارش انجام می‌شود و پرداخت پس از تأیید هماهنگ خواهد شد.",
        ),
        ProviderOption(
            code="zarinpal",
            label="زرین‌پال",
            currency="IRT",
            enabled=zarinpal_ready,
            configured=bool(configured["zarinpal"]["merchant_id"]),
            reason=(
                "درگاه برای پرداخت آنلاین آماده است."
                if zarinpal_ready
                else "درگاه تا زمان فعال‌سازی و تنظیم Merchant ID غیرفعال است."
            ),
        ),
        ProviderOption(
            code="stripe_card",
            label="Visa / Mastercard از طریق Stripe",
            currency="USD",
            enabled=False,
            configured=bool(configured["stripe_card"]["secret_key"]),
            reason="نیازمند حساب تجاری Stripe، capture و webhook تأییدشده است.",
        ),
        ProviderOption(
            code="paypal",
            label="PayPal",
            currency="USD",
            enabled=False,
            configured=bool(
                configured["paypal"]["client_id"] and configured["paypal"]["client_secret"]
            ),
            reason="نیازمند حساب تجاری PayPal، capture و webhook تأییدشده است.",
        ),
        ProviderOption(
            code="crypto",
            label="پرداخت رمزارزی",
            currency="USDT",
            enabled=False,
            configured=bool(configured["crypto"]["provider_key"]),
            reason="نیازمند ارائه‌دهنده مجاز، KYC/AML و تأیید تراکنش روی زنجیره است.",
        ),
    ]


def get_provider(code: str) -> ProviderOption | None:
    return next((provider for provider in provider_options() if provider.code == code), None)


class ZarinpalV4Client:
    request_path = "/pg/v4/payment/request.json"
    verify_path = "/pg/v4/payment/verify.json"

    def __init__(self, *, http=None):
        self.config = settings.PAYMENT_PROVIDER_CONFIG["zarinpal"]
        self.http = http or requests
        self.base_url = (
            "https://sandbox.zarinpal.com"
            if self.config.get("sandbox")
            else "https://payment.zarinpal.com"
        )

    @property
    def is_ready(self) -> bool:
        return bool(self.config.get("enabled") and self.config.get("merchant_id"))

    def _post(self, path: str, payload: dict) -> dict:
        if not self.is_ready:
            raise PaymentConfigurationError("درگاه زرین‌پال در حال حاضر فعال نیست.")
        try:
            response = self.http.post(
                f"{self.base_url}{path}",
                json=payload,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
                timeout=settings.PAYMENT_HTTP_TIMEOUT,
            )
            response.raise_for_status()
            body = response.json()
        except (requests.Timeout, requests.ConnectionError) as exc:
            raise PaymentProviderError(
                "ارتباط با زرین‌پال موقتاً برقرار نشد. دوباره تلاش کنید.",
                retryable=True,
            ) from exc
        except (requests.RequestException, ValueError) as exc:
            raise PaymentProviderError("پاسخ معتبر از زرین‌پال دریافت نشد.") from exc
        if not isinstance(body, dict):
            raise PaymentProviderError("پاسخ معتبر از زرین‌پال دریافت نشد.")
        return body

    @staticmethod
    def _result(body: dict) -> tuple[dict, object, str]:
        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        errors = body.get("errors")
        code = data.get("code")
        message = data.get("message") or ""
        if not data and errors:
            if isinstance(errors, dict):
                code = errors.get("code")
                message = errors.get("message") or str(errors)
            else:
                message = str(errors)
        return data, code, message

    def request_payment(self, attempt: PaymentAttempt, callback_url: str) -> dict:
        order = attempt.order
        metadata = {"order_id": order.code}
        if order.phone:
            metadata["mobile"] = order.phone
        if order.email:
            metadata["email"] = order.email
        body = self._post(
            self.request_path,
            {
                "merchant_id": self.config["merchant_id"],
                "currency": "IRT",
                "amount": attempt.amount,
                "callback_url": callback_url,
                "description": f"پرداخت سفارش {order.code} گرین کود",
                "metadata": metadata,
            },
        )
        data, code, message = self._result(body)
        authority = str(data.get("authority") or "")
        if code != 100 or not authority or len(authority) > 255:
            raise PaymentProviderError(
                message or "زرین‌پال درخواست پرداخت را نپذیرفت.", code=code, payload=body
            )
        return {"authority": authority, "body": body}

    def verify_payment(self, attempt: PaymentAttempt) -> dict:
        body = self._post(
            self.verify_path,
            {
                "merchant_id": self.config["merchant_id"],
                "currency": "IRT",
                "amount": attempt.amount,
                "authority": attempt.external_reference,
            },
        )
        data, code, message = self._result(body)
        if code not in {100, 101}:
            raise PaymentProviderError(
                message or "تأیید پرداخت توسط زرین‌پال رد شد.", code=code, payload=body
            )
        return {"code": code, "data": data, "body": body}

    def checkout_url(self, authority: str) -> str:
        return f"{self.base_url}/pg/StartPay/{authority}"


def zarinpal_callback_url() -> str:
    return f"{settings.PAYMENT_CALLBACK_BASE_URL}{reverse('zarinpal_callback')}"


def start_zarinpal_payment(order: Order, *, client=None) -> PaymentAttempt:
    """Create/reuse an active authority without holding DB locks over HTTP."""
    client = client or ZarinpalV4Client()
    if not client.is_ready:
        raise PaymentConfigurationError("درگاه زرین‌پال در حال حاضر فعال نیست.")

    with transaction.atomic():
        locked_order = Order.objects.select_for_update().get(pk=order.pk)
        if locked_order.payment_status == "paid":
            raise PaymentError("این سفارش قبلاً پرداخت شده است.")
        existing = (
            locked_order.payment_attempts.filter(
                provider="zarinpal",
                status="pending",
                amount=locked_order.total_price,
                currency="IRT",
                checkout_url__gt="",
            )
            .order_by("-created_at")
            .first()
        )
        if existing:
            return existing
        in_progress = locked_order.payment_attempts.filter(
            provider="zarinpal", status__in=["created", "processing"]
        ).first()
        if in_progress:
            raise PaymentError("درخواست پرداخت دیگری در حال پردازش است. چند لحظه بعد تلاش کنید.")
        try:
            attempt = PaymentAttempt.objects.create(
                order=locked_order,
                provider="zarinpal",
                status="created",
                amount=locked_order.total_price,
                currency="IRT",
                idempotency_key=uuid4().hex,
                expires_at=timezone.now() + timedelta(minutes=30),
            )
        except IntegrityError as exc:
            raise PaymentError("درخواست پرداخت دیگری در حال پردازش است.") from exc

    try:
        result = client.request_payment(attempt, zarinpal_callback_url())
    except PaymentProviderError as exc:
        with transaction.atomic():
            failed = PaymentAttempt.objects.select_for_update().get(pk=attempt.pk)
            if failed.status == "created":
                failed.status = "failed"
                failed.provider_payload = {
                    "error": str(exc),
                    "code": exc.code,
                    "retryable": exc.retryable,
                    "response": exc.payload,
                }
                failed.save(update_fields=["status", "provider_payload", "updated_at"])
        raise

    checkout_url = client.checkout_url(result["authority"])
    with transaction.atomic():
        attempt = PaymentAttempt.objects.select_for_update().get(pk=attempt.pk)
        if attempt.status != "created":
            raise PaymentError("وضعیت درخواست پرداخت تغییر کرده است؛ دوباره تلاش کنید.")
        attempt.status = "pending"
        attempt.external_reference = result["authority"]
        attempt.checkout_url = checkout_url
        attempt.provider_payload = {"request": result["body"]}
        attempt.save(
            update_fields=[
                "status", "external_reference", "checkout_url", "provider_payload", "updated_at"
            ]
        )
        locked_order = Order.objects.select_for_update().get(pk=order.pk)
        if locked_order.payment_status != "paid":
            locked_order.payment_status = "pending"
            locked_order.save(update_fields=["payment_status", "updated_at"])
    return attempt


def cancel_zarinpal_attempt(authority: str) -> PaymentAttempt | None:
    with transaction.atomic():
        attempt = (
            PaymentAttempt.objects.select_for_update()
            .filter(provider="zarinpal", external_reference=authority)
            .select_related("order")
            .first()
        )
        if not attempt:
            return None
        if attempt.status != "paid":
            attempt.status = "cancelled"
            attempt.provider_payload = {**attempt.provider_payload, "callback_status": "NOK"}
            attempt.save(update_fields=["status", "provider_payload", "updated_at"])
            if not attempt.order.payment_attempts.filter(
                provider="zarinpal", status__in=["pending", "processing", "paid"]
            ).exclude(pk=attempt.pk).exists() and attempt.order.payment_status != "paid":
                attempt.order.payment_status = "unpaid"
                attempt.order.save(update_fields=["payment_status", "updated_at"])
        return attempt


def verify_zarinpal_payment(authority: str, *, client=None) -> tuple[PaymentAttempt, bool]:
    """Verify provider-side, then atomically apply local money effects once.

    Returns ``(attempt, newly_paid)``. Zarinpal codes 100 (new verification) and
    101 (already verified) are both accepted; the locked local status is the
    final idempotency boundary.
    """
    attempt = (
        PaymentAttempt.objects.filter(provider="zarinpal", external_reference=authority)
        .select_related("order")
        .first()
    )
    if not attempt:
        raise PaymentError("شناسه پرداخت معتبر نیست.")
    if attempt.amount != attempt.order.total_price or attempt.currency != "IRT":
        raise PaymentError("مبلغ یا واحد پرداخت با سفارش مطابقت ندارد.")
    if attempt.status == "paid":
        return attempt, False

    client = client or ZarinpalV4Client()
    try:
        verified = client.verify_payment(attempt)
    except PaymentProviderError as exc:
        next_status = "pending" if exc.retryable else "failed"
        with transaction.atomic():
            failed = PaymentAttempt.objects.select_for_update().get(pk=attempt.pk)
            if failed.status != "paid":
                failed.status = next_status
                failed.provider_payload = {
                    **failed.provider_payload,
                    "verify_error": str(exc),
                    "code": exc.code,
                    "retryable": exc.retryable,
                    "response": exc.payload,
                }
                failed.save(update_fields=["status", "provider_payload", "updated_at"])
        raise

    with transaction.atomic():
        locked = (
            PaymentAttempt.objects.select_for_update().select_related("order").get(pk=attempt.pk)
        )
        order = Order.objects.select_for_update().get(pk=locked.order_id)
        if locked.external_reference != authority:
            raise PaymentError("شناسه پرداخت با درخواست ذخیره‌شده مطابقت ندارد.")
        if locked.amount != order.total_price or locked.currency != "IRT":
            raise PaymentError("مبلغ یا واحد پرداخت با سفارش مطابقت ندارد.")
        if locked.status == "paid" or order.payment_status == "paid":
            if locked.status != "paid":
                locked.status = "paid"
                locked.verified_at = timezone.now()
                locked.provider_payload = {**locked.provider_payload, "verify": verified["body"]}
                locked.save(
                    update_fields=["status", "verified_at", "provider_payload", "updated_at"]
                )
            return locked, False

        locked.status = "processing"
        locked.save(update_fields=["status", "updated_at"])
        mark_order_paid_and_reward(order)
        locked.status = "paid"
        locked.verified_at = timezone.now()
        locked.provider_payload = {**locked.provider_payload, "verify": verified["body"]}
        locked.save(update_fields=["status", "verified_at", "provider_payload", "updated_at"])

    logger.info(
        "Zarinpal payment verified",
        extra={"order_code": order.code, "attempt_id": locked.pk, "provider_code": verified["code"]},
    )
    return locked, True
