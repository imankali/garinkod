# گرین کود (GarinKood)

پلتفرم فارسی و RTL برای فروش نهاده‌های کشاورزی، بازار غرفه‌داران، خدمات مزرعه و پیگیری سفارش؛ با **Django 5.2 + Django REST Framework** و **React + TypeScript + Vite**.

> اتصال‌های بیرونی این مخزن به‌صورت امن و پیش‌فرض غیرفعال‌اند. وجود کد یک درگاه، پیام‌رسان، object storage یا موتور جستجو به معنی فعال بودن سرویس واقعی نیست؛ فعال‌سازی فقط پس از تنظیم secret، آزمون sandbox و تأیید سمت ارائه‌دهنده انجام می‌شود.

## قابلیت‌های اصلی

- فروشگاه، فیلتر و جستجو، سبد مهمان/کاربر، کوپن و checkout اتمیک
- سفارش، رزرو و بازگردانی موجودی، تاریخچه وضعیت و پیگیری مرسوله
- بازار غرفه‌داران، آگهی، پست/استوری، دنبال‌کردن، گفت‌وگو و تسویه ثبت‌شده
- ورود با کوکی HttpOnly، رمز عبور یا OTP موبایل، محدودسازی نرخ و قفل brute-force با Axes
- صندوق پیام داخلی و outbox پایدار برای SMS، بله، تلگرام، WhatsApp و Web Push
- پنل مدیریت نقش‌محور، audit log کسب‌وکار، تاریخچه انتخابی و import/export کنترل‌شده
- داده مرجع استان/شهر، تقویم مزرعه، درخواست مشاوره و ماشین‌حساب دوز
- PWA مبتنی بر Workbox، cache محدود، نصب‌پذیری و اعلان مرورگر چنددستگاهی
- SEO مسیر/محصول، canonical و JSON-LD، sitemap/robots، صفحات حریم خصوصی و شرایط
- health/readiness، Prometheus، JSON logging و Sentry اختیاری

## وضعیت اتصال‌های اختیاری

| قابلیت | وضعیت کد | شرط بهره‌برداری واقعی |
|---|---|---|
| Zarinpal v4 (IRT) | چرخه request/verify و replay-safe پیاده‌سازی شده، خاموش | Merchant ID، HTTPS callback و آزمون موفق sandbox/production |
| ارسال | نرخ ثابت و fulfillment دستی فعال | هیچ carrier زنده‌ای بدون قرارداد و مستند رسمی ادعا نشده است |
| Meilisearch | رتبه‌بندی اختیاری با fallback خودکار ORM | کلید/API سالم، sync index و Waffle flag `external_search` |
| Web Push | VAPID + outbox + مالکیت per-browser | VAPID معتبر، worker و Waffle flag `web_push` |
| S3-compatible media | backend اختیاری | bucket/IAM/CORS/lifecycle/backup تأییدشده |
| Sentry | backend و frontend اختیاری، PII پیش‌فرض خاموش | DSN پروژه و سیاست retention تأییدشده |
| آمار بازدید | Plausible-compatible و فقط پس از رضایت | تنظیم build و Waffle flag `privacy_analytics` |
| SMS/بله/تلگرام/WhatsApp | providerهای رسمی در Messaging Hub | credential، template/webhook و آزمون تحویل واقعی |

Stripe، PayPal و رمزارز در registry فقط به‌عنوان گزینه‌های **غیرفعال و پیاده‌نشده** نمایش داده می‌شوند و checkout آن‌ها را فعال تلقی نمی‌کند.

## پیش‌نیازها

- Python 3.11 یا 3.12
- Node.js 22 و npm
- SQLite برای توسعه ساده؛ PostgreSQL 16 و Redis برای production/multi-worker

## شروع سریع

### Backend

```bash
cd garinkood
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_locations
python manage.py seed_agri_inputs
python manage.py bootstrap_management_roles
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

فایل نمونه برای توسعه از SQLite استفاده می‌کند. برای production همه مقادیر نمونه و placeholderها را با secret/config واقعی جایگزین کنید.

Worker پیام‌های پایدار باید جدا از web process اجرا شود:

```bash
python manage.py process_notifications --watch
```

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev -- --host 0.0.0.0
```

