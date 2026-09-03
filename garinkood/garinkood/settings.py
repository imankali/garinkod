"""Django settings for the GarinKood API."""

from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

# Never use the development defaults in a deployed environment.  The checked-in
# .env.example documents every value that has to be set for production.
SECRET_KEY = config("SECRET_KEY", default="django-insecure-local-development-only")
DEBUG = config("DEBUG", default=False, cast=bool)
SITE_URL = config("SITE_URL", default="https://garinkood.ir").rstrip("/")
FRONTEND_URL = config("FRONTEND_URL", default=SITE_URL).rstrip("/")
ADMIN_PUBLIC_URL = config("ADMIN_PUBLIC_URL", default=SITE_URL).rstrip("/")
ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1,testserver",
    cast=Csv(),
)
# Arena's development preview uses a generated subdomain. It is accepted only
# in DEBUG mode; production hosts remain explicitly allowlisted above.
if DEBUG:
    ALLOWED_HOSTS = [*ALLOWED_HOSTS, ".e2b.app"]

INSTALLED_APPS = [
    # django-prometheus must precede Django's apps to instrument ORM/cache use.
    "django_prometheus",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "axes",
    "health_check",
    "import_export",
    "simple_history",
    "storages",
    "waffle",
    "rest_framework",
    "rest_framework.authtoken",
    "drf_spectacular",
    "corsheaders",
    "django_filters",
    "django.contrib.humanize",
    "django.contrib.postgres",
    "shop.apps.ShopConfig",
]

MIDDLEWARE = [
    "django_prometheus.middleware.PrometheusBeforeMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # Axes protects password authentication; the existing OTP limits stay
    # independent and continue to provide phone/IP/cooldown protection.
    "axes.middleware.AxesMiddleware",
    "simple_history.middleware.HistoryRequestMiddleware",
    "waffle.middleware.WaffleMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",
]

ROOT_URLCONF = "garinkood.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "garinkood.wsgi.application"
ASGI_APPLICATION = "garinkood.asgi.application"

# SQLite is intentionally the zero-configuration option for local development,
# automated tests and the load-test fixture. Production must set DB_ENGINE to
# postgresql and provide the DB_* values below.
DB_ENGINE = config("DB_ENGINE", default="postgresql")
if DB_ENGINE == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": config("DB_NAME", default=str(BASE_DIR / "db.sqlite3")),
            # SQLite has a single writer. A longer local-development timeout
            # prevents guest-cart requests from failing immediately in a
            # controlled concurrent test; production uses PostgreSQL.
            "OPTIONS": {"timeout": config("SQLITE_TIMEOUT", default=30, cast=int)},
        }
    }
elif DB_ENGINE == "postgresql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("DB_NAME"),
            "USER": config("DB_USER"),
            "PASSWORD": config("DB_PASSWORD"),
            "HOST": config("DB_HOST", default="localhost"),
            "PORT": config("DB_PORT", default="5432"),
            "CONN_MAX_AGE": config("DB_CONN_MAX_AGE", default=60, cast=int),
        }
    }
else:
    raise ValueError("DB_ENGINE must be either 'sqlite' or 'postgresql'.")

# Throttling counters live in the cache. The in-memory backend is per-process
# and therefore only correct for a single-worker development server; any
# multi-worker deployment must set CACHE_URL (or REDIS_URL) to a shared Redis so the
# limits are enforced globally rather than per worker.
CACHE_URL = config("CACHE_URL", default=config("REDIS_URL", default=""))
if CACHE_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": CACHE_URL,
            "KEY_PREFIX": "garinkood",
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "garinkood-local",
        }
    }

# Throttling is disabled by default under the test runner so unrelated tests do
# not exhaust one another's rate budgets; see shop/test_runner.py.
TEST_RUNNER = "shop.test_runner.GarinKoodTestRunner"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTHENTICATION_BACKENDS = [
    "axes.backends.AxesStandaloneBackend",
    "django.contrib.auth.backends.ModelBackend",
]
AXES_FAILURE_LIMIT = config("AXES_FAILURE_LIMIT", default=5, cast=int)
AXES_COOLOFF_TIME = timedelta(minutes=config("AXES_COOLOFF_MINUTES", default=30, cast=int))
AXES_RESET_ON_SUCCESS = True
AXES_LOCKOUT_PARAMETERS = [["username", "ip_address"]]
AXES_VERBOSE = config("AXES_VERBOSE", default=False, cast=bool)

