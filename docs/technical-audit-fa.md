# گزارش فنی، بار و SEO گرین کود

**تاریخ بررسی:** ۲۲ اوت ۲۰۲۶  
**دامنهٔ مرجع در تنظیمات:** `https://garinkood.ir`  
**دامنهٔ بررسی:** کد همین مخزن و یک محیط کنترل‌شدهٔ محلی؛ این گزارش جایگزین مانیتورینگ دامنهٔ واقعی نیست.

## نتیجهٔ تست هم‌زمانی

برای شبیه‌سازی ۱۰۰ بازدیدکنندهٔ مستقل، اسکریپت `scripts/load_test.py` اجرا شد. هر بازدیدکننده یک cookie جدا داشت و در دو مرحلهٔ هم‌زمان این مسیر را طی کرد:

1. دریافت فهرست محصولات، دسته‌بندی‌ها و سبد مهمان
2. افزودن یک محصول موجود به سبد

فرمان اجراشده:

```bash
python scripts/load_test.py --base-url http://127.0.0.1:8000 --users 100 --product-id 1
```

**خروجی ثبت‌شده:**

| شاخص | نتیجه |
|---|---:|
| کاربران مجازی هم‌زمان | ۱۰۰ |
| درخواست‌ها | ۴۰۰ |
| موفق | ۴۰۰ (۱۰۰٪) |
| خطا | ۰ |
| نرخ پردازش | ۱۴۳٫۶ درخواست در ثانیه |
| میانگین پاسخ | ۵۱۳٫۳ ms |
| P50 | ۵۲۵٫۵ ms |
| P95 | ۸۳۱٫۸ ms |
| بیشترین زمان پاسخ | ۱۰۱۸٫۰ ms |
| کدهای پاسخ | ۳۰۰×۲۰۰، ۱۰۰×۲۰۱ |

### تفسیر درست نتیجه

این تست با **یک worker و ۱۰۰ thread از Gunicorn**، SQLite محلی با WAL و دادهٔ نمونه اجرا شده است. پس نشان می‌دهد مسیر کاتالوگ و سبد مهمان در این سناریوی کنترل‌شده خطای 5xx نداشت؛ **تضمین ظرفیت production نیست**. ظرفیت واقعی باید با PostgreSQL، داده و تصاویر واقعی، reverse proxy، TLS، cache و منابع سرور production دوباره اندازه‌گیری شود.

برای تست واقعی production، ابتدا روی staging مجاز با PostgreSQL اجرا و این شاخص‌ها ثبت شود: نرخ 5xx، P95/P99، مصرف CPU/RAM، تعداد اتصال DB، lockهای DB و نرخ پرداخت موفق. اجرای تست بار روی دامنه‌ای که اجازهٔ آن داده نشده مجاز نیست.

## مشکلات پیدا‌شده و اصلاح‌شده

| مورد | اثر | اصلاح انجام‌شده |
|---|---|---|
| پارامترهای واقعی رابط (`category`, `max_price`, `in_stock`) در API نادیده گرفته می‌شدند | فیلترهای فروشگاه نتیجهٔ غلط می‌دادند | `ProductFilter` اضافه شد و تست API برای آن نوشته شد. |
| «فقط موجود» تنها `available=true` می‌فرستاد و کالا با موجودی صفر را حذف نمی‌کرد | امکان نمایش کالای ناموجود | فیلتر `in_stock` با `stock > 0` اضافه شد. |
| مقدار نامعتبر برای تعداد سبد می‌توانست خطای ۵۰۰ بدهد | ورودی خراب یا رفتار غیرقابل پیش‌بینی | اعتبارسنجی عدد صحیح، حداقل تعداد و سقف موجودی اضافه شد. |
| به‌روزرسانی پروفایل بدون UserAccount می‌توانست متغیر تعریف‌نشده داشته باشد | خطای ۵۰۰ هنگام تغییر نام/ایمیل | به‌روزرسانی اتمیک و اعتبارسنجی قبل از ذخیره پیاده‌سازی شد. |
| مسیر تصویر جایگزین وجود نداشت | 404 تصویر و تجربهٔ بد | مسیر جایگزین واقعی `hero-farm.jpg` در API و تمام کامپوننت‌ها استفاده شد. |
| جزئیات محصول فقط modal بود و URL قابل crawl نداشت | ایندکس ضعیف محصول و لینک‌پذیری ضعیف | مسیر `/products/:slug`، لینک واقعی کارت محصول و canonical/metadata سمت client اضافه شد. |
| لینک `/products` به 404 می‌رسید | ناوبری شکسته | مسیر legacy به صفحهٔ کاتالوگ redirect شد و queryهای `category`/`featured` خوانده می‌شوند. |
| وضعیت Compare modal نادیده گرفته می‌شد | modal حتی پیش از درخواست کاربر باز می‌شد | prop `isOpen` به modal افزوده شد. |
| TypeScript build شکست می‌خورد | نسخهٔ production قابل ساخت نبود | خطاهای strict TypeScript رفع شد. |
| Django با `DEBUG=True`، `ALLOWED_HOSTS=*` و CORS باز طراحی شده بود | ریسک امنیتی production | تنظیمات محیطی محدود، DEBUG پیش‌فرض خاموش، Host/CORS/CSRF allowlist و security headers اضافه شد. |
| localhost در redirect ریشهٔ API hard-code شده بود | redirect خراب خارج از لپ‌تاپ توسعه‌دهنده | `FRONTEND_URL` محیطی جایگزین شد. |
| SQLite در تست هم‌زمانی guest cart lock می‌شد | خطای ۵۰۰ در توسعه/بارسنجی محلی | timeout، WAL و صف نوشتن SQLite فقط برای توسعه افزوده شد؛ production باید PostgreSQL باشد. |

