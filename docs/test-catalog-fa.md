# کاتالوگ تستی فروشگاه 🧪

این راهنما توضیح می‌دهد چطور روی لپ‌تاپ خودت دیتای تستی کامل سایت را بالا بیاوری و همه بخش‌ها را تست کنی.

## ۰. از صفر روی لپ‌تاپ (راهنمای کامل)

پیش‌نیازها: **Python 3.11 یا 3.12**، **Node.js 22** (حداقل ۱۸)، **Git**. دیتابیس پیش‌فرض **SQLite** است و چیزی لازم ندارد؛ Redis، مدل AI، Meilisearch و بقیه سرویس‌ها برای توسعه لازم نیستند.

```powershell
# ۱. گرفتن کد (اولین بار) — یا اگر قبلا کلون کردی فقط fetch + checkout
git clone https://github.com/imankali/garinkod.git
cd garinkod
git fetch origin
git checkout arena/01a0871a-garinkod
git pull

# ۲. بک‌اند: محیط مجازی + نصب پکیج‌ها
cd garinkood
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements-dev.txt

# ۳. همه سیدها به ترتیب (migrate + لوکیشن + نهاده + محتوا + حقوقی + بازار + کاتالوگ + اجتماعی + تصاویر)
cd ..
.\scripts\load_test_catalog.ps1
# اگر پاورشل اسکریپت را بلاک کرد، یک بار در همان پنجره:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# ۴. ساخت مدیر (برای /management و /farmers که سطح ۶+ می‌خواهند)
cd garinkood
python manage.py createsuperuser

# ۵. اجرای بک‌اند (ترمینال ۱ — باز بماند)
python manage.py runserver 0.0.0.0:8000

# ۶. فرانت‌اند (ترمینال ۲ — جدا، از ریشه مخزن)
cd frontend
npm ci
Copy-Item .env.example .env.local   # فقط بار اول
npm run dev -- --host 0.0.0.0
# فروشگاه: http://localhost:5173/products
```

> اگر از Git Bash یا WSL استفاده می‌کنی، همان دستورات با سینتکس bash است: `source .venv/bin/activate` و `./scripts/load_test_catalog.sh`.

**اتصال به پستگرس قدیمی (اختیاری):** اگر به‌جای SQLite می‌خواهی به همان Postgres لپ‌تاپت وصل شوی، قبل از مرحله ۳ در فایل `garinkood/.env` این‌ها را بگذار (درایورش با requirements نصب می‌شود، چیز اضافه لازم نیست):

```ini
DB_ENGINE=postgresql
DB_NAME=garinkood
DB_USER=postgres
DB_PASSWORD=رمز-خودت
DB_HOST=localhost
DB_PORT=5432
```

لودر همین را می‌خواند و روی پستگرس migrate/seed می‌کند. اگر دیتابیس قدیمی schema کهنه دارد و migrate خطا داد، تمیزترین راه ساخت یک دیتابیس خالی جدید و عوض کردن `DB_NAME` است. برای تست تمیز روزانه همان SQLite پیشنهاد می‌شود (با پاک کردن `garinkood/db.sqlite3` از نو شروع می‌کنی).

## ۱. بالا آوردن با یک دستور

```bash
# لینوکس / مک / WSL — از ریشه مخزن
./scripts/load_test_catalog.sh

# ویندوز (PowerShell) — از ریشه مخزن
.\scripts\load_test_catalog.ps1
```

پیش‌نیاز فقط نصب پکیج‌های بک‌اند است:

```bash
cd garinkood
pip install -r requirements-dev.txt
```

اسکریپت بالا این کارها را انجام می‌دهد:

| مرحله | دستور | نتیجه |
|---|---|---|
| migrate | `manage.py migrate` | ساخت جدول‌ها (پیش‌فرض SQLite) |
| لوکیشن/نهاده/محتوا | `seed_locations` / `seed_agri_inputs` / `seed_site_content --with-landing` | استان/شهر، دوز کود و سم، خدمات و صفحات |
| حقوقی/نقش‌ها | `seed_legal_pages` / `seed_faq_page` / `bootstrap_management_roles` | ۸ صفحه حقوقی، سوالات متداول، گروه‌های مدیریتی |
| بازار | `seed_demo_marketplace` | ۵ غرفه + ۷ آگهی + پست/استوری |
| **کاتالوگ تستی** | **`seed_test_catalog`** | **۶ دسته + ۲۴ زیردسته + ۳۲ محصول + ۸ برچسب + ۲ کوپن + پروفایل نهاده/ماشین‌آلات** |
| **بخش‌های اجتماعی** | **`seed_test_community`** | **۶ مقاله، میز خدمت، شکایت، مزرعه، سفارش (جزئیات: بخش ۲-ب)** |
| تصاویر | `process_async_tasks --limit 200` | ساخت نسخه‌های AVIF/WebP |