LANGUAGE_CODE = "fa-ir"
TIME_ZONE = "Asia/Tehran"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
SHOP_STATIC_DIR = BASE_DIR / "shop" / "static"
STATICFILES_DIRS = [SHOP_STATIC_DIR] if SHOP_STATIC_DIR.exists() else []

MEDIA_STORAGE_BACKEND = config("MEDIA_STORAGE_BACKEND", default="local").strip().lower()
if MEDIA_STORAGE_BACKEND not in {"local", "s3"}:
    raise ValueError("MEDIA_STORAGE_BACKEND must be either 'local' or 's3'.")

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
if MEDIA_STORAGE_BACKEND == "s3":
    # Supports AWS S3 and providers implementing the S3 API. Public-read ACLs
    # are never granted implicitly; bucket/CDN policy remains operator-owned.
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": config("S3_BUCKET_NAME", default=""),
            "access_key": config("S3_ACCESS_KEY_ID", default="") or None,
            "secret_key": config("S3_SECRET_ACCESS_KEY", default="") or None,
            "endpoint_url": config("S3_ENDPOINT_URL", default="") or None,
            "region_name": config("S3_REGION_NAME", default="") or None,
            "custom_domain": config("S3_CUSTOM_DOMAIN", default="") or None,
            "default_acl": None,
            "querystring_auth": config("S3_QUERYSTRING_AUTH", default=True, cast=bool),
            "file_overwrite": False,
        },
    }

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "products"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "shop.authentication.CookieTokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 12,
    # One envelope for every error, with Persian copy and field-level details.
    "EXCEPTION_HANDLER": "shop.exception_handlers.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    # Each sensitive endpoint gets its own budget so exhausting one cannot
    # block another. Rates are environment-tunable for load testing.
    "DEFAULT_THROTTLE_RATES": {
        "anon": config("THROTTLE_ANON", default="120/hour"),
        "user": config("THROTTLE_USER", default="600/hour"),
        "login": config("THROTTLE_LOGIN", default="10/min"),
        "register": config("THROTTLE_REGISTER", default="5/hour"),
        "otp_request": config("THROTTLE_OTP_REQUEST", default="30/hour"),
        "otp_verify": config("THROTTLE_OTP_VERIFY", default="60/hour"),
        "search": config("THROTTLE_SEARCH", default="60/min"),
        "checkout": config("THROTTLE_CHECKOUT", default="12/hour"),
        "upload": config("THROTTLE_UPLOAD", default="20/hour"),
        "feedback": config("THROTTLE_FEEDBACK", default="10/hour"),
    },
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    # Browsable API is helpful locally but unnecessarily exposes an HTML surface
    # in production.
    "DEFAULT_RENDERER_CLASSES": (
        ["rest_framework.renderers.JSONRenderer", "rest_framework.renderers.BrowsableAPIRenderer"]
        if DEBUG
        else ["rest_framework.renderers.JSONRenderer"]
    ),
}

# OpenAPI is generated for maintainers but never served anonymously. Schema and
# interactive documentation views use these settings in garinkood.urls.
IMPORT_EXPORT_IMPORT_PERMISSION_CODE = "change"
IMPORT_EXPORT_EXPORT_PERMISSION_CODE = "view"

SPECTACULAR_SETTINGS = {
    "TITLE": "GarinKood API",
    "DESCRIPTION": "Commerce, marketplace, account, messaging and operations API.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SERVE_AUTHENTICATION": ["rest_framework.authentication.SessionAuthentication"],
    "SERVE_PERMISSIONS": ["rest_framework.permissions.IsAdminUser"],
    "SCHEMA_PATH_PREFIX": r"/api",
    # Several resources call their choice field `status`; give the shipment
    # lifecycle a stable client-facing component name instead of a hash.
    "ENUM_NAME_OVERRIDES": {
        "ShipmentStatusEnum": "shop.models.Shipment.STATUS_CHOICES",
    },
}

# The frontend uses a same-origin reverse proxy in both development and
# production. Cross-origin access is opt-in rather than open to every origin.
CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", default="", cast=Csv())
CORS_ALLOW_ALL_ORIGINS = DEBUG and not CORS_ALLOWED_ORIGINS
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"]
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]
CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv())

