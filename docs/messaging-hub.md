# مرکز پیام‌رسانی و ورود با موبایل

این قابلیت جایگزین بومی افزونه‌های پیام‌رسان ووکامرس است و مستقیماً روی Django/React کار می‌کند. هیچ وابستگی به WordPress، WhatsApp Web، QR code یا session scraping ندارد.

## معماری

دو مسیر عمداً از هم جدا هستند:

1. **OTP تعاملی:** کاربر منتظر کد است؛ ارسال مستقیم با timeout کوتاه انجام می‌شود. کد خام فقط در حافظه است، در پایگاه‌داده hash می‌شود و پس از مصرف قابل استفاده مجدد نیست.
2. **پیام‌های تجاری:** checkout فقط یک ردیف در outbox پایدار `NotificationDelivery` می‌سازد. worker جداگانه شبکه را صدا می‌زند، پس قطعی تلگرام/بله/SMS/واتساپ هرگز درخواست ثبت سفارش را منتظر نمی‌گذارد.

رویداد سفارش و outbox در یک transaction ثبت می‌شوند. بنابراین سفارش rollback‌شده پیام ندارد و سفارش commit‌شده صف پایدار دارد. کلید یکتای event/channel/recipient از ساخت دوباره یک alert جلوگیری می‌کند.

## کانال‌ها و APIهای رسمی

| کانال | استفاده | API |
|---|---|---|
| SMS.ir | OTP و پیام تراکنشی | `api.sms.ir/v1/send/verify` و `send/bulk` |
| Kavenegar | OTP و پیام تراکنشی جایگزین | REST `verify/lookup` و `sms/send` |
| بله | OTP/ارسال به شماره با Safir؛ پیام مدیر با Bot API | `safir.bale.ai/api/v3/send_message` و Bot API |
| تلگرام | پیام مدیر | Telegram Bot API `sendMessage` |
| واتساپ | قالب رسمی و status webhook | Meta WhatsApp Cloud API |

برای واتساپ، خارج از پنجره خدمات ۲۴ ساعته باید نام یک template تأییدشده Meta در `NotificationTemplate.provider_template_name` قرار گیرد. ارسال free-form به‌طور پیش‌فرض خاموش است.

## راه‌اندازی

ترتیب deploy پیشنهادی:

```bash
python manage.py check --deploy
python manage.py migrate
python manage.py bootstrap_management_roles
python manage.py collectstatic --noinput
python manage.py process_notifications --watch --interval 3 --limit 100
```

متغیرهای کامل در `garinkood/.env.example` مستند شده‌اند. در production حتماً `CACHE_URL` را به Redis مشترک همه web workerها وصل کنید تا cooldown و محدودیت per-phone قابل دور زدن نباشد. اگر Django Admin روی origin جداست، `ADMIN_PUBLIC_URL` را روی origin عمومی و HTTPS آن قرار دهید. حداقل یک کانال OTP را فعال کنید:

### SMS.ir

```dotenv
MESSAGING_ENABLE_SMS=True
SMS_PROVIDER=smsir
SMSIR_API_KEY=...
SMSIR_OTP_TEMPLATE_ID=123456
SMSIR_OTP_PARAMETER=Code
SMSIR_LINE_NUMBER=3000...
OTP_DELIVERY_CHANNELS=sms,bale
```

### Kavenegar

```dotenv
MESSAGING_ENABLE_SMS=True
SMS_PROVIDER=kavenegar
KAVENEGAR_API_KEY=...
KAVENEGAR_OTP_TEMPLATE=garinkood-login
KAVENEGAR_SENDER=1000...
```

### بله

```dotenv
MESSAGING_ENABLE_BALE=True
BALE_SAFIR_API_KEY=...
BALE_SAFIR_BOT_ID=123456789
BALE_BOT_TOKEN=...
NOTIFICATION_ADMIN_BALE_CHAT_IDS=123456789
```

اگر بله فقط برای alert مدیریتی است و Safir/OTP ندارید، `bale` را از `OTP_DELIVERY_CHANNELS` حذف کنید. برای ارسال Safir به شماره در پنل گیرندگان، مقصد را به شکل `phone:09123456789` وارد کنید؛ مقصد عادی بله یک chat id است.

### تلگرام

```dotenv
MESSAGING_ENABLE_TELEGRAM=True
TELEGRAM_BOT_TOKEN=123456:...
NOTIFICATION_ADMIN_TELEGRAM_CHAT_IDS=123456789,-1001234567890
```

بات باید قبلاً به chat/channel اضافه شده و اجازه ارسال داشته باشد.

### WhatsApp Cloud API

```dotenv
MESSAGING_ENABLE_WHATSAPP=True
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_APP_SECRET=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=a-long-random-value
WHATSAPP_API_VERSION=v23.0
WHATSAPP_ALLOW_FREEFORM=False
NOTIFICATION_ADMIN_WHATSAPP_NUMBERS=09123456789
```

Callback رسمی Meta:

```text
https://YOUR-DOMAIN/api/messaging/webhooks/whatsapp/
```

Webhook challenge با verify token و POSTها با `X-Hub-Signature-256` و app secret بررسی می‌شوند. statusهای `sent`، `delivered`، `read` و `failed` به تاریخچه ارسال منتقل می‌شوند.

برای قالب پیش‌فرض «سفارش جدید» پارامترهای body به این ترتیب فرستاده می‌شوند:

1. کد سفارش
2. نام مشتری
3. مبلغ کل
4. وضعیت سفارش