> دستور `seed_test_catalog` کاملا **idempotent** است: هر چند بار اجرایش کنی، رکورد تکراری ساخته نمی‌شود و ویرایش‌های فایل دیتا روی رکوردهای قبلی اعمال می‌شود.

## ۲. چه چیزی ساخته می‌شود؟

فایل دیتا: `garinkood/shop/data/test_catalog.py` (تک‌منبع دیتای تستی — با ویرایش آن و اجرای مجدد دستور، کاتالوگ عوض می‌شود)

| بخش (slug) | نام فارسی | محصولات | نکته |
|---|---|---|---|
| `pesticide` | سموم دفع آفات | ۵ | علف‌کش، قارچ‌کش، حشره‌کش، کنه‌کش + ۱ قلم عمده (تماس بگیرید) |
| `fertilizer` | کود کشاورزی | ۵ | اوره، NPK، هیومیک، ریزمغذی، کلات آهن (نزدیک انقضا) |
| `seed` | بذر و نهال | ۵ | بذر گلخانه‌ای/زراعی/صیفی + ۲ نهال (یکی ناموجود) |
| `equipment` | ادوات کشاورزی | ۷ | ۲ سمپاش، فیلتر، ست هرس، تیلر + دیسک استعلامی + تراکتور |
| `irrigation` | آبیاری | ۵ | تیپ، آبپاش، پمپ، شیر + ۱ قلم ناموجود |
| `tools` | ابزار باغبانی | ۵ | قیچی، ست باغچه، لباس کار، کودپاش دستی، کیت پیوند |

موارد خاص برای تست سناریوهای لبه‌ای:

- ⭐ **۸ محصول ویژه** (`is_featured`) → صفحه اصلی و `/api/products/featured/`
- 🏷️ **تخفیف‌دارها** (۵ تا ۳۰٪) → فیلتر `has_discount` و قفسه تخفیف
- 📦 **ناموجودها**: نهال پسته اکبری (`stock=0`) و کیت قطره‌چکان (`available=False`) → فیلتر `in_stock`
- 📞 **تماس بگیرید**: پاراکوات عمده و دیسک هرس (`price_on_request`) → دکمه تماس به‌جای افزودن به سبد
- ⏳ **نزدیک انقضا**: کلات آهن (۴۵ روز) و تری‌فورین (۸۰ روز) → فیلتر `expiring_soon` (تاریخ‌ها نسبی‌اند و کهنه نمی‌شوند)
- ⚖️ **فروش فله**: اوره، گندم، پاراکوات (`min_order_quantity` + `bulk_note`)
- 📐 **چندبسته‌ای**: اوره، گلایفوزیت، بذر گوجه، گندم → انتخاب بسته در صفحه محصول
- 💬 **۱۲ دیدگاه** با امتیاز → ستاره‌ها، فیلتر `min_rating`، صفحه «تجربه خرید مشتریان»
- 🚜 **۱۳ پروفایل نهاده + ۲ پروفایل ماشین‌آلات** → endpointهای `/api/inputs/fertilizers|pesticides|seeds|seedlings/` و `/api/machinery/tractors|implements/`
- 🎟️ **کوپن‌ها**: `TEST10` (۱۰٪ تا سقف ۲۰۰ هزار) و `WELCOME50` (۵۰ هزار ثابت)

## ۲-ب. دیتای تستی بخش‌های اجتماعی (مقاله، غرفه، پشتیبانی، شکایت…)

فایل دیتا: `garinkood/shop/data/test_community.py` — سیدر: `seed_test_community` (خودکار بعد از کاتالوگ و مارکت‌پلیس در لودر اجرا می‌شود؛ مستقل هم قابل اجراست)

