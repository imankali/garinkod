# گرین کود — معماری سیستم (ARCHITECTURE)

> **هدف این سند:** قفل کردن دانش فنی حاصل از چهار پروتکل مهندسی پیاپی (پایپ‌لاین تصویر جهانی، سپر پرفورمنس محلی، نرمال‌سازی رسانه، و پایه‌های تست) به‌شکلی که هر مهندس تازه در ۳۰ دقیقه بفهمد *چرا* هر قطعه این‌طور است — نه فقط *چیستی* آن را.
>
> **دامنه:** بک‌اند `garinkood/` (Django 5.2 + DRF 3.17) و فرانت‌اند `frontend/` (React + TypeScript + Vite). وضعیت سند با کدِ شاخه‌ی `arena/01a07995-garinkod` سازگار است.

---

## ۰. نمای کلان

```
مرورگر (React SPA, فارسی RTL)
   │    /api/* , /media/* , /static/*
   ▼    (در dev از طریق vite dev/preview proxy — همان‌مبدأ/Zero-CORS)
Vite (build + preview)  ──proxy──▶  Django API :8000
                                       │ model ↔ DB (sqlite لوکال / postgres در deploy)
                                       │ FileSystemStorage (local) یا S3 (در صورت تنظیم)
                                       ▼
                              garinkood/media/  ← نرمال‌شده؛ صاحب همه‌ی فایل‌ها
```

| لایه | فناوری‌های کلیدی | نقش در این معماری |
|---|---|---|
| مدل/داده | Django ORM، `ImageVariantsMixin`، `simple_history`، `import_export` | یک فیلد JSON (`image_variants`) کنار هر ImageField — **بدون** رابطه‌ی تازه |
| API | DRF، drf-spectacular، django-filter | serializerها `image_srcset` را به شکل آماده‌ی `<picture>` بیرون می‌دهند |
| پایپ‌لاین تصویر | Pillow ۱۲ (custom) | تولید AVIF/WebP زمان آپلود، بدون وابستگی خارجی |
| فرانت‌اند | React + react-router، react-query، zustand، framer-motion، Tailwind | `<picture>` با fallback امن؛ RTL ذاتی؛ PWA-capable |
| سپر کیفیت | Lighthouse CI (`@lhci/cli`)، Playwright (+axe) | گیت‌های **محلی و ترمینالی** — بدون توکن/سرور بیرونی |

---

## ۱. تصمیمات کلیدی — `ImageVariantsMixin` و اقتصادِ DRY

### ۱.۱ مسئله
سه مدل تصویر-محور داریم: `Product` (کاتالوگ)، `ProductImage` (گالری)، `MarketplaceListing` (بازار). هر سه به یک قرارداد دقیقاً یکسان نیاز دارند: «وقتی تصویر عوض شد، واریانت‌های ریسپانسیو بساز/به‌روز کن؛ به serializer یک دیکشنری srcset بده؛ هیچ‌وقت از داخل `save()` خطا بیرون نزن.»

### ۱.۲ تصمیم: یک میکسین انتزاعی، نه سه پیاده‌سازی
`shop/models/mixins.py::ImageVariantsMixin(models.Model, abstract)` همه‌ی آن قرارداد را یک‌جا نگه می‌دارد:

| عضو | نقش |
|---|---|
| `image_variants` (JSONField, غیرقابل‌ویرایش) | محفظه‌ی srcsetها در DB؛ قالبش دقیقاً همان `ImageSrcset` فرانت‌اند است |
| `image_source_field` (پیش‌فرض `"image"`) | نقطه‌ی تزریق: مدلی که نام فیلدش متفاوت است فقط همین یک ثابت را override می‌کند |
| `_image_has_changed()` | **قبل** از نوشتن DB اجرا می‌شود تا تشخیص دهد فیلد واقعاً عوض شده (گران‌ترین ضدبیهودگی: جلوگیری از بازسازی CPU بر سر هر save روتین) |
| `_refresh_image_variants()` | **بعد** از `super().save()` (یعنی وقتی فایل اصلی در storage قفل شده) واریانت‌ها را می‌سازد و یتیم‌های تصویر قبلی را حذف می‌کند |
| `get_image_srcset()` / `image_url` | قرارداد یکدست برای serializerها |

