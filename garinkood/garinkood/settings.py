"""Django settings for the GarinKood API."""

from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

# Never use the development defaults in a deployed environment.  The checked-in
# .env.example documents every value that has to be set for production.
SECRET_KEY = config("SECRET_KEY", default="django-insecure-local-development-only")
DEBUG = config("DEBUG", default=False, cast=bool)
SITE_URL = config("SITE_URL", default="https://garinkood.ir").rstrip("/")
FRONTEND_URL = config("FRONTEND_URL", default=SITE_URL).rstrip("/")
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
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "django_filters",
    "django.contrib.humanize",
    "django.contrib.postgres",
    "shop.apps.ShopConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
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
DB_ENGINE = config("DB_ENGINE", default="sqlite")
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
# multi-worker deployment must set CACHE_URL to a shared Redis/Memcached so the
# limits are enforced globally rather than per worker.
CACHE_URL = config("CACHE_URL", default="")
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

LANGUAGE_CODE = "fa-ir"
TIME_ZONE = "Asia/Tehran"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
SHOP_STATIC_DIR = BASE_DIR / "shop" / "static"
STATICFILES_DIRS = [SHOP_STATIC_DIR] if SHOP_STATIC_DIR.exists() else []

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "products"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
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
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
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

# Payment providers are opt-in.  Never add merchant, secret, wallet or webhook
# credentials to Git; use the production environment/secrets manager.
PAYMENT_PROVIDER_CONFIG = {
    "zarinpal": {
        "enabled": config("PAYMENT_ENABLE_ZARINPAL", default=False, cast=bool),
        "merchant_id": config("ZARINPAL_MERCHANT_ID", default=""),
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
