
# 🌱 گرین کود | GarinKood

<div align="center">

![GarinKood](https://img.shields.io/badge/GarinKood-فروشگاه%20کشاورزی-0F8A5F?style=for-the-badge)
![Django](https://img.shields.io/badge/Django-5.2-092E20?style=flat-square&logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)

**فروشگاه تخصصی نهاده‌های کشاورزی**  
*سموم، کودها، بذور، ادوات و تجهیزات کشاورزی*

[🚀 شروع سریع](#-شروع-سریع) • [📚 مستندات](#-مستندات) • [🎨 ویژگی‌ها](#-ویژگی‌ها)

</div>

---

## 📖 درباره پروژه

**گرین کود** یک پلتفرم فروشگاهی کامل و مدرن برای فروش نهاده‌های کشاورزی است که با ترکیب **Django REST Framework** در بک‌اند و **React + TypeScript** در فرانت‌اند ساخته شده است.

این پروژه با تمرکز بر **تجربه کاربری کشاورزان ایرانی** طراحی شده و شامل ویژگی‌های تخصصی مانند:
- 🌤️ ویجت هواشناسی با توصیه زراعی
- 🧮 ماشین‌حساب مصرف سم و کود
- 🌾 انتخاب محصول کشاورزی برای فیلتر هوشمند
- 💳 خرید اقساطی با چک صیادی
- 📸 تشخیص آفت با عکس
- 🛒 سبد خرید با پشتیبانی از کاربران مهمان

---

## 🎨 ویژگی‌ها

### 🛍️ فروشگاه
- ✅ لیست محصولات با فیلتر و مرتب‌سازی پیشرفته
- ✅ جستجوی هوشمند با پشتیبانی از جستجوی صوتی
- ✅ مقایسه محصولات (تا ۳ محصول)
- ✅ لیست علاقه‌مندی‌ها
- ✅ سبد خرید با پشتیبانی از Guest Cart
- ✅ انیمیشن FlyToCart هنگام افزودن به سبد

### 👤 احراز هویت و سطوح دسترسی
- ✅ ثبت‌نام و ورود با Token Authentication (کوکی HttpOnly)
- ✅ پروفایل کاربر با آپلود تصویر پروفایل
- ✅ پشتیبانی از کاربران مهمان (بدون لاگین)
- ✅ **سطوح دسترسی ۱ تا ۵**: خریدار، غرفه‌دار، ناظر، مدیر، مالک سیستم

### 🏪 بازار غرفه‌داران
- ✅ صفحه عمومی هر غرفه با پست، استوری، هایلایت و Follow
- ✅ فهرست کامل غرفه‌داران با فیلتر استان/شهر/نوع فروشنده
- ✅ خرید مستقیم آگهی غرفه با رعایت حداقل سفارش
- ✅ کمیسیون خودکار و تسویه به کیف پول فروشنده
- ✅ پنل بررسی محتوا با دلیل رد و عملیات گروهی

### 🌾 ویژگی‌های تخصصی کشاورزی
- ✅ ویجت هواشناسی با توصیه زراعی
- ✅ ماشین‌حساب مصرف سم و کود
- ✅ انتخاب محصول کشاورزی (گندم، پسته، برنج، ...)
- ✅ تشخیص آفت با عکس
- ✅ خرید اقساطی با چک صیادی
- ✅ تخفیف پلکانی برای خرید عمده B2B

### 🎨 UI/UX
- ✅ طراحی کاملاً Responsive (موبایل، تبلت، دسکتاپ)
- ✅ Dark Mode با ذخیره در localStorage
- ✅ انیمیشن‌های نرم با Framer Motion
- ✅ فونت فارسی Vazirmatn
- ✅ پشتیبانی کامل از RTL

### 🔧 تکنیکال
- ✅ TypeScript برای type safety
- ✅ React Query برای مدیریت cache
- ✅ Zustand برای state management
- ✅ Vite Proxy برای ارتباط با Django
- ✅ WhiteNoise برای serving static files
- ✅ CORS و CSRF configuration

---

## 🛠️ تکنولوژی‌ها

### 🔙 Backend
| تکنولوژی | نسخه | توضیح |
|----------|------|-------|
| Python | 3.11+ | زبان برنامه‌نویسی |
| Django | 5.2 | فریم‌ورک وب |
| Django REST Framework | 3.15+ | ساخت API |
| PostgreSQL | 16+ | دیتابیس |
| Pillow | 10.0+ | پردازش تصاویر |
| django-cors-headers | 4.3+ | مدیریت CORS |
| django-filter | 24.0+ | فیلتر کردن API |
| whitenoise | 6.6+ | serving static files |
| python-decouple | 3.8+ | مدیریت environment variables |

### 🎨 Frontend
| تکنولوژی | نسخه | توضیح |
|----------|------|-------|
| React | 18.3 | کتابخانه UI |
| TypeScript | 5.7 | type safety |
| Vite | 6.0+ | build tool |
| Tailwind CSS | 4.0 | utility-first CSS |
| Framer Motion | 11.0+ | انیمیشن‌ها |
| React Router | 7.1+ | routing |
| React Query | 5.62+ | data fetching |
| Zustand | 5.0+ | state management |
| Axios | 1.7+ | HTTP client |
| Lucide React | 0.468+ | آیکون‌ها |
| React Hot Toast | 2.4+ | notifications |

---

## 📦 پیش‌نیازها

برای اجرای نسخهٔ توسعهٔ پروژه، این موارد را نصب کنید:

- ✅ **Python 3.11 یا 3.12** — پروژه Python 3.11+ را اعلام کرده و CI فعلی با Python 3.11 و 3.12 بررسی می‌شود.
- ✅ **Node.js 18+** — نسخهٔ پیشنهادی Node.js 22 به‌همراه npm 10 است.
- ✅ **Git** — در صورتی که پروژه را با clone دریافت می‌کنید.
- ✅ **یک مرورگر به‌روز** — Chrome، Firefox، Edge یا Safari.
- ✅ اتصال اینترنت برای نصب وابستگی‌ها و دریافت فونت Vazirmatn از CDN.
- ✅ آزاد بودن پورت‌های `8000` و `5173`.

> برای اجرای محلی با SQLite، نصب PostgreSQL لازم نیست. PostgreSQL فقط برای محیط Production یا تست با دیتابیس واقعی لازم است.
>
> پوشهٔ `venv/` موجود در بعضی نسخه‌های مخزن، یک محیط مجازی قدیمی و مخصوص Windows است و قابل انتقال بین کامپیوترها نیست. همیشه یک محیط مجازی جدید با نام `.venv` بسازید.

### وابستگی‌های Backend

وابستگی‌های اجرای Django در `garinkood/requirements.txt` و ابزارهای توسعه و تست در `garinkood/requirements-dev.txt` قرار دارند. برای توسعهٔ کامل، فایل دوم را نصب کنید؛ این فایل، فایل اول را نیز نصب می‌کند.

### وابستگی‌های Frontend

تمام وابستگی‌های React، TypeScript، Vite، Tailwind، Playwright و ابزارهای کیفیت کد در `frontend/package.json` و `frontend/package-lock.json` قرار دارند. نصب استاندارد با `npm ci` انجام می‌شود.

---

## 🚀 شروع سریع — فقط با دستور `runserver`

پس از نصب **Python 3.11 یا 3.12** و **Node.js 18 یا بالاتر**، در اولین اجرا فقط یک دستور لازم است. این دستور برای توسعهٔ محلی به‌صورت خودکار کارهای زیر را انجام می‌دهد:

1. ساخت محیط مجازی Python در `.venv` در صورت نبودن آن؛
2. ساخت `garinkood/.env` از روی `.env.example` در صورت نبودن آن؛
3. نصب یا بررسی وابستگی‌های Backend از `requirements.txt`؛
4. نصب یا بررسی وابستگی‌های Frontend با `npm ci`؛
5. اجرای migrationهای دیتابیس؛
6. بارگذاری استان‌ها، شهرها، نهاده‌ها و سطح دسترسی‌ها؛
7. ایجاد دادهٔ نمونهٔ بازار در حالت توسعه؛
8. اجرای هم‌زمان Django و Vite.

> این میان‌بُر، خود Python، Node.js، PostgreSQL یا Redis را نصب نمی‌کند؛ این برنامه‌ها باید روی سیستم وجود داشته باشند. در حالت پیش‌فرض توسعه، PostgreSQL و Redis لازم نیستند و SQLite استفاده می‌شود.

### اجرای پروژه از ریشهٔ مخزن

#### Linux و macOS

```bash
python3.11 garinkood/manage.py runserver
```

اگر دستور Python سیستم شما `python` است:

```bash
python garinkood/manage.py runserver
```

#### Windows PowerShell

```powershell
py -3.11 .\garinkood\manage.py runserver
```

یا اگر داخل پوشهٔ Backend هستید:

```powershell
cd .\garinkood
python manage.py runserver
```

در اولین اجرا ممکن است نصب بسته‌ها چند دقیقه طول بکشد. بعد از آن، هر بار با اجرای همین دستور، وابستگی‌ها و دیتابیس بررسی شده و هر دو سرور اجرا می‌شوند. با `Ctrl+C` اجرای Backend و Frontend متوقف می‌شود.

### گزینه‌های اختیاری

```bash
# فقط Backend، بدون اجرای Frontend
python garinkood/manage.py runserver --no-frontend

# اجرای سرور Frontend روی یک پورت دیگر
python garinkood/manage.py runserver --frontend-port 5174

# اجرا بدون ایجاد غرفه‌ها و حساب‌های نمونه
python garinkood/manage.py runserver --no-demo-data
```

برای غیرفعال‌کردن کامل نصب خودکار و استفاده از رفتار عادی Django:

```bash
GARINKOOD_AUTO_SETUP=0 python garinkood/manage.py runserver
```

در Windows PowerShell:

```powershell
$env:GARINKOOD_AUTO_SETUP="0"
python .\garinkood\manage.py runserver
```

### آدرس‌های دسترسی

- 🌐 **Frontend:** [http://localhost:5173](http://localhost:5173)
- 🔙 **Backend API:** [http://localhost:8000/api/](http://localhost:8000/api/)
- 👨‍💼 **پنل مدیریت:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

### ساخت حساب مدیر و محصول

ساخت superuser به‌دلیل نیاز به رمز محرمانه همچنان یک‌بار به‌صورت تعاملی انجام می‌شود:

```bash
python garinkood/manage.py createsuperuser
```

دادهٔ نمونهٔ بازار به‌صورت خودکار در حالت `DEBUG=True` ساخته می‌شود، اما کاتالوگ اصلی محصولات را باید از پنل `/admin/` ایجاد کنید. فایل `create_test_product.py` نیز برای ساخت یک محصول آزمایشی وجود دارد و کاربری با نام `admin` می‌خواهد.

---

## ⚙️ تنظیمات محیطی

### Backend — فایل `garinkood/.env`

فایل `garinkood/.env.example` را به `garinkood/.env` کپی کنید. تنظیمات پیش‌فرض برای توسعه:

```env
DEBUG=True
SECRET_KEY=replace-with-a-long-random-development-secret

DB_ENGINE=sqlite
DB_NAME=db.sqlite3
SQLITE_TIMEOUT=30

ALLOWED_HOSTS=localhost,127.0.0.1,testserver
SITE_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

> ساختن `.env` ضروری است. اگر این فایل وجود نداشته باشد، `settings.py` به‌صورت پیش‌فرض PostgreSQL را انتخاب می‌کند و برای `DB_NAME`، `DB_USER` و `DB_PASSWORD` مقدار می‌خواهد.

### Frontend — فایل `frontend/.env`

```env
VITE_PHONE_NUMBER=02112345678
VITE_WHATSAPP_NUMBER=989123456789
VITE_APP_NAME=گرین کود
VITE_APP_DESCRIPTION=فروشگاه تخصصی نهاده‌های کشاورزی

VITE_ENABLE_WEATHER_WIDGET=true
VITE_ENABLE_INSTALLMENT_CALCULATOR=true
VITE_ENABLE_CROP_SELECTOR=true
VITE_ENABLE_AGRI_CALCULATOR=true
VITE_DEV_MODE=true
```

API در کد فعلی با آدرس نسبی `/api` استفاده می‌شود. متغیر `VITE_API_BASE_URL` که در فایل نمونه توضیح داده شده، در حال حاضر آدرس API را تغییر نمی‌دهد.

---

## 🗄️ PostgreSQL، Redis و سرویس‌های اختیاری

### PostgreSQL

برای اجرای محلی SQLite کافی است. برای Production یا اجرای تست روی PostgreSQL 16، سرویس PostgreSQL را نصب کنید، یک Database و User بسازید و در `.env` قرار دهید:

```env
DB_ENGINE=postgresql
DB_NAME=garinkood
DB_USER=garinkood
DB_PASSWORD=یک-رمز-قوی
DB_HOST=127.0.0.1
DB_PORT=5432
DB_CONN_MAX_AGE=60
```

در این حالت وابستگی `psycopg2-binary` از requirements نصب می‌شود.

### Redis

در توسعهٔ تک‌پردازه لازم نیست. برای محیط چند Worker، یک Redis مشترک برای Cache و Rate Limit تنظیم کنید:

```env
CACHE_URL=redis://127.0.0.1:6379/1
```

در صورت فعال‌کردن `CACHE_URL`، بستهٔ Python زیر را نیز نصب کنید:

```bash
python -m pip install redis
```

### سرویس‌هایی که فعلاً نیاز نیستند

برای اجرای فعلی پروژه به کلید زرین‌پال، Stripe، PayPal، API هواشناسی، GPU، Docker، Celery یا سرویس هوش مصنوعی نیاز نیست. پرداخت واقعی هنوز فعال نیست، ویجت هواشناسی دادهٔ نمایشی دارد و جستجوی تصویری هنوز به موتور بینایی ماشین متصل نشده است.

---

## 🏭 Build و اجرای Production

### Frontend

```bash
cd frontend
npm run build
```

خروجی در `frontend/dist/` ایجاد می‌شود و باید توسط Nginx، Caddy یا وب‌سرور مشابه سرو شود. وب‌سرور باید برای مسیرهای React به `index.html` fallback داشته باشد.

### Backend

```bash
cd garinkood
python manage.py collectstatic --noinput
gunicorn garinkood.wsgi:application --bind 0.0.0.0:8000
```

در Production علاوه بر PostgreSQL، باید HTTPS، دامنه، `DEBUG=False`، `SECRET_KEY` واقعی، `ALLOWED_HOSTS`، `CORS_ALLOWED_ORIGINS` و `CSRF_TRUSTED_ORIGINS` تنظیم شوند. پوشهٔ `garinkood/products/` نیز باید برای نگهداری تصاویر آپلودی پایدار باشد.

---

## 📁 ساختار پروژه

```text
mysite/
│
├── 📁 frontend/                              # 🎨 پروژه React (فرانت‌اند)
│   ├── 📁 node_modules/                      # ⚠️ Library root (نباید commit شود)
│   ├── 📁 public/
│   │   └── 📁 images/
│   │       └── 📁 products/                  # 📸 تصاویر محصولات
│   ├── 📁 src/
│   │   ├── 📁 api/                           # 🔌 لایه ارتباط با API
│   │   │   ├── 📄 client.ts                  # ✅ Axios instance
│   │   │   └── 📄 services.ts                # ✅ API services
│   │   ├── 📁 components/                    # 🧩 کامپوننت‌های React (۲۲ فایل)
│   │   ├── 📁 data/
│   │   │   └── 📄 shopData.ts                # داده‌های استاتیک
│   │   ├── 📁 hooks/
│   │   │   └── 📄 useDarkMode.ts
│   │   ├── 📁 pages/                         # 📄 صفحات اصلی
│   │   │   ├── 📄 Login.tsx
│   │   │   └── 📄 Profile.tsx
│   │   ├── 📁 store/                         # 🗄️ Zustand stores
│   │   │   ├── 📄 authStore.ts
│   │   │   └── 📄 cartStore.ts
│   │   ├── 📁 types/
│   │   │   └── 📄 index.ts                   # ✅ TypeScript interfaces
│   │   ├── 📁 utils/
│   │   │   ├── 📄 cn.ts
│   │   │   └── 📄 formatPrice.ts
│   │   ├── 📄 App.tsx                        # ✅ اصلی با Router
│   │   ├── 📄 index.css                      # Tailwind + custom styles
│   │   └── 📄 main.tsx                       # ✅ با QueryClient
│   ├── 📄 index.html
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   └── 📄 vite.config.ts                     # ✅ با proxy
│
├── 📁 garinkood/                             # 🐍 پروژه Django (بک‌اند)
│   ├── 📁 garinkood/                         # ⚙️ پکیج اصلی Django
│   │   ├── 📄 settings.py                    # ✅ CORS + ALLOWED_HOSTS
│   │   ├── 📄 urls.py                        # ✅ Redirect به React
│   │   └── 📄 wsgi.py
│   ├── 📁 products/                          # 📸 Media files
│   ├── 📁 shop/                              # 🛒 اپلیکیشن فروشگاه
│   │   ├── 📁 migrations/
│   │   ├── 📄 admin.py
│   │   ├── 📄 api_urls.py                    # ✅ API URLs
│   │   ├── 📄 api_views.py                   # ✅ API Views
│   │   ├── 📄 models.py                      # ✅ مدل‌ها
│   │   ├── 📄 serializers.py                 # ✅ DRF Serializers
│   │   └── 📄 views.py
│   ├── 📁 staticfiles/                       # 📦 Static files
│   ├── 📄 .env                               # ✅ Environment variables
│   └── 📄 manage.py
│
├── 📁 .venv/                                 # 🐍 محیط مجازی Python (محلی و غیرقابل commit)
├── 📄 .gitignore
└── 📄 README.md
```

## 🔌 API Endpoints

📦 Products
Method
Endpoint
توضیح
GET
/api/products/
لیست محصولات (paginated)
GET
/api/products/{slug}/
جزئیات محصول
GET
/api/products/featured/
محصولات ویژه
GET
/api/products/by_category/?category=slug
محصولات بر اساس دسته
📂 Categories
Method
Endpoint
توضیح
GET
/api/categories/
لیست دسته‌بندی‌ها
GET
/api/categories/{slug}/
جزئیات دسته‌بندی
🛒 Cart
Method
Endpoint
توضیح
GET
/api/cart/
دریافت سبد خرید
POST
/api/cart/add/
افزودن به سبد
POST
/api/cart/remove/
حذف از سبد
POST
/api/cart/update_quantity/
به‌روزرسانی تعداد
👤 Authentication
Method
Endpoint
توضیح
POST
/api/auth/login/
ورود
POST
/api/auth/register/
ثبت‌نام
POST
/api/auth/logout/
خروج
GET
/api/profile/
دریافت پروفایل
PATCH
/api/profile/
به‌روزرسانی پروفایل
💬 Comments
Method
Endpoint
توضیح
GET
/api/comments/
لیست نظرات
POST
/api/comments/
ثبت نظر
GET
/api/comments/by_product/?product=slug
نظرات یک محصول
## 🧪 تست و کنترل کیفیت

### Backend

از پوشهٔ `garinkood`:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test shop
```

### Frontend

از پوشهٔ `frontend`:

```bash
npm run type-check
npm run lint
npm run build
```

### تست مرورگر با Playwright

برای اجرای تست‌های E2E، Backend را اجرا کنید، Frontend را Build کنید و مرورگرهای Playwright را نصب کنید:

```bash
cd frontend
npm ci
npx playwright install              # Linux: در صورت نیاز --with-deps
npm run build
npm run test:e2e
```

تست‌های مرورگر به Chromium، Firefox، WebKit و وابستگی‌های سیستمی مرورگر نیاز دارند. تست‌های بخش مدیریت در صورت تنظیم `E2E_MODERATOR_USERNAME` و `E2E_MODERATOR_PASSWORD` اجرا می‌شوند.

---

## 🌍 متغیرهای Production

حداقل تنظیمات PostgreSQL در Production:

```env
DEBUG=False
SECRET_KEY=یک-کلید-طولانی-و-تصادفی-منحصر‌به‌فرد

DB_ENGINE=postgresql
DB_NAME=garinkood
DB_USER=garinkood
DB_PASSWORD=رمز-دیتابیس
DB_HOST=127.0.0.1
DB_PORT=5432

ALLOWED_HOSTS=your-domain.com,www.your-domain.com
SITE_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com
CORS_ALLOWED_ORIGINS=https://your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com
```

کلیدهای پرداخت را تا زمان پیاده‌سازی و تست کامل درگاه، فعال نکنید. اطلاعات محرمانه را در Git یا فایل `.env.example` قرار ندهید.

---

## 🤝 مشارکت

مشارکت شما باعث خوشحالی ماست! 🎉
Fork پروژه را بگیرید
Branch جدید بسازید (git checkout -b feature/AmazingFeature)
Commit کنید (git commit -m 'Add some AmazingFeature')
Push کنید (git push origin feature/AmazingFeature)
Pull Request باز کنید
## 📝 لایسنس

این پروژه تحت لایسنس MIT منتشر شده است - جزئیات را در فایل LICENSE ببینید.
## 👥 تیم توسعه

توسعه‌دهنده اصلی - [imannosrati]
طراح UI/UX - [imannosrati]
## 📞 تماس

🌐 وبسایت: garinkood.ir
📧 ایمیل: info@garinkood.ir
📱 تلفن: ۰۲۱-۱۲۳۴۵۶۷۸
## 🙏 قدردانی

🎨 Tailwind CSS
⚛️ React
🐍 Django
🎬 Framer Motion
🎯 Lucide Icons
<div align="center">

ساخته شده با ❤️ برای کشاورزان ایران
⭐ اگر این پروژه برایتان مفید بود، لطفاً یک ستاره بدهید!
</div>
