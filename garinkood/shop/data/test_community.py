# -*- coding: utf-8 -*-
"""Test data for the community/content side of the site (non-catalogue).

Loaded by the ``seed_test_community`` management command::

    python manage.py seed_test_community

Idempotent like the catalogue seed: every row is matched on a natural key
(slug, code, username, subject, ...) and updated in place, so re-running
after an edit fixes the existing rows instead of duplicating them.

Requires ``seed_test_catalog`` and ``seed_demo_marketplace`` first — articles
link catalogue products, complaints reference storefronts, and conversations
reuse the demo sellers. The loader script (``scripts/load_test_catalog.sh``)
runs everything in the right order.

Coverage:
  * articles   → ۶ مقاله و راهنمای کشت (بلاگ، راهنماها، محصولات/آگهی‌های مرتبط)
  * about      → تیم، برندها (هم‌نام با brand_slug کاتالوگ) و اطلاعات تماس
  * desk       → کارشناس پشتیبانی، پاسخ‌های آماده و ۴ گفتگوی نمونه با پیام
  * trust      → ۳ شکایت از غرفه + ۴ بازخورد پلتفرم در وضعیت‌های مختلف
  * farm       → کشاورز تستی با ۲ زمین، تقویم عملیات و ۲ درخواست مشاوره
  * social     → دنبال‌کردن، لایک، کامنت، بازدید استوری، هایلایت + صف بررسی
  * requests   → ۲ درخواست خدمت + ۲ درخواست خرید محصول کشاورز
  * orders     → ۲ سفارش (پرداخت‌شده با مرسوله و رهگیری + در انتظار بررسی)
  * wallet     → امتیاز وفاداری خریدار تستی + سیاست بازگشت ۷ روزه
"""

from __future__ import annotations

DEMO_PASSWORD = "demo-12345"

# ---------------------------------------------------------------------------
# Demo users (username → profile). Sellers + `moshaver` come from
# seed_demo_marketplace; these are the extra accounts the community seed owns.
# ---------------------------------------------------------------------------

TEST_USERS = [
    {
        "username": "demo-buyer",
        "email": "demo-buyer@example.com",
        "first_name": "خریدار",
        "last_name": "تستی",
        "phone": "09120000001",
        "level": 1,  # buyer
        "is_staff": False,
    },
    {
        "username": "demo-farmer",
        "email": "demo-farmer@example.com",
        "first_name": "کشاورز",
        "last_name": "تستی",
        "phone": "09120000002",
        "level": 1,
        "is_staff": False,
    },
    {
        "username": "poshtiban",
        "email": "poshtiban@example.com",
        "first_name": "سارا",
        "last_name": "کریمی",
        "phone": "09120000003",
        "level": 5,  # desk agent
        "is_staff": True,
        "permissions": ["view_platformfeedback", "change_platformfeedback"],
        "desk_agent": {
            "role": "support",
            "display_name": "سارا کریمی",
            "title": "کارشناس پشتیبانی",
            "bio": "پاسخگوی سفارش، ارسال و بازگشت کالا؛ شنبه تا پنجشنبه.",
            "specialties": "سفارش، ارسال، بازگشت",
        },
    },
]

# ---------------------------------------------------------------------------
# About / contact
# ---------------------------------------------------------------------------

TEST_TEAM = [
    {
        "name": "مهندس رضا کریمی",
        "role": "بنیان‌گذار و مدیرعامل",
        "bio": "۱۵ سال تجربه در بازار نهاده‌های کشاورزی؛ گرین کود را برای حذف واسطه بین تولیدکننده و کشاورز ساخت.",
        "order": 0,
    },
    {
        "name": "سارا محمدی",
        "role": "مدیر محتوا و مشاوره",
        "bio": "کارشناس ارشد زراعت؛ راهنماهای کشت سایت و پاسخ‌های تخصصی مشاوره زیر نظر او منتشر می‌شود.",
        "order": 1,
    },
    {
        "name": "علی رضایی",
        "role": "مسئول فنی و لجستیک",
        "bio": "مدیریت انبار، بسته‌بندی و ارسال سفارش‌ها به سراسر کشور.",
        "order": 2,
    },
]

# Names MUST match catalogue brands: the about page links each brand to
# /brand/<slug> and the slug is derived from the name, exactly like products.
TEST_BRANDS = [
    {"name": "کیمیا سبز", "website": "", "description": "تولیدکننده سموم و کودهای تخصصی", "since_year": 1398},
    {"name": "تکنوفارم", "website": "", "description": "ادوات و ماشین‌آلات کشاورزی", "since_year": 1400},
    {"name": "بذریار", "website": "", "description": "بذر اصلاح‌شده و هیبرید", "since_year": 1399},
    {"name": "قطره‌باران", "website": "", "description": "تجهیزات آبیاری تحت فشار", "since_year": 1401},
    {"name": "پتروشیمی خراسان", "website": "", "description": "کودهای نیتروژنه", "since_year": 1397},
]