### ۱.۳ چرا این تصمیم درست است (شاهد مهندسی، نه ترجیح)
۱. **اثبات Schema-neutrality:** وقتی میکسین بعداً به `MarketplaceListing` افزوده شد، مهاجرت `0035` **فقط ۲ `AddField`** بود (Product/ProductImage که از قبل فیلد داشتند، هیچ تغییری ندیدند) → افزودن قرارداد به یک مدل چهارم در *صفر* خط لاجیک و یک مهاجرت تک‌فیلدی تمام می‌شود.
۲. **تضاد با تله‌ی جانبی:** خودِ `save()`های مدل‌ها کوچک مانده‌اند (مثلاً `Product.save` فقط منطق `brand_slug` + دو فراخوان میکسین را دارد). خوانایی مدل حفظ شد و DRf-side رفتار تغییری ندید.
۳. **نقطه‌ی تعمیر واحد:** نرمال‌سازی AVIF-less-Pillow، حذف واریانت‌های یتیم، و باگ‌زداییِ هر به‌روزرسانی srcset دقیقاً **در یک فایل** اتفاق می‌افتد — اصل DRY نه به‌عنوان شعار، بلکه به‌عنوان کاهشِ سطح انفجار.

> **گِت‌چای حفظ‌شده برای آینده:** `image_srcset` در serializerها باید به‌عنوان `SerializerMethodField` **اعلان** شود؛ قرار دادن نامش صرفاً در `Meta.fields` با وجود متد `get_image_srcset` کافی نیست و ViewSet را با `ImproperlyConfigured` سقوط می‌دهد (۵۰۰). این درس از یک خطای واقعی جلساتی قبل به سند راه یافت.

---

## ۲. پایپ‌لاین تصویر — از آپلود تا `<picture>`

### ۲.۱ تولید واریانت (`shop/image_pipeline.py`)
به‌محض ذخیره‌ی یک تصویر جدید، `generate_image_variants(source_file, name)` اجرا می‌شود:

| پارامتر | مقدار | دلیل |
|---|---|---|
| `TARGET_WIDTHS` | `(480, 768, 1024)` | پوشش موبایل/تبلت/دسکتاپ بدون تولید فایل redundant برای عرض‌های بزرگ‌تر از منبع (فقط downscale) |
| `QUALITY` | `avif: 80, webp: 85` | نقطه‌ی تعادل حجم/کیفیتِ تأییدشده در رندر واقعی |
| محل ذخیره | `<upload-dir>/resized/` کنار فایل اصلی | فایل اصلی **هیچ‌وقت بازنویسی نمی‌شود** |
| نام‌گذاری | `<stem>-<width>.<fmt>` (قطعی) | stem از نامِ دی‌داپ‌شده‌ی storage می‌آید ⇒ برخورد نام بین محصولات با فایل هم‌نام غیرممکن است |
| AVIF | **اختیاری‌بودن** طراحی‌شده | اگر بیلد Pillow بدون libavif باشد، فقط warning می‌خورد و خروجی WebP+fallback را می‌دهد — save هرگز شکست نمی‌خورد |

خروجی — دقیقاً همان قالبی که SPA مصرف می‌کند:

```json
{
  "avif": "/media/marketplace/resized/x-480.avif 480w, /media/…-768.avif 768w, …",
  "webp": "/media/…-480.webp 480w, …",
  "fallback": "/media/marketplace/x.jpg",
  "widths": [480, 768, 1024],
  "formats": ["avif", "webp"]
}
```

سلسله‌مراتب حذف امن: تعویض تصویر → `_refresh_image_variants` نسخه‌های **قدیمی** (از JSON قبلی) را با `delete_image_variants` پاک می‌کند — best-effort و بدون raise، تا رکوردهای نیمه‌کاره پسماند نسازند.

### ۲.۲ قرارداد با فرانت‌اند
- Serializerها یک فیلد `image_srcset = SerializerMethodField()` عرضه می‌کنند (Marketplace + Product + Gallery).
- فرانت‌اند آن را مستقیم به `<source type="image/avif" srcSet=…>` و `<source type="image/webp" srcSet=…>` می‌دهد و `` با `width`/`height` صریح + `loading="lazy"` (گریدها) / `fetchPriority="high"` (hero گالری).
- `sizes` تعریف‌شده در کارت‌ها: `(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 320px` — در گالری: `(max-width: 768px) 100vw, 60vw`.