در توسعه، Vite درخواست‌های `/api`، `/media` و `/static` را به Django روی پورت 8000 proxy می‌کند. در production نیز reverse proxy باید همین مسیرهای same-origin را مسیریابی کند.

- فروشگاه: `http://localhost:5173`
- API: `http://localhost:8000/api/`
- مدیریت: `http://localhost:8000/admin/`
- OpenAPI/Swagger: `/api/docs/` (فقط نشست staff)
- liveness عمومی: `/health/live/`
- readiness محافظت‌شده: `/ops/health/ready/`
- metrics محافظت‌شده: `/ops/metrics/`

## کنترل کیفیت

```bash
# Backend
cd garinkood
DB_ENGINE=sqlite DEBUG=True python manage.py check
DB_ENGINE=sqlite DEBUG=True python manage.py makemigrations --check --dry-run
DB_ENGINE=sqlite DEBUG=True python manage.py spectacular --validate --file /tmp/openapi.yml
DB_ENGINE=sqlite DEBUG=True python manage.py test shop

# Frontend
cd ../frontend
npm run type-check
npm run lint
npm run build
npm audit
```

Production باید علاوه بر SQLite روی PostgreSQL آزموده شود، چون row lock و partial unique constraint رفتار متفاوتی دارند. قالب‌های تعمیرشده CI هر دو backend را پوشش می‌دهند؛ به‌دلیل محدودیت permission اپ GitHub، روش فعال‌سازی آن‌ها در `ci/README.md` ثبت شده است.

## deployment خلاصه

1. image/dependencyهای pin‌شده را build و audit کنید.
2. PostgreSQL backup بگیرید و migration را ابتدا در staging اجرا کنید.
3. `python manage.py check --deploy --fail-level WARNING` را با env واقعی اجرا کنید.
4. `collectstatic` و build فرانت‌اند را تولید کنید.
5. web process و notification worker را با health/restart policy مستقل بالا بیاورید.
6. reverse proxy را برای TLS، `/api`، `/admin`، `/static` و `/media` تنظیم کنید.
7. readiness و metrics را فقط با staff session یا `OPERATIONS_TOKEN` مانیتور کنید.
8. هر اتصال خارجی را جداگانه با sandbox/test destination فعال و سپس Waffle rollout کنید.

جزئیات rollback، backup، monitoring و rotation در [راهنمای عملیات](docs/operations-runbook.md) و تنظیم providerها در [راهنمای integrationها](docs/integrations.md) آمده است.

## ساختار مهم

```text
garinkood/                 Django project
  garinkood/settings.py    security, database and optional integration config
  shop/                    commerce, marketplace, messaging and operations
  .env.example             backend configuration reference
frontend/                  React/Vite application
  src/                     pages, components, API contracts and stores
  public/push-sw.js        Push event helper imported by generated Workbox SW
  .env.example             public build-time settings (never secrets)
docs/                      architecture, product and operations documentation
ci/workflows/              repaired CI awaiting activation by a maintainer
```

## امنیت و داده

- secretها فقط در environment/secret manager؛ متغیرهای `VITE_*` عمومی‌اند.
- endpointهای Push، token احراز هویت و credential ارائه‌دهندگان نباید log شوند.
- گزارش آسیب‌پذیری را عمومی منتشر نکنید؛ آن را خصوصی به maintainer مخزن ارسال کنید.
- متن‌های حقوقی داخل محصول باید پیش از عرضه هر کشور توسط مسئول حقوقی همان حوزه بازبینی شوند.

## مستندات تکمیلی

- [Messaging Hub و OTP](docs/messaging-hub.md)
- [راهنمای عملیات و انتشار](docs/operations-runbook.md)
- [اتصال‌های اختیاری و هزینه عملیاتی](docs/integrations.md)
- [مرکز فرمان مدیریت](docs/management-command-centre-fa.md)
- [استانداردهای UI/UX](docs/ui-ux-standards-fa.md)

## مجوز

این مخزن در حال حاضر فایل مجوز صریح ندارد؛ پیش از توزیع یا استفاده تجاری، مالک پروژه باید مجوز مناسب را تعیین کند.
