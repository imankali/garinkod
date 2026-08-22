# گزارش تست هم‌زمان پلتفرم — ۲۲ اوت ۲۰۲۶

## اصول تست

این تست با **کاربران مجازی** در محیط کنترل‌شدهٔ محلی اجرا شد؛ هیچ مشتری واقعی، درگاه پرداخت خارجی یا دادهٔ production استفاده نشد. هر کاربر cookie/token مستقل داشت. تست ظرفیت production محسوب نمی‌شود و باید روی staging دارای PostgreSQL، reverse proxy، TLS و دادهٔ واقعی تکرار شود.

## ایراد کشف‌شده و اصلاح‌شده پیش از اجرای نهایی

### لغو سفارش موجودی را برنمی‌گرداند

در بررسی lifecycle سفارش مشخص شد که سفارش‌های `awaiting_review` موجودی را رزرو می‌کنند، اما لغو امن و idempotent برای آزادسازی آن وجود نداشت.

**اصلاح:**

- متد اتمیک `Order.cancel_and_restore_stock()` افزوده شد.
- فقط سفارش unpaid در وضعیت `awaiting_review` یا `confirmed` قابل لغو است.
- موجودی محصولات بازگردانده می‌شود.
- conversion و ledger pending affiliate به `rejected/reversed` تغییر می‌کند.
- API `POST /api/orders/cancel/` و دکمه لغو در صفحه سفارش اضافه شد.
- Action مربوطه برای Admin نیز اضافه شد.

## سناریوی اول: ۱۰۰ کاربر عمومی هم‌زمان

فرمان:

```bash
python scripts/platform_load_test.py \
  --base-url http://127.0.0.1:8000 \
  --users 100 \
  --product-id 1
```

هر کاربر این جریان را طی کرد:

1. کاتالوگ، دسته‌بندی، وضعیت روش‌های پرداخت، AI facts و سبد را باز کرد.
2. محصول را به سبد افزود.
3. درخواست مشاوره/خدمت ثبت کرد.
4. درخواست فروش محصول کشاورزی ثبت کرد.
5. بازخورد ثبت کرد.
6. سفارش با روش هماهنگی ثبت کرد.

| شاخص | نتیجه |
|---|---:|
| کاربران مجازی | ۱۰۰ |
| درخواست‌ها | ۱٬۰۰۰ |
| پاسخ موفق | ۱٬۰۰۰ (۱۰۰٪) |
| خطا | ۰ |
| نرخ پردازش | ۱۴۱٫۸ درخواست بر ثانیه |
| میانگین پاسخ | ۵۰۶٫۸ms |
| P50 | ۴۵۴٫۵ms |
| P95 | ۱۱۲۹٫۰ms |
| بیشترین زمان | ۲۱۹۶٫۷ms |
| وضعیت‌ها | ۵۰۰×۲۰۰، ۵۰۰×۲۰۱ |

مسیرهای پوشش‌داده‌شده: products، categories، payments/options، ai-facts، cart، cart/add، services/requests، procurement/requests، feedback و orders/checkout.

## سناریوی دوم: ۱۰۰ فروشنده/همکار فروش هم‌زمان

برای هر کاربر آزمایشی token مستقل ساخته شد و سپس این جریان هم‌زمان اجرا شد:

1. ساخت حساب affiliate
2. ساخت غرفه
3. ثبت آگهی برای بررسی
4. مشاهده داشبورد affiliate
5. مشاهده دفتر مالی غرفه
6. مشاهده آگهی‌های خود

فرمان:

```bash
python scripts/authenticated_platform_load_test.py \
  --base-url http://127.0.0.1:8000 \
  --tokens-file /path/to/disposable-test-tokens.json
```

| شاخص | نتیجه |
|---|---:|
| کاربران مجازی | ۱۰۰ |
| درخواست‌ها | ۶۰۰ |
| پاسخ موفق | ۶۰۰ (۱۰۰٪) |
| خطا | ۰ |
| نرخ پردازش | ۱۰۳٫۷ درخواست بر ثانیه |
| میانگین پاسخ | ۶۵۴٫۸ms |
| P95 | ۹۷۸٫۳ms |
| بیشترین زمان | ۱۲۹۰٫۱ms |
| وضعیت‌ها | ۳۰۰×۲۰۰، ۳۰۰×۲۰۱ |

مسیرهای پوشش‌داده‌شده: affiliate/me، marketplace/storefront، marketplace/listings، marketplace/listings/mine و marketplace/finance.

## کنترل‌های دیگر

```text
Django tests:           PASS (13 tests)
Django system check:    PASS
TypeScript type check:  PASS
Vite production build:  PASS
Public API load test:   PASS (100/100 users)
Authenticated load test: PASS (100/100 users)
```

## مواردی که این تست عمداً فعال نکرد

- زرین‌پال، Stripe، PayPal و Crypto: external providerها تا credential، sandbox، request/verify/webhook و reconciliation واقعی فعال نمی‌شوند.
- پرداخت و تسویه واقعی فروشنده: marketplace order، escrow، KYC/KYB و dispute کامل نشده‌اند.
- مدل واقعی جستجوی تصویر: صف request تست می‌شود، اما inference ساختگی نمایش داده نمی‌شود.
- ظرفیت production: SQLite محلی و یک Gunicorn worker معیار نهایی production نیستند.
