# پرداخت، اعتماد، GEO و AEO — وضعیت و مسیر اجرایی

## اصل غیرقابل مذاکره

داشتن دکمهٔ PayPal، Visa/Mastercard، Crypto یا زرین‌پال به معنی «فعال بودن پرداخت» نیست. هر روش فقط زمانی باید در checkout قابل انتخاب باشد که:

1. حساب تجاری و مجوزهای لازم تأیید شده باشند؛
2. credentialها در secret manager production باشند، نه Git یا frontend؛
3. request، callback/webhook، verify/capture و reconciliation سمت سرور پیاده‌سازی و در sandbox آزمایش شده باشند؛
4. idempotency، timeout، refund، dispute و انقضای پرداخت پوشش داده شوند؛
5. قوانین کشور، تحریم‌ها، AML/KYC، مالیات و سیاست بازگشت وجه بررسی شده باشند.

## آنچه اکنون پیاده‌سازی شده است

### رجیستری پرداخت

- مسیر `GET /api/payments/options/` وضعیت روش‌ها را فقط از سمت سرور نمایش می‌دهد.
- گزینه‌ها: هماهنگی با کارشناس، زرین‌پال، Stripe برای Visa/Mastercard، PayPal و پرداخت رمزارزی.
- تنها روش هماهنگی فعلاً `enabled=true` است.
- در checkout همه روش‌ها به‌صورت شفاف دیده می‌شوند؛ روش غیرفعال قابل انتخاب نیست.
- تنظیمات environment برای credentialها به `.env.example` اضافه شده‌اند، اما داشتن credential به‌تنهایی روش را فعال نمی‌کند.
- مدل `PaymentAttempt` برای lifecycle واقعی پرداخت آماده است: provider، amount، currency، idempotency key، external reference، callback URL، status و verify time.

### دفتر مالی و همکاری در فروش

- `FinancialLedgerEntry` برای platform، seller، advisor و affiliate اضافه شده است.
- `AffiliateProfile`، `AffiliateConversion` و referral code اضافه شده‌اند.
- URL همکاری مانند `/?ref=GKAF-...` در مرورگر نگهداری و در checkout به order وصل می‌شود.
- تبدیل affiliate فقط وقتی کد فعال باشد ثبت می‌شود؛ کمیسیون در وضعیت `pending` دفتر مالی می‌رود تا پرداخت order تأیید شود.
- صفحهٔ `/affiliate` برای ساخت/مشاهده کد، لینک معرفی، تبدیل‌ها و کمیسیون‌ها اضافه شده است.
- مسیر `/finance` برای دفتر مالی غرفه و موجودی pending/available/held اضافه شده است.

### اعتماد، شکایت و بازخورد

- feedback با نوع پیشنهاد، انتقاد، درخواست راهنمایی و سایر موارد: `POST /api/feedback/`
- شکایت از غرفه توسط کاربر واردشده: `POST /api/complaints/storefront/`
- صفحهٔ `/support` برای بازخورد و شکایت اضافه شده است.
- هر listing marketplace لینک گزارش مشکل/شکایت به غرفهٔ دقیق دارد.
- Admin برای feedback، complaint، affiliate، conversion، payment attempt و ledger اضافه شده است.

### جستجوی تصویری و صوتی

- جستجوی صوتی از Web Speech API استفاده می‌کند و بر اساس زبان انتخابی `fa-IR`، `ar-SA` یا `en-US` تنظیم می‌شود.
- fallback تصادفی حذف شده است.
- جستجوی با تصویر فایل JPG/PNG/WebP تا ۵MB را به صف `VisualSearchRequest` می‌فرستد.
- تا زمانی که مدل بینایی ماشین، policy امنیت فایل و ارزیابی کیفیت وصل نشده‌اند، نتیجهٔ AI نمایش داده نمی‌شود؛ این رفتار عمداً صادقانه است.

## اتصال واقعی هر روش پرداخت

### زرین‌پال

- ایجاد request با مبلغ محاسبه‌شده در server
- ذخیره authority در `PaymentAttempt`
- redirect به StartPay
- verify callback سمت server
- تغییر atomically `PaymentAttempt.status` و `Order.payment_status`
- اجرای تست sandbox، callback تکراری و timeout

### Visa/Mastercard

Visa و Mastercard درگاه نیستند؛ به PSP مانند Stripe/Adyen/Braintree نیاز دارند. برای Stripe:

- PaymentIntent سمت server
- استفاده از publishable key فقط در browser
- webhook امضاشده و verify server-side
- SCA/3DS، currency، VAT و کشور پذیرنده

### PayPal

- Order API server-side
- approval URL
- capture بعد از return
- webhook امضاشده برای final state
- کنترل حساب تجاری، ارز و محدودیت منطقه‌ای

### Crypto

- انتخاب processor مجاز یا معماری wallet custody با مسئولیت قانونی روشن
- quote با expiry و نرخ تبدیل مشخص
- minimum confirmations، chain monitoring و جلوگیری از replay
- KYC/AML، sanctions screening، refund policy و accounting
- هرگز صرفاً با دریافت tx hash، order را paid نکنید.

## GEO / AEO / AI Search

هیچ تکنیک معتبر نمی‌تواند Google یا مدل‌های AI را مجبور به citation کند. هدف درست این است که محتوا **قابل کشف، قابل استناد، دقیق و به‌روز** باشد.

### پیاده‌سازی‌شده

- `llms.txt` در frontend و backend با منابع canonical و سیاست استناد
- `GET /llms.txt`
- `GET /ai-facts.json` با facts محدود و عمومی محصولات منتشرشده
- FAQPage JSON-LD با پاسخ‌های واقعی درباره خدمات، پرداخت و شکایت
- robots.txt به sitemap، ai facts و llms guide اشاره می‌کند
- sitemap پویا برای محصولات و دسته‌ها
- canonical، Open Graph و schema پایه از قبل موجود است

### کارهای ضروری بعدی برای GEO/AEO واقعی

1. صفحات محصول SSR/prerender با title، description، price، availability و FAQ اختصاصی؛ SPA صرف کافی نیست.
2. محتوای تخصصی دارای نویسنده، تاریخ بازبینی، منبع علمی و disclaimer ایمنی.
3. schema دقیق `Product`، `Offer`، `Organization`، `FAQPage`، `HowTo` و `Article` فقط وقتی دادهٔ واقعی وجود دارد.
4. صفحات region/language مستقل با `hreflang` پس از ترجمه انسانی.
5. Search Console، Bing Webmaster Tools، log analysis و crawl monitoring.
6. سیاست freshness: قیمت و موجودی facts باید timestamp داشته باشند؛ AI نباید اطلاعات قدیمی را حقیقت قطعی بداند.
7. citation policy: محتوای درمان آفت یا توصیه مصرف بدون منبع/متخصص منتشر نشود.

## محدودیت مالی فعلی

دفتر مالی موجود برای traceability آماده است اما **تسویه خودکار فروشنده و مشاور هنوز فعال نیست**؛ زیرا marketplace order امن، payment verification و dispute hold کامل نشده‌اند. فعال کردن payout پیش از این سه مورد خطر مالی جدی دارد.