SESSION_ENGINE = "django.contrib.sessions.backends.db"
# Avoid a database write for every anonymous catalogue request. Django still
# saves the session when it is created or modified (for example, on cart use).
SESSION_SAVE_EVERY_REQUEST = False
SESSION_COOKIE_AGE = 1209600
AUTH_COOKIE_NAME = 'garinkood_auth'
AUTH_COOKIE_AGE = config("AUTH_COOKIE_AGE", default=1209600, cast=int)
AUTH_COOKIE_SECURE = not DEBUG
AUTH_COOKIE_SAMESITE = 'Lax'

# The secure settings are active only outside local development. Deployments
# should terminate TLS before the application and set SECURE_PROXY_SSL_HEADER
# when a reverse proxy forwards HTTPS.
if not DEBUG:
    SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
    SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=31536000, cast=int)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Structured logging. Throttle events go to their own logger so a monitoring
# system can alert on a spike of blocked requests (a sign of either an attack
# or a limit set too tight) without wading through request noise.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
        "json": {"()": "shop.logging.JsonFormatter"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose" if DEBUG else "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": config("LOG_LEVEL", default="INFO"),
    },
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "garinkood.throttle": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = config("EMAIL_HOST", default="localhost")
EMAIL_PORT = config("EMAIL_PORT", default=25, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=False, cast=bool)
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="noreply@garinkood.ir")

# Transactional messaging. All credentials are environment-only; the database
# contains editable copy, routing destinations and delivery history, never API
# secrets. OTP is immediate because it is interactive; commerce events use the
# durable outbox processed by ``manage.py process_notifications --watch``.
MESSAGING_HTTP_TIMEOUT = config("MESSAGING_HTTP_TIMEOUT", default=8, cast=int)
MESSAGING_FAKE = config("MESSAGING_FAKE", default=False, cast=bool)
MESSAGING_ENABLE_SMS = config("MESSAGING_ENABLE_SMS", default=False, cast=bool)
MESSAGING_ENABLE_BALE = config("MESSAGING_ENABLE_BALE", default=False, cast=bool)
MESSAGING_ENABLE_TELEGRAM = config("MESSAGING_ENABLE_TELEGRAM", default=False, cast=bool)
MESSAGING_ENABLE_WHATSAPP = config("MESSAGING_ENABLE_WHATSAPP", default=False, cast=bool)
NOTIFICATION_MAX_ATTEMPTS = config("NOTIFICATION_MAX_ATTEMPTS", default=6, cast=int)
NOTIFICATION_WORKER_STALE_SECONDS = config("NOTIFICATION_WORKER_STALE_SECONDS", default=600, cast=int)
NOTIFICATION_ADMIN_TELEGRAM_CHAT_IDS = config(
    "NOTIFICATION_ADMIN_TELEGRAM_CHAT_IDS", default="", cast=Csv()
)
NOTIFICATION_ADMIN_BALE_CHAT_IDS = config(
    "NOTIFICATION_ADMIN_BALE_CHAT_IDS", default="", cast=Csv()
)
NOTIFICATION_ADMIN_SMS_NUMBERS = config(
    "NOTIFICATION_ADMIN_SMS_NUMBERS", default="", cast=Csv()
)
NOTIFICATION_ADMIN_WHATSAPP_NUMBERS = config(
    "NOTIFICATION_ADMIN_WHATSAPP_NUMBERS", default="", cast=Csv()
)
NOTIFICATION_CUSTOMER_STATUS_CHANNELS = config(
    "NOTIFICATION_CUSTOMER_STATUS_CHANNELS", default="", cast=Csv()
)

# OTP policy and provider fallback order. Debug-code responses require both
# DEBUG=True and the explicit OTP_RETURN_DEBUG_CODE flag.
OTP_CODE_LENGTH = config("OTP_CODE_LENGTH", default=6, cast=int)
OTP_TTL_SECONDS = config("OTP_TTL_SECONDS", default=180, cast=int)
OTP_RESEND_COOLDOWN_SECONDS = config("OTP_RESEND_COOLDOWN_SECONDS", default=60, cast=int)
OTP_MAX_VERIFY_ATTEMPTS = config("OTP_MAX_VERIFY_ATTEMPTS", default=5, cast=int)
OTP_PHONE_RATE_LIMIT = config("OTP_PHONE_RATE_LIMIT", default=8, cast=int)
OTP_PHONE_RATE_WINDOW_SECONDS = config("OTP_PHONE_RATE_WINDOW_SECONDS", default=3600, cast=int)
OTP_DELIVERY_CHANNELS = config("OTP_DELIVERY_CHANNELS", default="sms,bale", cast=Csv())
OTP_RETURN_DEBUG_CODE = config("OTP_RETURN_DEBUG_CODE", default=False, cast=bool)