TEST_CONTACT = {
    "address": "تهران، جاده مخصوص کرج، بازار بزرگ کشاورزی، فاز ۲، پلاک ۱۴",
    "provinces_note": "ارسال به سراسر کشور؛ تحویل حضوری در تهران و کرج",
    "phones": "۰۲۱-۴۴۵۵۶۶۷۷\n۰۲۱-۴۴۵۵۶۶۷۸",
    "emails": "salam@example.com\nposhtibani@example.com",
    "working_hours": "شنبه تا پنجشنبه ۸ تا ۱۸؛ مشاوره تلفنی ۹ تا ۱۷",
    "whatsapp_number": "09120000009",
    "telegram_url": "https://t.me/garinkood_test",
    "instagram_url": "https://instagram.com/garinkood_test",
    "eitaa_url": "https://eitaa.com/garinkood_test",
    "map_lat": "35.689200",
    "map_lng": "51.389000",
    "map_note": "روبروی درب غربی بازار، ساختمان سبز",
    "expert_name": "مهندس مشاور گرین کود",
    "expert_role": "مشاور ارشد کشاورزی",
    "expert_note": "برای مشاوره رایگان اول، از دکمه شناور سایت پیام بدهید.",
}

# ---------------------------------------------------------------------------
# Articles & growing guides
# ---------------------------------------------------------------------------
# `products` reference catalogue slugs, `listings` reference
# (storefront_username, listing_title), `related` references article slugs.
# Bodies use `## ` headings so the article page can build its table of contents.