### ۲.۳ ری‌هیدراته‌ی تاریخی — `backfill_image_variants`
داده‌های قبل از پایپ‌لاین فاقد JSON srcset بودند؛ فرمان مدیریتی آن‌ها را بدون حذف/بازآپلود منبع بازیابی می‌کند:

```bash
python manage.py backfill_image_variants            # --dry-run پیش‌فرض
python manage.py backfill_image_variants --execute  # اعمال واقعی
python manage.py backfill_image_variants --model listing --limit 50 --force
```

| رفتار | توضیح |
|---|---|
| فیلترها | `--model product|listing|gallery`، `--limit` برای پردازش موجی، `--force` برای بازسازی JSON موجود |
| رعایت idempotency | رکوردی که از قبل `image_variants` دارد «رد شده» شمرده می‌شود؛ تکرار فرمان بی‌اثر است |
| per-record isolation | شکست یک رکورد با `self.style.WARNING` ثبت شده و ادامه پیدا می‌کند؛ خروجی نهایی `CommandError` اگر اشتباه > ۰ |
| هشدار فارسی داخلی | اگر ساختار دیسک مسیر دوتاییِ تاریخی داشت، در خروجی خودفرماند می‌داد — ناهنجاری‌ای که پروتکل بعدی ریشه‌کن کرد (بخش ۴) |

> **این فرمان encode نمی‌کند؛ صف می‌سازد.** `_refresh_image_variants()` تنها یک
> `OutboxTask` از نوع `process_image` ثبت می‌کند و srcset کهنه را پاک می‌کند؛ نه
> encode واقعی را ورکر (`process_async_tasks`) انجام می‌دهد. خلاصه‌ی فرمان زمانی
> «پردازش‌شده» می‌گفت در حالی که هیچ `.avif` ساخته نشده بود — و همین جمله‌ی
> گمراه‌کننده باعث شد پوشش AVIF در CI عملاً خالی بماند در حالی که سبز گزارش
> می‌شد. اکنون خروجی «در صف قرار گرفت» می‌گوید و دستور بعدی را نام می‌برد، و
> `shop/tests_outbox_resilience.py::BackfillReportsTruthfullyTests` همان جمله را
> قفل می‌کند.
>
> ترتیب درست — و هر دو لازم‌اند:
>
> ```bash
> python manage.py backfill_image_variants --model product   # ۱. صف
> python manage.py backfill_image_variants --model gallery   # ۱. صف
> python manage.py process_async_tasks --limit 500           # ۲. encode
> ```

---

## ۳. سپرهای دفاعی پرفورمنس — بودجه‌ی عددی، نه حس خوب داشتن

داور نهایی این پروژه دو ابزارِ **صرفاً ترمینالی-محلی** است؛ هیچ توکن توسعه‌دهنده یا داشبورد خارجی در چرخه نیست.

### ۳.۱ Lighthouse CI — `frontend/lighthouserc.cjs`
روی **باندِ تولید** (`npm run build` + `vite preview` پورت 4173؛ proxy به Django :8000) و با پروفایل **موبایلِ پیش‌فرض Lighthouse** (سخت‌گیرانه‌ترین لایه، جایی که ادعای RTL و لِیزی‌بار کردن مهم است) با `numberOfRuns: 3` و داوری روی میانه اجرا می‌شود:

| گیت | آستانه (ERROR = توقف) | چه چیزی را قفل می‌کند |
|---|---|---|
| `categories:performance` | ≥ 0.9 | سقف کلان امتیاز |
| `largest-contentful-paint` | ≤ 2500ms | hero eager + srcset درست |
| `cumulative-layout-shift` | **= 0 (دقیق)** | `width/height` صریح در همه‌ی `<img>`‌ها |
| `total-blocking-time` | ≤ 200ms | عدم انفجار جاوااسکریپت بالای فولد |
| `modern-image-formats` | ERROR | واقعاً AVIF/WebP سرو شده |
| `uses-responsive-images` | ERROR | srcset با ابعاد نمایش هم‌خوان است |
| `unsized-images` | ERROR | بدون تصویرِ بدون ابعاد |
| `categories:accessibility` | ≥ 0.9 (به‌همراه قواعد `color-contrast`/`heading-order`/`image-alt`/`label`) | کف WCAG |
| `best-practices` / `seo` | ≥ 0.9 (WARN) | سرویس هشدار، نه توقف |

