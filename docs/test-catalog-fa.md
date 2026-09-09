# کاتالوگ تستی فروشگاه 🧪

این راهنما توضیح می‌دهد چطور روی لپ‌تاپ خودت دیتای تستی کامل سایت را بالا بیاوری و همه بخش‌ها را تست کنی.

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
| migrate | `manage.py migrate` | ساخت جدول‌ها (SQLite) |
| لوکیشن/نهاده/محتوا | `seed_locations` / `seed_agri_inputs` / `seed_site_content --with-landing` | استان/شهر، دوز کود و سم، خدمات و صفحات |
| بازار | `seed_demo_marketplace` | ۵ غرفه + ۷ آگهی + پست/استوری |
| **کاتالوگ تستی** | **`seed_test_catalog`** | **۶ دسته + ۲۴ زیردسته + ۳۲ محصول + ۸ برچسب + ۲ کوپن + پروفایل نهاده/ماشین‌آلات** |
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