TEST_ARTICLES = [
    {
        "slug": "tomato-growing-guide",
        "kind": "guide",
        "title": "راهنمای کامل کشت گوجه‌فرنگی گلخانه‌ای",
        "excerpt": "از انتخاب بذر هیبرید تا برداشت: دما، تغذیه، آبیاری و مبارزه با آفات گوجه گلخانه‌ای در یک راهنمای قدم‌به‌قدم.",
        "body": (
            "گوجه‌فرنگی پرمصرف‌ترین محصول گلخانه‌ای ایران است و موفقیت در آن بیش از هر چیز به انتخاب بذر درست و مدیریت تغذیه بستگی دارد.\n"
            "## انتخاب بذر\n"
            "برای گلخانه، رقم هیبرید F1 مقاوم به ویروس TMV انتخاب کنید؛ قوه‌نامیه بالای ۹۵ درصد یعنی سبز یکدست و حذف کمتر نشاء. بذر را در سینی نشاء با کوکوپیت و پرلیت بکارید و دمای ۲۵ تا ۲۸ درجه را تا سبز شدن حفظ کنید.\n"
            "## نشاءکاری و تراکم\n"
            "نشاء ۴ تا ۵ برگی آماده انتقال است. تراکم پیشنهادی ۲ تا ۲.۵ بوته در مترمربع است؛ تراکم بیشتر یعنی رطوبت بالاتر و شیوع سفیدک. فاصله ردیف‌ها را ۸۰ سانتی‌متر و فاصله بوته‌ها را ۴۰ سانتی‌متر بگیرید.\n"
            "## تغذیه و کودآبیاری\n"
            "در مرحله رشد رویشی از کود کامل ۲۰-۲۰-۲۰ استفاده کنید و با شروع گلدهی پتاسیم را بالا ببرید. اسید هیومیک در هر دو مرحله به رشد ریشه کمک می‌کند و جذب عناصر را بهتر می‌کند. هفته‌ای یک‌بار EC و pH محلول را چک کنید.\n"
            "## آفات رایج\n"
            "مگس سفید، تریپس و مینوز سه آفت اصلی‌اند. کارت زرد برای پایش نصب کنید و در صورت آلودگی، سمپاشی را عصر انجام دهید تا زنبورهای گرده‌افشان آسیب نبینند.\n"
            "## برداشت\n"
            "برداشت در مرحله صورتی-قرمز برای بازار تازه‌خوری و کاملا قرمز برای فرآوری انجام می‌شود. میوه را صبح زود بچینید و سریع به سایه منتقل کنید."
        ),
        "crop": "گوجه‌فرنگی",
        "views": 8400,
        "is_featured": True,
        "published_days_ago": 12,
        "products": ["tomato-greenhouse-hybrid-1000", "npk-20-20-20-10kg", "humic-acid-liquid-1l"],
        "listings": [("golkhane-esfahan", "گوجه گلخانه‌ای")],
        "related": ["greenhouse-pest-guide"],
    },
    {
        "slug": "wheat-fertilizing-guide",
        "kind": "guide",
        "title": "راهنمای تغذیه گندم: از پایه تا خوشه",
        "excerpt": "برنامه کوددهی گندم آبی و دیم؛ چه کودی، چه زمانی و به چه مقداری برای رسیدن به عملکرد بالا.",
        "body": (
            "تغذیه گندم سه ایستگاه اصلی دارد: کود پایه قبل از کاشت، سرک اول در پنجه‌زنی و سرک دوم در ساقه‌رفتن. حذف هر کدام مستقیم روی وزن هزاردانه اثر می‌گذارد.\n"
            "## کود پایه\n"
            "قبل از کاشت، فسفر و پتاسیم را بر اساس آزمایش خاک بدهید. در خاک‌های معمولی ۱۵۰ کیلوگرم فسفات و ۱۰۰ کیلوگرم پتاس در هکتار نقطه شروع خوبی است.\n"
            "## سرک اول: پنجه‌زنی\n"
            "۱۰۰ تا ۱۵۰ کیلوگرم اوره در هکتار همراه اولین آبیاری. این مرحله تعداد پنجه بارور را تعیین می‌کند؛ تأخیر در آن جبران‌ناپذیر است.\n"
            "## سرک دوم: ساقه‌رفتن\n"
            "۵۰ تا ۸۰ کیلوگرم اوره در هکتار. در این مرحله محلول‌پاشی ریزمغذی (روی و آهن) هم کیفیت دانه را بالا می‌برد.\n"
            "## نکات دیم\n"
            "در کشت دیم، کل نیتروژن را یکجا ندهید؛ اگر بارندگی کم باشد، کود اضافی می‌سوزاند. نصف در پاییز و نصف در بهار، قانون امن دیم‌زار است."
        ),
        "crop": "گندم",
        "views": 5200,
        "is_featured": False,
        "published_days_ago": 30,
        "products": ["wheat-sardari-50kg", "urea-46-50kg", "micronutrient-mix-5kg"],
        "listings": [("taavoni-gorgan", "گندم دوروم")],
        "related": ["pesticide-safety-tips"],
    },
    {
        "slug": "drip-irrigation-guide",
        "kind": "guide",
        "title": "راهنمای آبیاری قطره‌ای صیفی‌جات با نوار تیپ",
        "excerpt": "طراحی ساده یک سیستم تیپ برای یک هکتار: فیلتر، فشار، فاصله قطره‌چکان و برنامه آبیاری.",
        "body": (
            "آبیاری قطره‌ای با نوار تیپ، مصرف آب صیفی‌جات را تا ۵۰ درصد کم می‌کند؛ به شرطی که فیلتراسیون و فشار درست اجرا شود.\n"
            "## اجزای سیستم\n"
            "یک سیستم استاندارد شامل پمپ، فیلتر دیسکی، لوله اصلی، نوار تیپ و اتصالات است. فیلتر را حذف نکنید؛ گرفتگی قطره‌چکان‌ها پرهزینه‌ترین خطای سیستم تیپ است.\n"
            "## انتخاب نوار\n"
            "برای خاک‌های سبک فاصله قطره‌چکان ۲۰ سانتی‌متر و برای خاک‌های سنگین ۳۰ سانتی‌متر مناسب است. ضخامت ۲۰۰ میکرون برای یک فصل کشت کافی است.\n"
            "## برنامه آبیاری\n"
            "در اوج تابستان، روزانه ۲ تا ۳ نوبت کوتاه بهتر از یک نوبت طولانی است؛ نفوذ عمقی آب را کم می‌کند و ریشه را سطحی نگه می‌دارد.\n"
            "## کودآبیاری\n"
            "کودهای محلول را فقط در یک‌سوم میانی زمان آبیاری تزریق کنید؛ ابتدا و انتهای نوبت باید آب خالص باشد تا کود در خط نماند."
        ),
        "crop": "صیفی‌جات",
        "views": 3900,
        "is_featured": False,
        "published_days_ago": 45,
        "products": ["drip-tape-16mm-1000m", "irrigation-disc-filter-2in"],
        "listings": [],
        "related": ["tomato-growing-guide"],
    },
    {
        "slug": "pistachio-orchard-tips",
        "kind": "article",
        "title": "۵ نکته کلیدی برای باغ پسته پربار",
        "excerpt": "از مدیریت آب تا تغذیه زمستانه؛ تجربه باغداران موفق رفسنجان در قالب پنج توصیه عملی.",
        "body": (
            "پسته کم‌آب‌بر است اما کم‌توقع نیست؛ اختلاف عملکرد باغ‌های خوب و متوسط گاهی سه برابر است. این پنج نکته، پرتکرارترین توصیه باغداران موفق است.\n"
            "## ۱. آبیاری منظم، نه زیاد\n"
            "پسته به خشکی مقاوم است ولی تنش آبی در مرحله مغزرفتن (تیر و مرداد) پوکی را زیاد می‌کند. دور آبیاری را در تابستان کوتاه کنید.\n"
            "## ۲. هرس سالانه\n"
            "هرس سبک هر سال بهتر از هرس سنگین هر چند سال است. شاخه‌های خشک و آفت‌زده را زمستان حذف کنید و محل برش را با خمیر هرس بپوشانید.\n"
            "## ۳. تغذیه زمستانه\n"
            "کود حیوانی پوسیده + فسفر و پتاس در چالکود زمستانه، پایه عملکرد سال بعد است. آزمایش برگ را هر دو سال یک‌بار فراموش نکنید.\n"
            "## ۴. مبارزه با پسیل\n"
            "پسیل پسته را در بهار پایش کنید؛ جمعیت کم را با روغن ولک کنترل کنید و سمپاشی را برای اوج جمعیت نگه دارید.\n"
            "## ۵. برداشت به‌موقع\n"
            "تأخیر در برداشت، خندانی را کم و آفلاتوکسین را زیاد می‌کند. بلافاصله پس از برداشت، پسته را فرآوری و خشک کنید."
        ),
        "crop": "پسته",
        "views": 6700,
        "is_featured": True,
        "published_days_ago": 8,
        "products": ["iron-chelate-6-1kg", "pruning-shears-pro"],
        "listings": [("pesteh-rafsanjan", "پسته اکبری صادراتی")],
        "related": ["pesticide-safety-tips"],
    },
    {
        "slug": "pesticide-safety-tips",
        "kind": "article",
        "title": "ایمنی در سمپاشی: ۷ قانونی که نباید شکست",
        "excerpt": "لباس کار، دوره کارنس، شست‌وشوی سمپاش و نگهداری سم؛ مرور سریع مهم‌ترین اصول ایمنی برای سمپاش و مصرف‌کننده.",
        "body": (
            "هر سال ده‌ها مسمومیت ناشی از سموم کشاورزی گزارش می‌شود که بیشترشان با رعایت چند قانون ساده قابل پیشگیری است.\n"
            "## ۱. لباس و تجهیزات\n"
            "ماسک، عینک، دستکش و لباس آستین‌بلند حداقل تجهیزات است. سمپاشی با لباس معمولی و دمپایی، شایع‌ترین علت مسمومیت پوستی است.\n"
            "## ۲. ساعت سمپاشی\n"
            "صبح زود یا عصر سمپاشی کنید؛ هم باد کمتر است هم تبخیر. وسط ظهر تابستان بدترین زمان ممکن است.\n"
            "## ۳. دوره کارنس\n"
            "فاصله بین آخرین سمپاشی تا برداشت (کارنس) روی برچسب هر سم نوشته شده؛ رعایت نکردن آن یعنی باقی‌مانده سم در محصول و خطر برای مصرف‌کننده.\n"
            "## ۴. دوز درست\n"
            "دوز بیشتر یعنی اثر بیشتر نیست؛ یعنی مقاومت آفت، هزینه بیشتر و آلودگی خاک. همیشه طبق برچسب عمل کنید.\n"
            "## ۵. شست‌وشو\n"
            "بعد از سمپاشی، مخزن سمپاش را سه بار بشویید و آب آن را در باغچه یا کنار چاه خالی نکنید.\n"
            "## ۶. نگهداری\n"
            "سم را در ظرف اصلی، قفل‌شده و دور از دسترس کودکان و جدا از مواد غذایی نگه دارید.\n"
            "## ۷. کمک‌های اولیه\n"
            "در صورت مسمومیت، برچسب سم را همراه بیمار به مرکز درمانی ببرید؛ نوع سم، درمان را مشخص می‌کند."
        ),
        "crop": "",
        "views": 9100,
        "is_featured": False,
        "published_days_ago": 20,
        "products": ["glyphosate-41-1l", "workwear-farm-set", "manual-sprayer-16l"],
        "listings": [],
        "related": ["pistachio-orchard-tips"],
    },
    {
        "slug": "greenhouse-pest-guide",
        "kind": "article",
        "title": "شناخت و کنترل آفات رایج خیار گلخانه‌ای",
        "excerpt": "مگس سفید، تریپس، کنه و سفیدک؛ علائم، روش پایش و برنامه مبارزه تلفیقی برای گلخانه خیار.",
        "body": (
            "محیط گرم و مرطوب گلخانه برای آفات هم بهشت است؛ پایش هفتگی، ارزان‌ترین بیمه محصول شماست.\n"
            "## مگس سفید\n"
            "زیر برگ‌ها را چک کنید؛ تخم‌های ریز و عسلک، نشانه آلودگی است. کارت زرد به ازای هر ۲۰ مترمربع یک عدد نصب کنید.\n"
            "## تریپس\n"
            "لکه‌های نقره‌ای روی برگ و بدشکلی میوه از علائم است. کارت آبی برای پایش تریپس بهتر از زرد جواب می‌دهد.\n"
            "## کنه تارتن\n"
            "در هوای گرم و خشک طغیان می‌کند. رطوبت نسبی بالای ۶۰ درصد جمعیتش را مهار می‌کند؛ در صورت نیاز از کنه‌کش تخصصی استفاده کنید.\n"
            "## سفیدک پودری\n"
            "پوشش سفید آردی روی برگ. تهویه مناسب و فاصله کاشت درست، بهترین پیشگیری است؛ سمپاشی را در شروع آلودگی انجام دهید نه وقتی همه بوته‌ها سفید شدند."
        ),
        "crop": "خیار",
        "views": 3400,
        "is_featured": False,
        "published_days_ago": 5,
        "products": ["abamectin-miticide-250cc", "triforine-fungicide-500g", "cucumber-hybrid-500"],
        "listings": [("golkhane-esfahan", "خیار گلخانه‌ای")],
        "related": ["tomato-growing-guide"],
    },
]