گزارش‌ها محلی‌اند و در `frontend/.lighthouseci/` (gitignored) می‌نشینند. دسکتاپ نیز به‌صورت اتختیاری قابل اجراست: `npm run test:perf:desktop` (همان کانفیگ با overrideِ `settings.preset = desktop`).

### ۳.۲ Playwright — `frontend/e2e/`
پیکربندی فعلی **۲۱۵ تست در ۸ فایل** را enumerate می‌کند (عدد قابل‌استناد؛ هنگام آغاز کار، یک خطای Syntaxِ قدیمی در `public-routes.spec.ts` کل مجموعه را ۰ نگه داشته بود و اصلاح آن نخستین Fix شد). سه گروه مستقیماً مربوط به این معماری:

| فایل | نقش در سپر (نمونه‌های مشخص) |
|---|---|
| `performance-and-images.spec.ts` | ۵ تست مسئله‌محور: دست‌کم یک پاسخ `.avif` با HTTP 200 واقعی از شبکه‌ی مرورگر در `/products`؛ CLS با `PerformanceObserver` نصب‌شده **قبل** از hydrate (`addInitScript`) با آستانه ≤ 0.01 (صفرِ دقیق در LHCI باقی است)؛ گرید ۱-ستون در 375px و ≥۲-ستون در 768px با هندسه‌ی `boundingBox`؛ `dir="rtl"` + `lang="fa"` و `computed direction` روی `<main>` |
| `accessibility.spec.ts` | اسکن axe با برچسب‌های `wcag2a/aa` و `wcag21a/aa` روی صفحات شامل `/products` و `/products/<slug>/` (گالری)، قطعِ جریان روی نقض‌های serious/critical، پیوست JSON خروجی در ریپورت |
| `responsive.spec.ts` | چیدمان و ناوبری تعاملی |

دستورهای یکپارچه (`frontend/package.json`):

```bash
npm run test:perf        # build + lhci autorun (موبایل)
npm run test:e2e         # playwright (webServer خودش preview را بالا می‌آورد)
npm run test:all         # LHCI && E2E — اگر اولی قرمز شود دومی اصلاً اجرا نمی‌شود
```

> **محدودیت مستندشده‌ی محیط توسعه‌ی Sandbox فعلی:** CDNهای باینری مرورگر Playwright از محیط جاری قابل‌دسترس نیستند (`Download failure, code=1`)؛ روی ماشین محلی توسعه‌دهنده `npx playwright install chromium` ساده کار می‌کند. کانفیگ‌ها راستی‌آزماییِ لود شدند و healthcheck محیط را دقیقاً در «Chrome not found» تشخیص می‌دهد.

### ۳.۳ job سراسری e2e — `.github/workflows/django.yml`

همان job هم backend را می‌آزماید و هم سفرهای مرورگر را. آنچه ترتیبش اهمیت دارد:

| مرحله | چرا به همین ترتیب |
|---|---|
| `migrate` → `seed_locations` → `seed_agri_inputs` → `seed_test_catalog` → `seed_demo_marketplace` → `seed_test_community` → `seed_site_content` → `seed_faq_page` → `seed_legal_pages` | seed جامعه تا وقتی کاتالوگ و بازار نساخته شده‌اند اجرا نمی‌شود، چون پست/آگهی/دیدگاه‌هایش به ردیف‌های هر دو وابسته‌اند |
| `bootstrap_management_roles` → ساخت حساب `e2e-moderator` | بدون bootstrap سطح ۳، کنسول نظارت ورود را رد می‌کند؛ بدون `E2E_MODERATOR_USERNAME`/`E2E_MODERATOR_PASSWORD` آن تست‌ها **skip** می‌شوند نه fail — یعنی پوشش بی‌صدا از دست می‌رود |
| `backfill_image_variants` (product, gallery) → `process_async_tasks` | بخش ۲.۳: اول صف، بعد encode. اجرای اولی بدون دومی، job را سبز و srcset را خالی می‌گذارد |
| `E2E_IMAGE_PIPELINE: "1"` روی step پلی‌رایت | کلیدِ قرارداد AVIF سمت مرورگر. بدون آن `performance-and-images.spec.ts` هیچ renditionsی مطالبه نمی‌کند و تست عملاً پوشش نمی‌دهد |