# Iranian SMS providers (choose exactly one for the ``sms`` adapter).
SMS_PROVIDER = config("SMS_PROVIDER", default="smsir").strip().lower()
SMSIR_API_KEY = config("SMSIR_API_KEY", default="")
SMSIR_OTP_TEMPLATE_ID = config("SMSIR_OTP_TEMPLATE_ID", default=0, cast=int)
SMSIR_OTP_PARAMETER = config("SMSIR_OTP_PARAMETER", default="Code")
SMSIR_LINE_NUMBER = config("SMSIR_LINE_NUMBER", default=0, cast=int)
KAVENEGAR_API_KEY = config("KAVENEGAR_API_KEY", default="")
KAVENEGAR_OTP_TEMPLATE = config("KAVENEGAR_OTP_TEMPLATE", default="")
KAVENEGAR_SENDER = config("KAVENEGAR_SENDER", default="")

# Bale Safir sends by verified phone (including OTP); the Bot API sends owner
# alerts to chat ids. Both are official Bale services.
BALE_SAFIR_API_KEY = config("BALE_SAFIR_API_KEY", default="")
BALE_SAFIR_BOT_ID = config("BALE_SAFIR_BOT_ID", default=0, cast=int)
BALE_BOT_TOKEN = config("BALE_BOT_TOKEN", default="")
TELEGRAM_BOT_TOKEN = config("TELEGRAM_BOT_TOKEN", default="")

# Official Meta WhatsApp Cloud API only. Free-form messages are disabled by
# default because outside the 24-hour service window an approved template is
# mandatory. Put template names on NotificationTemplate rows in Django admin.
WHATSAPP_ACCESS_TOKEN = config("WHATSAPP_ACCESS_TOKEN", default="")
WHATSAPP_PHONE_NUMBER_ID = config("WHATSAPP_PHONE_NUMBER_ID", default="")
WHATSAPP_APP_SECRET = config("WHATSAPP_APP_SECRET", default="")
WHATSAPP_WEBHOOK_VERIFY_TOKEN = config("WHATSAPP_WEBHOOK_VERIFY_TOKEN", default="")
WHATSAPP_API_VERSION = config("WHATSAPP_API_VERSION", default="v23.0")
WHATSAPP_ALLOW_FREEFORM = config("WHATSAPP_ALLOW_FREEFORM", default=False, cast=bool)

# Payment providers are opt-in.  Never add merchant, secret, wallet or webhook
# credentials to Git; use the production environment/secrets manager.
PAYMENT_HTTP_TIMEOUT = config("PAYMENT_HTTP_TIMEOUT", default=10, cast=int)
PAYMENT_CALLBACK_BASE_URL = config("PAYMENT_CALLBACK_BASE_URL", default=SITE_URL).rstrip("/")
PAYMENT_PROVIDER_CONFIG = {
    "zarinpal": {
        "enabled": config("PAYMENT_ENABLE_ZARINPAL", default=False, cast=bool),
        "merchant_id": config("ZARINPAL_MERCHANT_ID", default=""),
        # Catalogue and order integer prices are تومان. Zarinpal's explicit IRT
        # mode therefore avoids a hidden tenfold IRR conversion.
        "currency": "IRT",
        "sandbox": config("ZARINPAL_SANDBOX", default=False, cast=bool),
    },
    "stripe_card": {
        "enabled": config("PAYMENT_ENABLE_STRIPE", default=False, cast=bool),
        "secret_key": config("STRIPE_SECRET_KEY", default=""),
        "publishable_key": config("STRIPE_PUBLISHABLE_KEY", default=""),
    },
    "paypal": {
        "enabled": config("PAYMENT_ENABLE_PAYPAL", default=False, cast=bool),
        "client_id": config("PAYPAL_CLIENT_ID", default=""),
        "client_secret": config("PAYPAL_CLIENT_SECRET", default=""),
    },
    "crypto": {
        "enabled": config("PAYMENT_ENABLE_CRYPTO", default=False, cast=bool),
        "provider_key": config("CRYPTO_PAYMENT_PROVIDER_KEY", default=""),
    },
}

# Upload limits are enforced before media is accepted by visual-search APIs.
VISUAL_SEARCH_MAX_UPLOAD_BYTES = config("VISUAL_SEARCH_MAX_UPLOAD_BYTES", default=5 * 1024 * 1024, cast=int)

