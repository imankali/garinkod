# کاتالوگ تستی فروشگاه (داده نمونه برای تست روی لپ‌تاپ)

این راهنما توضیح می‌دهد چطور روی یک لپ‌تاپ تازه، کل سایت را با **محصول تستی در همه بخش‌ها** بالا بیاورید و همه فلوها (فروشگاه، فیلترها، سبد، کوپن، نظرات، بازار غرفه‌داران) را تست کنید.

> ⚠️ داده تستی فقط برای محیط توسعه/تست است. **هرگز** روی دیتابیس واقعی (production) اجرا نکنید.

## ۱. چه چیزی ساخته می‌شود؟

با یک دستور، این داده‌ها ساخته می‌شوند (همه idempotent هستند؛ اجرای دوباره، رکورد تکراری نمی‌سازد بلکه به‌روزرسانی می‌کند):

| بخش | محتوا |
|---|---|
| دسته‌بندی فروشگاه | ۸ دسته: کود، سم، بذر، نهال، ماشین‌آلات و ادوات، آبیاری، ابزار، گلخانه + ۲۱ زیردسته + ۶ برچسب |
| محصولات فروشگاه | **۳۵ محصول تستی** (اسلاگ با پیشوند `test-`) در همه دسته‌ها |
| حالت‌های خاص محصول | ویژه (⭐)، تخفیف‌دار، ناموجود، غیرفعال، قیمت استعلامی («تماس بگیرید»)، نزدیک انقضا (بج ۹۰ روزه)، حداقل سفارش، چندبسته‌ای (کیسه/جامبوبگ) |
| پروفایل‌های تخصصی | کود/سم/بذر/نهال (`agri_inputs`) + تراکتور نو و دست‌دوم/ادوات (`machinery`) + جدول مشخصات فنی |
| نظرات | امتیاز ستاره‌ای، نظر ویژه صفحه «تجربه مشتریان»، ترد پرسش‌وپاسخ، یک نظر تاییدنشده برای تست صف بررسی |
| بازار غرفه‌داران | ۵ غرفه + آگهی + پست/استوری (از طریق `seed_demo_marketplace`) |
| کوپن تست checkout | `TEST10` (۱۰٪ تا سقف ۵۰۰ هزار)، `TESTFIX50` (۵۰ هزار ثابت)، `TESTOLD` (منقضی، برای تست خطا) |
| کاربرها | خریدار `test-buyer` با ۵۰۰ امتیاز وفاداری + فروشنده‌های نمونه؛ همه با رمز `demo-12345` |

## ۲. اجرا روی لپ‌تاپ (قدم‌به‌قدم)

### قدم ۱ — گرفتن آخرین کد از گیت

```bash
cd garinkod
git fetch origin
git checkout arena/01a0871a-garinkod
git pull origin arena/01a0871a-garinkod
```

### قدم ۲ — بک‌اند

```bash
cd garinkood
python -m venv .venv
source .venv/bin/activate        # ویندوز: .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
cp .env.example .env             # فقط بار اول
python manage.py migrate
python manage.py seed_locations
python manage.py seed_agri_inputs
python manage.py seed_site_content --with-landing
python manage.py bootstrap_management_roles
python manage.py createsuperuser  # فقط بار اول (مثلاً admin)
python manage.py seed_test_catalog
python manage.py runserver 0.0.0.0:8000
```

> میان‌بر: به‌جای ۴ دستور seed می‌توانید اسکریپت را اجرا کنید (از ریشه مخزن):
>
> ```bash
> ./scripts/load_test_data.sh
> ```

### قدم ۳ — فرانت‌اند (ترمینال دوم)

```bash
cd frontend
npm ci
cp .env.example .env.local       # فقط بار اول
npm run dev -- --host 0.0.0.0
```

### قدم ۴ — باز کردن سایت

- فروشگاه: `http://localhost:5173`
- صفحه تکی محصول: `http://localhost:5173/products/test-npk-20-granular`
- بازار غرفه‌داران: `http://localhost:5173/marketplace`
- مدیریت جنگو: `http://localhost:8000/admin/`

## ۳. چک‌لیست تست پیشنهادی (همه بخش‌ها)

- [ ] صفحه اصلی: گرید دسته‌بندی‌ها (۸ دسته با شمارش)، ردیف پرفروش‌ها/تخفیف‌دارها/جدیدها
- [ ] فروشگاه `/products`: فیلتر دسته، برند، بازه قیمت، «فقط موجود»، «فقط تخفیف‌دار»، «استعلامی»، «دارای بازخورد»، «نزدیک انقضا» + مرتب‌سازی (پرفروش/امتیاز/جدید/پربازدید/قیمت)
- [ ] صفحه محصول: گالری، جدول مشخصات، انتخاب بسته‌بندی (روی کود NPK و بذر گندم)، نظرات و ثبت نظر
- [ ] محصول استعلامی (`test-glyphosate`): به‌جای افزودن به سبد، «تماس بگیرید» نمایش داده شود
- [ ] محصول نزدیک انقضا (`test-potassium-sulfate`): بج هشدار دیده شود
- [ ] سبد + checkout: ورود با `test-buyer` / `demo-12345`، اعمال کوپن `TEST10`، خرج امتیاز وفاداری، ثبت سفارش، پیگیری سفارش
- [ ] کود/سم/بذر/نهال: پروفایل تخصصی در صفحه محصول و APIهای `api/inputs/*`
- [ ] تراکتور و ادوات: APIهای `api/machinery/*` + بج «دست دوم» روی رومانی
- [ ] بازار: غرفه‌ها، آگهی‌ها، دنبال‌کردن، پست/استوری
- [ ] مشتریان/نظرات: صفحه تجربه خرید (نظر ویژه کود NPK)

## ۴. دستورهای مفید

```bash
# اجرای دوباره بعد از pull (به‌روزرسانی بدون تکرار)
python manage.py seed_test_catalog

# فقط کاتالوگ، بدون بازار غرفه‌داران
python manage.py seed_test_catalog --skip-marketplace

# حذف کامل داده تستی (محصولات test-* و کوپن‌های TEST*)
python manage.py seed_test_catalog --clear
```

## ۵. فایل‌های مرتبط

- داده خام: `garinkood/shop/data/test_catalog.py` (ویرایش/افزودن محصول تستی اینجاست)
- دستور نصب: `garinkood/shop/management/commands/seed_test_catalog.py`
- بازار نمونه: `garinkood/shop/management/commands/seed_demo_marketplace.py`
- اسکریپت یک‌مرحله‌ای: `scripts/load_test_data.sh`

## ۶. افزودن محصول تستی جدید

۱. یک دیکشنری به `TEST_PRODUCTS` در `test_catalog.py` اضافه کنید (اسلاگ حتماً با `test-` شروع شود).
۲. `python manage.py seed_test_catalog` را اجرا کنید.
۳. تغییر را commit و push کنید تا روی لپ‌تاپ با `git pull` بیاید.