# ---------------------------------------------------------------------------
# Desk: quick replies
# ---------------------------------------------------------------------------

TEST_QUICK_REPLIES = [
    {"audience": "customer", "channel": "any", "label": "قیمت عمده", "text": "قیمت عمده این محصول چطور محاسبه می‌شود؟", "order": 0},
    {"audience": "customer", "channel": "any", "label": "هزینه ارسال", "text": "هزینه ارسال به شهرستان چقدر است؟", "order": 1},
    {"audience": "customer", "channel": "support", "label": "پیگیری سفارش", "text": "سلام، می‌خواهم وضعیت سفارشم را پیگیری کنم.", "is_first_message_only": True, "order": 0},
    {"audience": "customer", "channel": "support", "label": "لغو سفارش", "text": "می‌خواهم سفارشم را لغو کنم، لطفا راهنمایی کنید.", "is_first_message_only": True, "order": 1},
    {"audience": "customer", "channel": "consulting", "label": "دوز مصرف", "text": "دوز مصرف این کود برای یک هکتار چقدر است؟", "is_first_message_only": True, "order": 0},
    {"audience": "customer", "channel": "consulting", "label": "زردی برگ", "text": "برگ‌های درختانم زرد شده، مشکل چیست؟", "is_first_message_only": True, "order": 1},
    {"audience": "staff", "channel": "support", "label": "درخواست کد پیگیری", "text": "سلام! لطفا کد پیگیری سفارشتان را بفرستید تا بررسی کنم.", "order": 0},
    {"audience": "staff", "channel": "support", "label": "تحویل به باربری", "text": "سفارش شما آماده و فردا تحویل باربری می‌شود؛ کد رهگیری پیامک خواهد شد.", "order": 1},
    {"audience": "staff", "channel": "consulting", "label": "درخواست عکس", "text": "لطفا یک عکس واضح از برگ (از نزدیک) و یک عکس از کل بوته بفرستید.", "order": 0},
    {"audience": "staff", "channel": "consulting", "label": "آزمایش خاک", "text": "آیا آزمایش خاک انجام داده‌اید؟ اگر بله، تصویر برگه را بفرستید.", "order": 1},
]