برای «تغییر وضعیت» ترتیب پارامترها کد سفارش و سپس وضعیت است. قالب Meta باید دقیقاً با همین تعداد متغیر تأیید شده باشد. برای قالب آزمایشی پارامتری ارسال نمی‌شود.

## پنل مدیریت

در Django Admin سه بخش وجود دارد:

- **قالب‌های پیام‌رسانی:** متن هر event/audience/channel، فعال/غیرفعال بودن و نام template رسمی provider؛
- **گیرندگان پیام مدیریتی:** مقصد و eventهای مورد نظر؛
- **صف و تاریخچه ارسال:** وضعیت، تعداد تلاش، provider message id، پاسخ پاک‌سازی‌شده و آخرین خطا.

قالب‌های استاندارد با migration ساخته می‌شوند و از پنل قابل ویرایش‌اند. متغیرهای پشتیبانی‌شده:

```text
{order_code} {customer_name} {customer_phone} {customer_phone_full}
{email} {address} {postal_code} {notes} {items}
{subtotal} {shipping_price} {discount_amount} {total_price}
{province} {city} {status} {status_label}
{payment_status} {payment_status_label} {payment_method_label} {admin_url}
```

شماره پیش‌فرض در متن alert ماسک شده است؛ اطلاعات کامل فقط پشت لینک احراز هویت‌شده admin دیده می‌شود. متغیرهای `customer_phone_full`، `address` و `notes` فقط برای حالتی هستند که مالک آگاهانه یک کانال خصوصی و مورد اعتماد را انتخاب کند. secretهای provider هیچ‌وقت در admin یا database ذخیره نمی‌شوند.

برای تست، گیرنده‌ها را انتخاب و action «قرار دادن پیام آزمایشی در صف ارسال» را اجرا کنید؛ سپس نتیجه را در تاریخچه ببینید. action تلاش مجدد فقط ردیف‌های failed/retry را reset می‌کند و پیام sent را دوباره نمی‌فرستد.

فرمت مقصدها:

- Telegram/Bale Bot: chat id؛
- Bale Safir: `phone:09123456789`؛
- SMS/WhatsApp: شماره ایران به صورت `09…` یا E.164 (در زمان اعتبارسنجی canonical می‌شود).

## پیام تغییر وضعیت برای مشتری

به‌طور پیش‌فرض خاموش است. کانال‌های مورد نظر را فعال کنید:

```dotenv
NOTIFICATION_CUSTOMER_STATUS_CHANNELS=sms,bale,whatsapp
```

این گزینه فقط بعد از تغییر واقعی `Order.status` یا `payment_status` پیام می‌سازد. تلگرام مشتری بدون نگاشت امن chat id پشتیبانی نمی‌شود.

## اجرای worker در production

نمونه systemd (مسیرها و user را با سرور تطبیق دهید):

```ini
[Unit]
Description=GarinKood messaging outbox worker
After=network.target postgresql.service

[Service]
Type=simple
User=garinkood
WorkingDirectory=/srv/garinkood/garinkood
EnvironmentFile=/etc/garinkood/garinkood.env
ExecStart=/srv/garinkood/.venv/bin/python manage.py process_notifications --watch --interval 3 --limit 100
Restart=always
RestartSec=5
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

چند worker می‌توانند هم‌زمان اجرا شوند؛ هر ردیف قبل از شبکه به حالت processing claim می‌شود. claimهای رهاشده بعد از `NOTIFICATION_WORKER_STALE_SECONDS` بازیابی می‌شوند. retry با backoff نمایی تا `NOTIFICATION_MAX_ATTEMPTS` انجام می‌شود.

APIهایی مثل Telegram Bot API idempotency سمت provider ندارند؛ outbox از enqueue تکراری جلوگیری می‌کند، ولی در crash بسیار نادر بین پذیرش provider و ثبت پاسخ، semantics ناگزیر **at-least-once** است. Bale Safir علاوه بر آن `request_id` خود delivery را برای deduplication دریافت می‌کند.

## امنیت OTP

- فقط موبایل ایران پذیرفته و ارقام فارسی/عربی، `09…`، `+98…` و `0098…` canonical می‌شوند؛
- hash salted کد ذخیره می‌شود، نه کد خام؛ hash پس از مصرف/ابطال نیز غیرقابل‌استفاده می‌شود؛
- TTL، cooldown، سقف تلاش، throttle مستقل IP و محدودیت مستقل per-phone وجود دارد؛
- صدور کد جدید، challenge قبلی همان شماره را منقضی می‌کند؛
- پاسخ request وجود/عدم وجود حساب را افشا نمی‌کند؛
- اولین شماره تأییدشده حساب passwordless با username غیرمشتق از شماره می‌سازد؛
- verification همان cookie امن HttpOnly ورود کلاسیک را صادر می‌کند؛
- login نام کاربری/رمز عبور برای سازگاری باقی مانده است.

`OTP_RETURN_DEBUG_CODE=True` فقط همراه `DEBUG=True` اثر دارد؛ آن را در محیط اشتراکی یا production فعال نکنید. `MESSAGING_FAKE=True` نیز فقط برای تست خودکار/محیط محلی ایزوله است.

## پایش

روی این موارد alert بگذارید:

- رشد ردیف‌های `pending/retry` قدیمی؛
- هر ردیف `failed`؛
- تکرار خطاهای 401/403 provider (secret یا permission اشتباه)؛
- افزایش throttleهای `otp_request` و `otp_verify`؛
- توقف process worker.

کلیدها را در secret manager نگه دارید، دوره‌ای rotate کنید و هرگز داخل `.env.example`، Git، template یا delivery payload نگذارید.