| بخش | چه ساخته می‌شود؟ |
|---|---|
| 📰 مقاله‌ها | ۶ مقاله منتشرشده (۳ راهنمای کشت با سرفصل/فهرست + ۳ خبر و نکته)، ۲ ویژه، محصول و آگهی مرتبط، مقالات مرتبط |
| 🏪 غرفه‌ها | دنبال‌کردن (۲ غرفه)، ۱ هایلایت + ۶ پست/استوری، ۱ آگهی و ۱ پست در انتظار تأیید (برای تست مدیریت) |
| 💬 میز خدمت | ۲ کارشناس (`poshtiban` پشتیبانی، `moshaver` مشاوره)، ۱۰ پاسخ آماده، ۴ گفت‌وگو: پشتیبانی باز، مشاوره باز، چانه‌زنی غرفه، یک بسته‌شده با امتیاز |
| 📝 شکایت و بازخورد | ۳ شکایت (نو / در حال بررسی / حل‌شده با لینک سفارش و آگهی) + ۴ بازخورد (پیشنهاد، باگ، تحسین، سؤال) |
| 🌱 مزرعه من | ۲ زمین (گلخانه + باغ با مشخصات کامل)، ۳ رویداد تقویم، ۲ درخواست مشاوره (یکی پاسخ‌داده‌شده) |
| 🧾 سفارش‌ها | ۲ سفارش برای `demo-buyer`: یکی ارسال‌شده با مرسوله و رهگیری، یکی در انتظار بررسی با کوپن `TEST10` |
| 👥 درباره و تماس | ۳ عضو تیم با عکس، ۵ برند (هم‌نام برندهای کاتالوگ)، تلفن/ایمیل/ساعت کاری، سیاست مرجوعی ۷روزه |
| 💰 مالی | ۱ تراکنش فروش برای غرفه باغ سبز (قابل مشاهده در پنل مالی فروشنده)، ۳۰۰ امتیاز وفاداری خریدار |

حساب‌های تستی (رمز همه: `demo-12345`):

| کاربر | نقش | برای تست |
|---|---|---|
| `demo-buyer` | خریدار | سفارش‌ها، کیف پول، گفت‌وگوها، دنبال‌کردن |
| `demo-farmer` | کشاورز | مزرعه من، تقویم، مشاوره، گفت‌وگوی بسته با امتیاز |
| `poshtiban` | کارشناس پشتیبانی (سطح ۵) | صف میز پشتیبانی در `/messages` |
| `moshaver` | کارشناس مشاوره (سطح ۵) | صف میز مشاوره در `/messages` |
| `bagh-sabz` و ۴ فروشنده دیگر | غرفه‌دار | پنل مالی، آگهی‌های من، چانه‌زنی |

> پنل مشاور (`/farmers`)، داشبورد مدیریت (`/management`) و کنسول نیازمند سطح ۶+ است؛ روی لپ‌تاپ با `createsuperuser` یک مدیر بساز و با آن وارد شو.

## ۳. اجرای سایت بعد از سید

```bash
# ترمینال ۱ — بک‌اند
cd garinkood
python manage.py runserver 0.0.0.0:8000

# ترمینال ۲ — فرانت‌اند
cd frontend
npm ci
npm run dev -- --host 0.0.0.0
```

- فروشگاه: http://localhost:5173/products
- محصول نمونه: http://localhost:5173/products/glyphosate-41-1l
- دسته نمونه: http://localhost:5173/c/fertilizer
- برند نمونه: http://localhost:5173/brand/kymya-sbz (اسلاگ فارسی برند «کیمیا سبز»)
- برچسب نمونه: http://localhost:5173/tag/greenhouse
- بازار: http://localhost:5173/marketplace
- API خام: http://localhost:8000/api/products/?category=fertilizer

## ۴. چک‌لیست تست همه بخش‌ها

