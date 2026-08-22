"""Payment-provider registry.

Gateway credentials are deliberately read only on the server.  The registry
makes payment methods discoverable, but only a provider with a tested request,
verify and webhook adapter may be marked enabled.  This repository currently
keeps all external gateways unavailable rather than pretending to accept money
without merchant accounts and end-to-end verification tests.
"""

from dataclasses import dataclass

from django.conf import settings


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
    return [
        ProviderOption(
            code="coordination",
            label="هماهنگی با کارشناس",
            currency="IRR",
            enabled=True,
            configured=True,
            reason="ثبت سفارش انجام می‌شود و پرداخت پس از تأیید هماهنگ خواهد شد.",
        ),
        ProviderOption(
            code="zarinpal",
            label="زرین‌پال",
            currency="IRR",
            enabled=False,
            configured=bool(configured["zarinpal"]["merchant_id"]),
            reason="نیازمند request/verify callback، sandbox و تست end-to-end است.",
        ),
        ProviderOption(
            code="stripe_card",
            label="Visa / Mastercard از طریق Stripe",
            currency="USD",
            enabled=False,
            configured=bool(configured["stripe_card"]["secret_key"]),
            reason="نیازمند حساب تجاری Stripe، webhook verify و بررسی منطقه پذیرنده است.",
        ),
        ProviderOption(
            code="paypal",
            label="PayPal",
            currency="USD",
            enabled=False,
            configured=bool(configured["paypal"]["client_id"] and configured["paypal"]["client_secret"]),
            reason="نیازمند حساب تجاری PayPal، capture و webhook verify است.",
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