# ---------------------------------------------------------------------------
# Desk: demo conversations with messages
# ---------------------------------------------------------------------------
# `sender: None` = platform notice (is_notice=True). `listing` = card of a
# marketplace listing, `land` = shared farm case file. `edited` marks one
# message as edited-after-send. Bodies must be unique per thread (they are
# the idempotency key together with the sender).

TEST_CONVERSATIONS = [
    {
        # Open support thread: buyer asks about their shipped order.
        "channel": "support",
        "customer": "demo-buyer",
        "agent": "poshtiban",
        "subject": "پیگیری سفارش",
        "status": "open",
        "messages": [
            {"sender": "demo-buyer", "body": "سلام، سفارش GK-TEST-0001 من هفته پیش ثبت شده ولی هنوز کد رهگیری نگرفتم.", "is_read": True},
            {"sender": "poshtiban", "body": "سلام! سفارش شما دیروز تحویل باربری شد؛ کد رهگیری TRK-TEST-0001 است و از صفحه پیگیری سفارش می‌توانید لحظه‌به‌لحظه دنبالش کنید.", "is_read": True},
            {"sender": "demo-buyer", "body": "ممنون، پیدا کردم. فقط هزینه ارسالش بیشتر از چیزی بود که موقع ثبت دیدم.", "is_read": True},
            {"sender": "poshtiban", "body": "بررسی کردم؛ اختلاف به‌خاطر اضافه شدن کرایه باربری شهرستان است که بعد از ثبت، کارشناس فروش با شما هماهنگ کرده بود. اگر فاکتور را می‌خواهید بفرستم.", "is_read": False, "edited": True},
        ],
    },
    {
        # Open consulting thread: farmer shares their land case file.
        "channel": "consulting",
        "customer": "demo-farmer",
        "agent": "moshaver",
        "subject": "زردی برگ سیب",
        "status": "open",
        "messages": [
            {"sender": "demo-farmer", "body": "سلام مهندس، برگ‌های سیب زرد شده و رشدش کند است. پرونده زمینم را هم می‌فرستم.", "is_read": True, "land": "باغ سیب کرج"},
            {"sender": "moshaver", "body": "سلام! پرونده را دیدم؛ با توجه به خاک آهکی و آبیاری قطره‌ای، احتمال کمبود آهن زیاد است. لطفا یک عکس از برگ‌ها هم بفرستید تا مطمئن شوم.", "is_read": True},
            {"sender": "demo-farmer", "body": "عکس را فرستادم. اگر کمبود آهن باشد چه محصولی پیشنهاد می‌کنید؟", "is_read": False},
        ],
    },
    {
        # Storefront negotiation with a listing card attached.
        "channel": "storefront",
        "storefront": "bagh-sabz",
        "customer": "demo-buyer",
        "agent": None,
        "subject": "",
        "status": "open",
        "messages": [
            {"sender": "demo-buyer", "body": "سلام، برای خرید ۲۰۰ کیلوگرم پرتقال قیمت عمده دارید؟", "is_read": True, "listing": ("bagh-sabz", "پرتقال تامسون درجه یک")},
            {"sender": "bagh-sabz", "body": "سلام! بله، برای بالای ۱۰۰ کیلوگرم ۵ درصد تخفیف داریم و ارسال با باربری یخچال‌دار است. چه زمانی نیاز دارید؟", "is_read": False},
        ],
    },
    {
        # Closed support thread with a satisfaction survey answered.
        "channel": "support",
        "customer": "demo-farmer",
        "agent": "poshtiban",
        "subject": "لغو سفارش",
        "status": "closed",
        "messages": [
            {"sender": "demo-farmer", "body": "سلام، می‌خواهم سفارشم را لغو کنم چون اشتباهی دو بار ثبت شده.", "is_read": True},
            {"sender": "poshtiban", "body": "سلام! سفارش تکراری لغو شد و مبلغ آن تا ۷۲ ساعت آینده به حسابتان برمی‌گردد.", "is_read": True},
            {"sender": None, "body": "گفتگو توسط کارشناس بسته شد.", "is_notice": True, "is_read": True},
        ],
        "rating": {"score": 5, "solved": True, "comment": "سریع و دقیق پاسخ دادند، ممنون."},
    },
]