# Avatar and storefront imagery limits, validated in the serializer before the
# file is written to storage.
AVATAR_MAX_UPLOAD_BYTES = config("AVATAR_MAX_UPLOAD_BYTES", default=2 * 1024 * 1024, cast=int)
AVATAR_ALLOWED_CONTENT_TYPES = config(
    "AVATAR_ALLOWED_CONTENT_TYPES",
    default="image/jpeg,image/png,image/webp",
    cast=Csv(),
)

# Chat attachments (voice notes, photos and short clips). Limits are enforced
# in shop.attachments before the file is written to storage; the generous video
# ceiling still has to stay under the reverse proxy's own body-size limit.
MESSAGE_ATTACHMENT_MAX_BYTES = {
    "image": config("MESSAGE_IMAGE_MAX_BYTES", default=5 * 1024 * 1024, cast=int),
    "audio": config("MESSAGE_AUDIO_MAX_BYTES", default=10 * 1024 * 1024, cast=int),
    "video": config("MESSAGE_VIDEO_MAX_BYTES", default=25 * 1024 * 1024, cast=int),
}
MESSAGE_ATTACHMENT_CONTENT_TYPES = {
    "image": config(
        "MESSAGE_IMAGE_CONTENT_TYPES",
        default="image/jpeg,image/png,image/webp,image/gif",
        cast=Csv(),
    ),
    "audio": config(
        "MESSAGE_AUDIO_CONTENT_TYPES",
        # webm/ogg are what MediaRecorder produces in Chrome and Firefox;
        # mp4/m4a covers Safari on iOS.
        default="audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/aac,audio/wav",
        cast=Csv(),
    ),
    "video": config(
        "MESSAGE_VIDEO_CONTENT_TYPES",
        default="video/mp4,video/webm,video/quicktime",
        cast=Csv(),
    ),
}

# Optional full-text index. Every search call falls back to the ORM when this is
# disabled, unhealthy, or cannot complete within the small latency budget.
MEILISEARCH_ENABLED = config("MEILISEARCH_ENABLED", default=False, cast=bool)
MEILISEARCH_URL = config("MEILISEARCH_URL", default="http://localhost:7700").rstrip("/")
MEILISEARCH_API_KEY = config("MEILISEARCH_API_KEY", default="")
MEILISEARCH_PRODUCTS_INDEX = config("MEILISEARCH_PRODUCTS_INDEX", default="products")
MEILISEARCH_TIMEOUT_SECONDS = config("MEILISEARCH_TIMEOUT_SECONDS", default=1.5, cast=float)

# Browser Push uses VAPID and the existing durable notification outbox. VAPID
# private material is environment-only and subscriptions are user-controlled.
WEBPUSH_ENABLED = config("WEBPUSH_ENABLED", default=False, cast=bool)
WEBPUSH_VAPID_PUBLIC_KEY = config("WEBPUSH_VAPID_PUBLIC_KEY", default="")
WEBPUSH_VAPID_PRIVATE_KEY = config("WEBPUSH_VAPID_PRIVATE_KEY", default="")
WEBPUSH_VAPID_SUBJECT = config("WEBPUSH_VAPID_SUBJECT", default="mailto:ops@garinkood.ir")

# Deterministic shipping remains available when no verified carrier integration
# is configured. Amounts are in تومان, like the catalogue and Order totals.
SHIPPING_FLAT_RATE = config("SHIPPING_FLAT_RATE", default=45_000, cast=int)
SHIPPING_FREE_THRESHOLD = config("SHIPPING_FREE_THRESHOLD", default=2_000_000, cast=int)

# Operational details are privileged. Staff sessions or a constant-time checked
# bearer token can access readiness/metrics; public liveness reveals one bit.
OPERATIONS_TOKEN = config("OPERATIONS_TOKEN", default="")

# Sentry is completely inert without a DSN. PII remains disabled by default.
SENTRY_DSN = config("SENTRY_DSN", default="")
SENTRY_ENVIRONMENT = config("SENTRY_ENVIRONMENT", default="development" if DEBUG else "production")
SENTRY_TRACES_SAMPLE_RATE = config("SENTRY_TRACES_SAMPLE_RATE", default=0.0, cast=float)
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=SENTRY_ENVIRONMENT,
        integrations=[DjangoIntegration()],
        traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
        send_default_pii=False,
    )