## وضعیت SEO انجام‌شده

- title، description، canonical، robots، Open Graph و Twitter card فارسی در `index.html`
- JSON-LD برای `Organization` و `WebSite`
- `robots.txt` و `site.webmanifest` در frontend
- endpointهای `robots.txt` و sitemap پویا در Django؛ محصولات منتشرشده و دسته‌ها در sitemap قرار می‌گیرند
- صفحهٔ جزئیات محصول با H1 و مسیر یکتا
- fallbackهای تصویر و `alt` محصول
- یک H1 معنایی در صفحهٔ فروشگاه
- مسیرهای `/products?category=...` و `/products?featured=true` قابل استفاده‌اند

## کارهای ضروریِ باقی‌مانده (اولویت‌بندی‌شده)

### P0 — قبل از پذیرش سفارش واقعی

1. **Checkout، سفارش، پرداخت و موجودی رزرو نشده‌اند.** اکنون دکمهٔ «تسویه حساب و پرداخت» به `/checkout` می‌رود اما چنین flow و endpointی وجود ندارد. باید مدل‌های Order/OrderItem، آدرس، هزینهٔ ارسال، تراکنش، callback امن درگاه، idempotency، رزرو/کاهش اتمیک stock و تست پرداخت ساخته شوند. تا آن زمان عبارت «پرداخت امن» و «گارانتی ۷۲ ساعت» نباید ادعای قطعی باشد.
2. **PostgreSQL در production اجباری شود.** SQLite برای توسعه خوب است، نه فروشگاه پرترافیک و چند worker. مقادیر `DB_ENGINE=postgresql` و اطلاعات DB در `.env` production لازم هستند.
3. **secret و متغیرهای production را تنظیم کنید.** `SECRET_KEY` واقعی، `DEBUG=False`، `ALLOWED_HOSTS`، `CORS_ALLOWED_ORIGINS`، `CSRF_TRUSTED_ORIGINS` و HTTPS باید قبل از deploy بررسی شوند.
4. **آپلود تشخیص آفت و درخواست اقساط فعلاً شبیه‌سازی هستند.** دکمه‌ها پیام موفقیت می‌دهند اما API/فایل/پیگیری واقعی ندارند؛ این باید یا پیاده‌سازی یا با برچسب «به‌زودی» شفاف شود.

### P1 — کیفیت فروشگاه و SEO

1. **دادهٔ محصول ناقص است.** UI امتیاز `۴٫۵`، برند «گرین کود» و crop tag خالی را به‌صورت ثابت تولید می‌کند. در مدل فعلی brand، rating، تعداد review، crop tag، مشخصات کاربردی، تخفیف و دادهٔ واقعی review وجود ندارد. به همین دلیل فیلتر انتخاب محصول کشاورزی در عمل پیشنهاد معنادار ندارد. این فیلدها باید به مدل/serializer/admin افزوده و با دادهٔ واقعی پر شوند.
2. **SSR یا prerender برای SEO سطح بالا لازم است.** metadata صفحهٔ محصول پس از اجرای JavaScript تغییر می‌کند. برای پوشش بهتر crawlerها و سرعت LCP، صفحات محصول را با SSR/prerender یا HTML سمت Django/Nuxt/Next تولید کنید. بعد از deploy، sitemap را در Google Search Console و Bing Webmaster ثبت کنید.
3. **مسیرهای باقی‌ماندهٔ UI کامل نیستند.** profile links مانند سفارش‌ها، علاقه‌مندی‌ها و تنظیمات صفحهٔ مقصد کامل ندارند. مجله، درباره و تماس نیز محتوای قابل ایندکس ندارند. یا پیاده‌سازی شوند یا از ناوبری حذف بمانند.
4. **دسته‌بندی‌ها و تصاویر واقعی:** برای هر دسته، تصویر، description، heading و محتوای یکتای SEO ایجاد کنید؛ از صفحه‌های thin/تکراری پرهیز کنید.
5. **جستجوی صوتی:** fallback فعلی یک عبارت تصادفی درج می‌کند؛ بهتر است وقتی مرورگر پشتیبانی نمی‌کند، پیام شفاف نشان دهد و متن ساختگی وارد نکند.

### P2 — عملیات و کیفیت پایدار

- CI اضافه کنید: `python manage.py test shop`، `npm run type-check` و `npm run build` در هر PR.
- Sentry/مانیتورینگ، health check، structured logs، alert نرخ 5xx و metrics برای DB/latency اضافه کنید.
- cache برای کاتالوگ و دسته‌ها (Redis/CDN)، image resize/WebP/AVIF و lazy loading واقعی در production اضافه کنید.
- برای API rate limiting، محدودیت ثبت‌نام/login، captcha و سیاست پاک‌سازی session/cart در نظر بگیرید.
- برای frontend deploy، reverse proxy باید fallback SPA داشته باشد؛ نمونهٔ Nginx: `try_files $uri $uri/ /index.html;`. مسیرهای `/api/`، `/media/`، `/robots.txt` و `/sitemap.xml` باید طبق معماری deploy به backend route شوند.

## کنترل‌های عبورکرده

```text
Django check:           PASS
Django tests:           PASS (6 tests)
TypeScript type-check:  PASS
Vite production build:  PASS
100 virtual visitors:   PASS (400/400 requests)
```