# ---------------------------------------------------------------------------
# Trust: complaints + platform feedback
# ---------------------------------------------------------------------------

TEST_COMPLAINTS = [
    {
        "complainant": "demo-buyer",
        "storefront": "pesteh-rafsanjan",
        "listing": "پسته اکبری صادراتی",
        "order": None,
        "subject": "مغایرت وزن بسته",
        "description": "بسته ۵ کیلویی سفارش دادم ولی وزنی که رسید حدود ۴.۶ کیلوگرم بود. لطفا بررسی کنید.",
        "status": "new",
        "resolution_note": "",
    },
    {
        "complainant": "demo-farmer",
        "storefront": "golkhane-esfahan",
        "listing": "گوجه گلخانه‌ای",
        "order": None,
        "subject": "تأخیر در ارسال",
        "description": "قرار بود بار سه‌شنبه ارسال شود ولی هنوز خبری نشده و مشتری من منتظر است.",
        "status": "reviewing",
        "resolution_note": "",
    },
    {
        "complainant": "demo-buyer",
        "storefront": "bagh-sabz",
        "listing": "پرتقال تامسون درجه یک",
        "order": "GK-TEST-0001",
        "subject": "کیفیت پایین‌تر از عکس",
        "description": "بخشی از پرتقال‌ها لک داشت و با عکس آگهی فرق می‌کرد.",
        "status": "resolved",
        "resolution_note": "پس از بررسی عکس‌های ارسالی، ۱۰ درصد مبلغ سفارش به کیف پول خریدار بازگشت داده شد.",
    },
]

TEST_FEEDBACK = [
    {
        "user": "demo-buyer",
        "name": "",
        "email": "",
        "kind": "suggestion",
        "subject": "فیلتر قیمت در بازار غرفه‌ها",
        "message": "کاش در صفحه بازار هم مثل فروشگاه بتوان بر اساس بازه قیمت فیلتر کرد.",
        "status": "new",
    },
    {
        "user": None,
        "name": "مهمان",
        "email": "guest@example.com",
        "kind": "criticism",
        "subject": "هزینه ارسال بالا",
        "message": "هزینه ارسال به شهرستان نسبت به فروشگاه‌های دیگر بیشتر است.",
        "status": "reviewing",
    },
    {
        "user": "demo-farmer",
        "name": "",
        "email": "",
        "kind": "consultation",
        "subject": "درخواست راهنمایی کشت زعفران",
        "message": "برای کشت زعفران در زمین آهکی به مشاوره نیاز دارم؛ لطفا راهنمایی کنید.",
        "status": "new",
    },
    {
        "user": None,
        "name": "رضا احمدی",
        "email": "reza@example.com",
        "kind": "other",
        "subject": "تشکر",
        "message": "از پشتیبانی سریع و دقیق‌تان ممنونم.",
        "status": "resolved",
    },
]

# ---------------------------------------------------------------------------
# Farm: lands, calendar events, consultation requests (owner: demo-farmer)
# ---------------------------------------------------------------------------

TEST_FARM_LANDS = [
    {
        "name": "باغ سیب کرج",
        "land_type": "orchard",
        "area": "2.50",
        "area_unit": "hectare",
        "crop_type": "سیب",
        "crop_variety": "گلدن دلیشز",
        "province": "البرز",
        "city": "کرج",
        "soil_type": "calcareous",
        "irrigation_type": "drip",
        "planting_days_ago": 900,
        "notes": "باغ ۸ ساله؛ سال گذشته ۲۰ تن برداشت. مشکل فعلی: زردی حاشیه برگ‌ها.",
    },
    {
        "name": "گلخانه خیار ورامین",
        "land_type": "greenhouse",
        "area": "2000",
        "area_unit": "square_meter",
        "crop_type": "خیار",
        "crop_variety": "هیبرید F1",
        "province": "تهران",
        "city": "ورامین",
        "soil_type": "loam",
        "irrigation_type": "drip",
        "planting_days_ago": 60,
        "notes": "گلخانه تونلی؛ کشت دوم سال. تهویه سقفی دارد.",
    },
]