`E2E_IMAGE_PIPELINE` یک **تعهد** است نه یک پیشنهاد: وقتی `1` باشد و هیچ پاسخ `.avif`
با HTTP 200 از `/media/` نرسد، تست fail می‌شود. پس فقط جایی روشنش کنید که seed +
backfill + worker واقعاً اجرا شده‌اند.

---

## ۴. یکپارچگی داده — نرمال‌سازی `media/` به‌عنوان ضدِ بدهی فنی

### ۴.۱ علت ریشه‌ای ناهنجاری
ترکیبِ ناجوار `MEDIA_ROOT = BASE_DIR/"products"` + `upload_to="products/"` دیسک را به‌شکل `garinkood/products/products/…` می‌ساخت. چون `MEDIA_URL = "/media/"` نام ریشه را از مرورگر پنهان می‌کند، این بو فقط برای اپراتور دیسک بود — ناهنجاریِ بی‌صدا، ولی بدهی فنیِ واقعی.

### ۴.۲ درمان بدون شکستن داده
۱. `MEDIA_ROOT = BASE_DIR / "media"` (ریشه‌ی خنثا) + `LEGACY_MEDIA_ROOT` گذرا برای مهاجرت.
۲. فرمان `normalize_media_paths` با قرارداد ایمنی per-record (الگوی مشخص و پیاده‌شده): تشخیص سکونت در ریشه‌ی قدیمی → عدم وجود مبدأ = WARNING → **عدم بازنویسی مقصد** (conflict نگه می‌دارد و اجرای بعدی را پیوند می‌دهد) → `shutil.move` (در فایل‌سیستم یکسان: rename اتمیک؛ بین‌دیسکی: copy2+unlink) → به‌روزرسانی DB **فقط وقتی نام خودش ناهنجار است** (برای این آنومالی: صفر همیشه) → هرس پوشه‌های خالی + گزارش یتیم‌ها برای ممیزی دستی.
۳. نتیجه‌ی تأییدشده در عمل: ۱۵ فایل جابه‌جا شد، ۰ تغییر DB، ۰ خطا، ریشه‌ی قدیمی حذف، اجرای دوم کاملاً idempotent، و ۴ URL عمومی (اصلی + AVIF + WebP گالری) با 200 از ریشه‌ی جدید.

### ۴.۳ پاسگاه ماندگار — `media_layout_check`
به‌جای امید: یک system check جنگو (`shop.W200`) که هر زمان `upload_to`یی با basenameِ MEDIA_ROOT شروع شود، Warning می‌اندازد — تله‌ی دقیقِ منجر به دوباره‌زایی همین بدهی. مهاجرت اجرا و ریشه پاک می‌شود، اما پاسگاه **دائمی** می‌ماند. تست‌های `shop/tests_media_layout.py` (۷ مورد) سکوت روی پیکربندی سالم و برخاست Warning روی پیکربندی بد را قفل کرده‌اند، و رفتار عدم‌بازنویسیِ مقصد و ایدمپوتنسیِ فرمان را روی یک استوریج موقتی (tempfile) که دقیقاً شرایط حادثه را بازسازی می‌کند، آزموده‌اند.

> **ماتریس تأیید نهایی این ۴ ستون:** بک‌اند 402/402 سبز (۱۵۷s) — frontend `tsc --noEmit` = 0 خطا — `eslint` = Silent-pass — `vite build` ≈ ۶.۴s — Playwright enumerate = 215 تست/۸ فایل — LHCI config = Valid + filesystemReports.

---

## ۵. چیت‌شیت اجرای محلی (برای هر مهندس تازه)

```bash
# بک‌اند
cd garinkood && DEBUG=True DB_ENGINE=sqlite SECRET_KEY=dev python manage.py migrate
DEBUG=True DB_ENGINE=sqlite SECRET_KEY=dev python manage.py runserver :8000      # API + /media

# فرانت‌اند
cd frontend && npm i
npm run build && npm run preview        # پورت 4173 با proxy به :8000 → http://localhost:4173

# گیت‌های کیفیت (همه محلی)
python manage.py test shop              # 583 backend tests
npm run test:unit                       # 158 unit/integration tests (بدون مرورگر)
npm run test:all                        # LHCI + playwright
npm run test:perf:desktop               # نسخه‌ی دسکتاپ LHCI
```