- [ ] مگامنو بالای سایت هر ۶ دسته را نشان می‌دهد و زیرمنوها (۲۴ زیردسته) باز می‌شوند
- [ ] صفحه `/products` با فیلتر دسته، برند، بازه قیمت، «فقط موجود» و «تخفیف‌دار» درست فیلتر می‌شود
- [ ] جستجو (مثلا «اوره» یا «پمپ») نتیجه مرتبط برمی‌گرداند
- [ ] صفحه محصول: گالری، جدول مشخصات، انتخاب بسته، ویدیو (سمپاش موتوری)، دیدگاه‌ها و امتیاز
- [ ] افزودن به سبد (مهمان و کاربر)، تغییر تعداد، حداقل سفارش فله
- [ ] ثبت سفارش با کوپن `TEST10` و پیگیری سفارش
- [ ] صفحات `/c/fertilizer` (دسته)، `/brand/...` (برند)، `/tag/greenhouse` (برچسب) محصول نشان می‌دهند
- [ ] بازار (`/marketplace`): غرفه‌ها، آگهی‌ها، دنبال‌کردن، گفت‌وگو
- [ ] ماشین‌حساب دوز (نهاده‌ها)، انتخاب استان/شهر (لوکیشن)، خدمات و صفحات اطلاعاتی
- [ ] endpointهای ماژول‌های holding: `/api/inputs/pesticides/` ،`/api/inputs/fertilizers/` ،`/api/inputs/seeds/` ،`/api/inputs/seedlings/` ،`/api/machinery/tractors/` ،`/api/machinery/implements/`
- [ ] وبلاگ (`/blog`): ۶ مقاله، فیلتر راهنما/ویژه/محصول؛ صفحه مقاله: فهرست سرفصل‌ها، محصول و آگهی مرتبط
- [ ] درباره (`/about`) و تماس (`/contact`): تیم، برندها، تلفن‌ها و فرم خبرنامه
- [ ] پیام‌ها (`/messages`) با `demo-buyer`: ۲ گفت‌وگوی باز با پیام خوانده‌نشده، کارت آگهی داخل چانه‌زنی
- [ ] پیام‌ها با `poshtiban` / `moshaver`: صف میز خدمت؛ با `demo-farmer`: گفت‌وگوی بسته با امتیاز ثبت‌شده
- [ ] پشتیبانی (`/support`): ثبت شکایت (با ورود) و بازخورد (مهمان)؛ مشاهده در داشبورد مدیریت با کاربر مدیر
- [ ] مزرعه من (`/farm`): ۲ زمین، تقویم، ثبت و مشاهده مشاوره؛ پنل مشاور (`/farmers`) با کاربر مدیر
- [ ] سفارش‌های من (`/orders`) و پیگیری (`/track` با کد `GK-TEST-0001` + موبایل `09120000001`)
- [ ] پروفایل غرفه باغ سبز: استوری فعال، هایلایت، دنبال‌کردن؛ پنل مالی فروشنده با ۱ تراکنش

## ۵. دستورهای کاربردی

```bash
cd garinkood

# سید مجدد فقط کاتالوگ (بعد از ویرایش test_catalog.py)
python manage.py seed_test_catalog

# بدون تصویر (سریع‌تر؛ محصول با عکس پیش‌فرض سایت نمایش داده می‌شود)
python manage.py seed_test_catalog --skip-images

# تعیین نویسنده محصولات
python manage.py seed_test_catalog --author myuser

# ساخت نسخه‌های بهینه تصاویر (بعد از سید با تصویر)
python manage.py process_async_tasks --limit 200

# مشاهده خلاصه از شل
python manage.py shell -c "
from shop.models import Product, Category
for c in Category.objects.all(): print(c.slug, c.get_product_count())
print('total:', Product.objects.filter(status='published').count())
"
```

## ۶. ساختار فایل دیتا

هر محصول در `TEST_PRODUCTS` این کلیدهاست (همه اختیاری‌ها با `(... | optional)`):

```
slug, title, category, subcategory, description, price, stock,
available, is_featured, discount_percent, sales_count, brand,
package_weight, price_on_request, sku, views, video_url,
min_order_quantity, bulk_note,
production_days_ago | expiry_in_days,        # تاریخ نسبی
tags: [slug, ...],
detail: {kind, ...},                          # مشخصات تخصصی دسته
agri: {kind, ...},                            # پروفایل نهاده (fertilizer|pesticide|seed|seedling)
machine: {kind, ...},                         # پروفایل ماشین‌آلات (tractor|implement)
attributes: [(label, value), ...],            # جدول مشخصات
packages: [{label, weight_kg, price, ...}],   # بسته‌بندی‌ها
reviews: [{name, body, rating, ...}],         # دیدگاه‌ها
gallery: [caption, ...]                       # عکس‌های اضافه گالری
```

برای اضافه کردن محصول جدید کافی است یک دیکشنری به لیست اضافه کنی و `seed_test_catalog` را دوباره اجرا کنی.