TEST_FARM_EVENTS = [
    {
        "land": "باغ سیب کرج",
        "kind": "spraying",
        "title": "سمپاشی کنه‌کش آبامکتین",
        "date_in_days": 7,
        "notes": "نیم لیتر در هزار لیتر آب؛ عصر انجام شود.",
        "status": "planned",
        "created_by": "demo-farmer",
    },
    {
        "land": "باغ سیب کرج",
        "kind": "fertilizing",
        "title": "کودآبیاری NPK",
        "date_in_days": -5,
        "notes": "۸ کیلوگرم در هکتار همراه آبیاری انجام شد.",
        "status": "done",
        "created_by": "demo-farmer",
    },
    {
        "land": "گلخانه خیار ورامین",
        "kind": "irrigation",
        "title": "تنظیم دور آبیاری تابستانه",
        "date_in_days": 2,
        "notes": "با توجه به گرما، روزی ۳ نوبت کوتاه پیشنهاد می‌شود.",
        "status": "planned",
        "created_by": "moshaver",  # consultant note → is_consultant_note=True
    },
]

TEST_CONSULTATIONS = [
    {
        "land": "باغ سیب کرج",
        "subject": "pest",
        "message": "برگ‌های سیب از حاشیه زرد شده و رشد میوه کند است. خاک آهکی است؛ آیا کمبود آهن است؟",
        "status": "pending",
        "reply": "",
        "replied_by": None,
    },
    {
        "land": "گلخانه خیار ورامین",
        "subject": "fertilizing",
        "message": "برای خیار گلخانه‌ای در مرحله گلدهی چه برنامه کودی پیشنهاد می‌کنید؟",
        "status": "answered",
        "reply": "در گلدهی، پتاسیم را بالا ببرید: NPK با پتاس بالا + کلسیم محلول‌پاشی. EC محلول را روی ۲.۲ نگه دارید.",
        "replied_by": "moshaver",
    },
]

# ---------------------------------------------------------------------------
# Storefront social extras
# ---------------------------------------------------------------------------

# (follower_username, storefront_username)
TEST_FOLLOWS = [
    ("demo-buyer", "bagh-sabz"),
    ("demo-buyer", "golkhane-esfahan"),
    ("demo-farmer", "taavoni-gorgan"),
]

# (username, storefront_username, post_caption)
TEST_POST_LIKES = [
    ("demo-buyer", "bagh-sabz", "به غرفه باغ سبز شیراز خوش آمدید."),
    ("demo-buyer", "golkhane-esfahan", "به غرفه گلخانه بهاران اصفهان خوش آمدید."),
    ("demo-farmer", "taavoni-gorgan", "به غرفه تعاونی کشاورزان گرگان خوش آمدید."),
]

# Comments on storefront posts; seller_reply posts an answer from the owner.
TEST_POST_COMMENTS = [
    {
        "storefront": "bagh-sabz",
        "caption": "به غرفه باغ سبز شیراز خوش آمدید.",
        "user": "demo-buyer",
        "body": "سلام، برای خرید عمده پرتقال هم از همین‌جا سفارش بدهم؟",
        "seller_reply": "سلام! بله، برای بالای ۱۰۰ کیلوگرم در چت غرفه پیام بدهید تا فاکتور عمده صادر کنیم.",
    },
    {
        "storefront": "golkhane-esfahan",
        "caption": "به غرفه گلخانه بهاران اصفهان خوش آمدید.",
        "user": "demo-farmer",
        "body": "گوجه گلخانه‌ای کی برداشت بعدی دارد؟",
        "seller_reply": "",
    },
]

# (viewer_username, storefront_username) → views its live story
TEST_STORY_VIEWS = [
    ("demo-buyer", "bagh-sabz"),
]

# Highlights keep stories beyond expiry; items = the storefront's stories.
TEST_HIGHLIGHTS = [
    {"storefront": "bagh-sabz", "title": "برداشت", "position": 0},
    {"storefront": "golkhane-esfahan", "title": "گلخانه", "position": 0},
]

# One listing + one post left in `pending_review` so the moderation queue
# (/poshtiban) and the dashboard alerts have something to show. Created only
# once: re-seeds never flip them back after a moderator approves them.
TEST_PENDING_LISTING = {
    "storefront": "zaferan-torbat",
    "title": "زعفران سرگل قائنات",
    "slug": "zaferan-sargol-pending",
    "crop_name": "زعفران",
    "description": "زعفران سرگل برداشت امسال قائنات؛ رنگ‌دهی بالا، بسته‌بندی نیم‌مثقالی و مثقالی.",
    "price": 125000000,
    "unit": "کیلوگرم",
    "quantity_available": "12",
    "min_order_quantity": "0.5",
}

TEST_PENDING_POST = {
    "storefront": "zaferan-torbat",
    "post_type": "post",
    "caption": "فروش ویژه زعفران سرگل به مناسبت فصل برداشت؛ موجودی محدود!",
}

# Structured spec rows on one marketplace listing.
TEST_LISTING_ATTRIBUTES = {
    ("bagh-sabz", "پرتقال تامسون درجه یک"): [
        ("رقم", "تامسون ناول"),
        ("درجه‌بندی", "درجه یک صادراتی"),
        ("بسته‌بندی", "سبد ۱۰ کیلویی"),
    ],
}

# ---------------------------------------------------------------------------
# Service + procurement requests
# ---------------------------------------------------------------------------