| متغیر محیطی کلیدی | معنا |
|---|---|
| `DB_ENGINE` | `sqlite` لوکال / `postgresql` در deploy |
| `MEDIA_STORAGE_BACKEND` | `local` (پیش‌فرض) / `s3` (با channel تنظیمات جدا) |
| `PLAYWRIGHT_BASE_URL` | اورراید مبدأ تست‌های E2E (پیش‌فرض: preview خودکار 5173) |
| `E2E_IMAGE_PIPELINE` | `1` یعنی renditionهای AVIF وعده داده شده‌اند و نبودشان خطاست |
| `E2E_MODERATOR_USERNAME` / `E2E_MODERATOR_PASSWORD` | حساب سطح ۳ برای کنسول نظارت؛ بدون آن تست‌ها skip می‌شوند |

---

## ۶. قرارداد CSRF — کوکی‌ای که سرور باید بدهد تا بتواند بخواهدش

مرورگر با کوکیِ HttpOnly توکن (`garinkood_auth`) احراز هویت می‌شود و
`shop.authentication.CookieTokenAuthentication` برای هر درخواست ناایمن
(POST/PUT/PATCH/DELETE) توکن CSRF مطالبه می‌کند — درست، چون اعتبارِ ambient
دقیقاً همان چیزی است که CSRF در برابرش محافظت می‌کند. اما **هیچ endpointی آن
کوکی را صادر نمی‌کرد**: جنگو فقط وقتی `csrftoken` را می‌نویسد که جایی
`get_token()` صدا زده شود، و هیچ view از DRF قالب `{% csrf_token %}` رندر
نمی‌کند.

نتیجه‌ای که روی سرورِ در حال اجرا اندازه‌گیری شد:

```console
$ curl -c jar -X POST .../api/auth/register/ …      → 201، تنها کوکی: garinkood_auth
$ curl -b jar -X POST .../api/marketplace/storefront/ …
  {"code":"permission_denied","status":403,"error":"شما اجازه دسترسی به این بخش را ندارید."}
```

یعنی **هر نوشتنِ مرورگرِ واردشده ۴۰۳ می‌گرفت** — سبد خرید، پرداخت، پیام، ساخت
غرفه. و چون پاکت خطا `fields` نداشت، فرم هم چیزی برای نمایش نداشت؛ تنها
سطحِ خطای برنامه یک toast زودگذر بود و اگر interceptor آن را هندل کرده بود،
فرم **کاملاً ساکت** می‌ماند. ده تست e2e دقیقاً همین را گزارش می‌کردند:
«the stall was not created — the form said nothing».

چرا ۵۷۹ تست backend سبز بود و این را ندید: کلاینت تست جنگو به‌صورت پیش‌فرض
CSRF را خاموش می‌کند، و `APIRequestFactory` اصلاً به لایه‌ی کوکی نمی‌رسد.

درمان، دو نیمه:

1. `garinkood/middleware.py::IssueCsrfCookieMiddleware` — بعد از
   `CsrfViewMiddleware` در `MIDDLEWARE` می‌نشیند و `get_token(request)` را صدا
   می‌زند، تا میدل‌ور بالا کوکی را در پاسخ بنویسد. محافظت دست‌نخورده است:
   بدون هدر ۴۰۳، با هدرِ غلط هم ۴۰۳.
2. `StorefrontForm` خطای بدون-فیلد را داخل خود فرم با `role="alert"` نشان
   می‌دهد. فرمی که دلیل شکستش را نمی‌گوید هم باگ UX است هم باگ a11y.

پاسگاه‌ها: `shop/tests_security.py::CsrfCookieIssuedTests` (کوکی صادر می‌شود، و
یک مرورگرِ واردشده با **فقط کوکی‌هایی که سرور خودش داده** می‌تواند غرفه بسازد)
و `src/pages/StorefrontCreateJourney.test.tsx` (سفر کامل در jsdom). هر دو با
برداشتنِ درمان قرمز می‌شوند — آزموده شد.

---

*تهیه‌شده در پروتکل یادآوری-محورِ «ARCHITECTURE LOCKDOWN»؛ نیمه‌ی اولِ نقشه‌ی سه‌فازی (۱ از ۳).*
