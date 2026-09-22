# ممیزی باگ‌های runtime سایت گرین‌کود

**تاریخ بررسی:** ۲۲ سپتامبر ۲۰۲۶
**دامنه:** پیش‌نمایش زندهٔ همین workspace، API واقعی با SQLite داده‌دار، کد frontend/backend و تست‌های موجود

## خلاصه

دو باگ واقعی در محیط preview پیدا و اصلاح شدند:

1. ورود در iframe ممکن بود موفق اعلام شود، اما درخواست بعدی به‌دلیل cookie/CSRF دوباره بی‌نام یا 403 باشد.
2. چند کلیک هم‌زمان روی افزودن آگهی به سبد، در SQLite گاهی هنگام serialize کردن سبد به `500 database table is locked` تبدیل می‌شد.

بعد از اصلاح، ورود از مسیر Vite proxy، session، CSRF با Origin از دامنهٔ preview و تست concurrent cart همگی بررسی شدند.

## یافته‌ها

| اولویت | وضعیت | نشانه | علت | اصلاح/اقدام |
|---|---|---|---|---|
| P0 برای preview | اصلاح شد | login پاسخ `200` می‌داد ولی `/auth/session/` بعدی `401` می‌شد | `GK_PREVIEW_IFRAME_COOKIES` خاموش بود و iframe cookie را نگه نمی‌داشت | API با flag روشن اجرا شد؛ response اکنون `preview_token` و cookieهای `SameSite=None; Secure` دارد |
| P0 برای preview | اصلاح شد | درخواست‌های unsafe از Origin دامنهٔ preview، مثل cart/profile/checkout، `403` می‌گرفتند | `CSRF_TRUSTED_ORIGINS` فقط localhost را می‌شناخت | در `settings.py`، فقط وقتی preview flag و DEBUG روشن است، `https://*.e2b.app` به trusted origins اضافه می‌شود |
| P1 توسعه/SQLite | اصلاح شد | concurrent `/api/cart/add-listing/` در زمان ساخت response با `500` و `database table is locked: shop_cartitem` دیده شد | write با lock انجام می‌شد اما `CartSerializer` بعد از خروج از lock دوباره CartItemها را می‌خواند | serialize پاسخ داخل همان SQLite process lock انجام می‌شود؛ تست اکنون هر ۴ پاسخ را بررسی می‌کند و 5xx را silently قبول نمی‌کند |
| P1 قرارداد API | اصلاح شد | schema generation قبلاً ۱۳ warning و ۲۰ error گزارش می‌کرد | APIView/function viewها serializer صریح نداشتند، دو `ProductSummary` همنام وجود داشت و `legal_retrieve` collision داشت | serializer/annotation صریح، نام componentهای bounded-context، guard برای anonymous queryset و operationId مشخص اضافه شد؛ اکنون schema با صفر warning و صفر error تولید می‌شود |
| P2 production config | باز، محیطی | `check --deploy` دربارهٔ DEBUG، SECRET_KEY، HSTS و SSL redirect هشدار می‌دهد | اجرای فعلی development است | قبل از deploy باید secret واقعی، `DEBUG=False`، TLS termination و HSTS طبق محیط production تنظیم شوند |
| P2 عملیات | باز، محیطی | warning مربوط به نبود `staticfiles/` و خالی بودن `OPERATIONS_TOKEN` | سرور فعلی برای preview با collectstatic/ops token اجرا نشده است | در deployment pipeline، `collectstatic` و token/monitoring واقعی تنظیم شوند |

## بررسی‌های انجام‌شده

### API و proxy

endpointهای عمومی‌ای که صفحهٔ خانه، کاتالوگ و marketplace مصرف می‌کنند با دادهٔ seed شده پاسخ موفق داشتند:

- `/api/categories/`
- `/api/products/`
- `/api/products/facets/`
- `/api/marketplace/storefronts/`
- `/api/marketplace/storefronts/featured/`
- `/api/marketplace/listings/`
- `/api/marketplace/posts/`
- `/api/articles/`
- `/api/agri/inputs/`
- `/api/locations/`
- `/api/site/contact/`
- `/api/site/policies/`
- `/api/legal/`
- `/api/pages/`
- `/api/hero-slides/`
- `/api/cart/`

همهٔ موارد بالا در اجرای فعلی `200` دادند. ورود و session هم از خود Vite proxy بررسی شد و هر دو `200` بودند.

### تست‌ها

```text
manage.py test shop                                      PASS (۵۹۹ تست)
manage.py spectacular --validate                         PASS (۰ warning، ۰ error)
ListingConcurrencyTests.test_concurrent_cart_additions   PASS
npm run test:unit                                       PASS (۲۲۴ تست)
npm run build                                           PASS (۲۶۱۲ ماژول)
```

تست‌های Playwright هنوز نتیجهٔ functional قابل اتکا ندادند، چون executable مرورگر در workspace نصب نبود و دانلود آن با خطای شبکه قطع شد:

```text
browserType.launch: Executable doesn't exist
npx playwright install chromium -> ECONNRESET
```

بنابراین بررسی واقعی رفتار بصری، mobile layout و axe در این نوبت با browser قابل نتیجه‌گیری نیست؛ این مورد failure سایت محسوب نمی‌شود و باید در محیطی با Chromium/Firefox/WebKit نصب‌شده دوباره اجرا شود.

## نتیجهٔ اجرایی

نسخهٔ فعلی برای مشاهدهٔ preview آماده است و مشکل ورود/کوکی، خطای concurrent cart و warning/errorهای schema قرارداد API اصلاح شده‌اند. مهم‌ترین کار بعدی برای محیط واقعی، اجرای Playwright روی runner دارای browser است؛ سپس باید production security checks با تنظیمات واقعی deployment اجرا شوند.