TEST_SERVICE_REQUESTS = [
    {
        "code": "SV-TEST-0001",
        "user": "demo-farmer",
        "service_type": "agronomy",
        "customer_name": "کشاورز تستی",
        "phone": "09120000002",
        "province": "البرز",
        "city": "کرج",
        "crop": "سیب",
        "farm_area_hectare": "2.50",
        "description": "بازدید باغ سیب و ارائه برنامه تغذیه سالانه.",
        "status": "new",
    },
    {
        "code": "SV-TEST-0002",
        "user": None,
        "service_type": "irrigation",
        "customer_name": "حسین محمدی",
        "phone": "09123334455",
        "province": "تهران",
        "city": "ورامین",
        "crop": "خیار گلخانه‌ای",
        "farm_area_hectare": "0.20",
        "description": "طراحی و نصب آبیاری قطره‌ای برای گلخانه ۲۰۰۰ متری.",
        "status": "contacted",
    },
]

TEST_PROCUREMENT_REQUESTS = [
    {
        "code": "PR-TEST-0001",
        "user": "demo-farmer",
        "farmer_name": "کشاورز تستی",
        "phone": "09120000002",
        "crop_name": "سیب",
        "variety": "گلدن دلیشز",
        "quantity": "15000",
        "unit": "کیلوگرم",
        "requested_price": 45000,
        "province": "البرز",
        "city": "کرج",
        "description": "سیب درجه یک باغی، آماده تحویل از نیمه مهر.",
        "status": "new",
    },
    {
        "code": "PR-TEST-0002",
        "user": None,
        "farmer_name": "اکبر نادری",
        "phone": "09124445566",
        "crop_name": "پسته",
        "variety": "اکبری",
        "quantity": "800",
        "unit": "کیلوگرم",
        "requested_price": 880000,
        "province": "کرمان",
        "city": "رفسنجان",
        "description": "پسته اکبری خشک، خندانی بالا.",
        "status": "offered",
    },
]

# ---------------------------------------------------------------------------
# Demo orders (customer usernames; product/listing refs resolved at seed time)
# ---------------------------------------------------------------------------

TEST_ORDERS = [
    {
        "code": "GK-TEST-0001",
        "user": "demo-buyer",
        "customer_name": "خریدار تستی",
        "phone": "09120000001",
        "province": "تهران",
        "city": "تهران",
        "address": "خیابان آزادی، کوچه تستی، پلاک ۱",
        "notes": "تحویل با هماهنگی قبلی",
        "status": "shipped",
        "payment_status": "paid",
        "payment_method": "coordination",
        "coupon_code": "TEST10",
        "shipping_price": 150000,
        "items": [
            {"kind": "product", "ref": "urea-46-50kg", "quantity": 2},
            {"kind": "product", "ref": "glyphosate-41-1l", "quantity": 1},
            {"kind": "listing", "storefront": "bagh-sabz", "ref": "پرتقال تامسون درجه یک", "quantity": 50},
        ],
        "shipment": {
            "provider": "manual",
            "service_name": "باربری تستی تهران-شیراز",
            "status": "in_transit",
            "tracking_code": "TRK-TEST-0001",
            "shipped_days_ago": 2,
            "events": [
                {"status": "ready", "description": "سفارش بسته‌بندی و آماده تحویل به باربری شد.", "location": "انبار تهران", "days_ago": 3},
                {"status": "picked_up", "description": "مرسوله تحویل باربری شد.", "location": "انبار تهران", "days_ago": 2},
                {"status": "in_transit", "description": "مرسوله در مسیر شیراز است.", "location": "اصفهان", "days_ago": 1},
            ],
        },
        "ledger": [
            {
                "storefront": "bagh-sabz",
                "owner_type": "seller",
                "entry_type": "sale",
                "status": "available",
                "description": "فروش ۵۰ کیلوگرم پرتقال تامسون (سفارش GK-TEST-0001)",
            },
        ],
    },
    {
        "code": "GK-TEST-0002",
        "user": "demo-buyer",
        "customer_name": "خریدار تستی",
        "phone": "09120000001",
        "province": "تهران",
        "city": "تهران",
        "address": "خیابان آزادی، کوچه تستی، پلاک ۱",
        "notes": "",
        "status": "awaiting_review",
        "payment_status": "unpaid",
        "payment_method": "coordination",
        "coupon_code": "",
        "shipping_price": 80000,
        "items": [
            {"kind": "product", "ref": "pruning-shears-pro", "quantity": 1},
        ],
        "shipment": None,
        "ledger": [],
    },
]

# ---------------------------------------------------------------------------
# Newsletter, wallet, return policy
# ---------------------------------------------------------------------------

TEST_NEWSLETTER = [
    {"email": "buyer@example.com", "mobile": "", "topics": "offers,guides", "source": "test-seed"},
    {"email": "", "mobile": "09120000004", "topics": "offers", "source": "test-seed"},
]

TEST_WALLET = {"user": "demo-buyer", "loyalty_points": 300}

TEST_RETURN_POLICY = {
    "window_days": 7,
    "conditions": "کالا باید بازنکرده و سالم باشد؛ هزینه ارسال مرجوعی با مشتری است مگر مغایرت سفارش.",
}
