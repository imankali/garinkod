
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

[🚀 راه‌اندازی Production](#-راهاندازی-production) • [🧪 اجرای محلی](#-اجرای-محلی-توسعه) • [🎨 ویژگی‌ها](#-ویژگی‌ها)

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

## 📦 پیش‌نیازهای Production

برای اجرای واقعی پروژه روی VPS یا سرور Linux، این موارد باید از قبل نصب و آماده باشند:

- ✅ **Python 3.11 یا 3.12**
- ✅ **Node.js 18+ و npm 9+** — فقط برای Build کردن Frontend
- ✅ **PostgreSQL 16+** — دیتابیس Production
- ✅ **Redis** — برای Cache و Rate Limit در اجرای چند Worker
- ✅ **Nginx یا Caddy** — برای سرو Frontend، Proxy کردن API و TLS
- ✅ **دامنه و گواهی HTTPS**
- ✅ فضای دائمی برای `garinkood/products/` جهت تصاویر آپلودی

برای اجرای محلی توسعه، PostgreSQL و Redis ضروری نیستند و SQLite کافی است.

> پوشهٔ `venv/` موجود در بعضی نسخه‌های مخزن، یک محیط مجازی قدیمی و مخصوص Windows است و قابل انتقال نیست. در سرور Production همیشه `.venv` را روی همان سرور بسازید.

### وابستگی‌های پروژه

- وابستگی‌های پایهٔ Python در `garinkood/requirements.txt` قرار دارند.
- وابستگی‌های Production، شامل `redis-py`، در `garinkood/requirements-production.txt` قرار دارند.
- وابستگی‌های توسعه و تست در `garinkood/requirements-dev.txt` قرار دارند.
- وابستگی‌های React در `frontend/package.json` و `frontend/package-lock.json` قرار دارند.

---

## 🚀 راه‌اندازی Production

### نکتهٔ مهم دربارهٔ `runserver`

`python manage.py runserver` و `npm run dev` سرور توسعه هستند و برای دریافت ترافیک واقعی، HTTPS، چند Worker و مدیریت خطا طراحی نشده‌اند. در حالت `DEBUG=False`، دستور `runserver` عمداً متوقف می‌شود تا به‌صورت تصادفی در Production استفاده نشود.

در Production، Frontend باید Build و توسط Nginx/Caddy سرو شود و Backend با Gunicorn اجرا شود.

### ۱. ساخت تنظیمات Production

فایل زیر را روی سرور بسازید:

```bash
cp garinkood/.env.example garinkood/.env
```

سپس `garinkood/.env` را با مقادیر واقعی و محرمانه ویرایش کنید:

```env
GARINKOOD_ENV=production
DEBUG=False
SECRET_KEY=یک-کلید-طولانی-تصادفی-و-منحصر‌به‌فرد

DB_ENGINE=postgresql
DB_NAME=garinkood
DB_USER=garinkood
DB_PASSWORD=رمز-قوی-دیتابیس
DB_HOST=127.0.0.1
DB_PORT=5432
DB_CONN_MAX_AGE=60

CACHE_URL=redis://127.0.0.1:6379/1

ALLOWED_HOSTS=your-domain.com,www.your-domain.com
SITE_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com,https://www.your-domain.com
SECURE_SSL_REDIRECT=True
```

فایل `.env` واقعی را در Git قرار ندهید و از `SECRET_KEY` توسعه استفاده نکنید. دسترسی آن را نیز محدود کنید:

```bash
chmod 600 garinkood/.env
```

### ۲. Deploy کنترل‌شده

این مرحله فقط هنگام نصب اولیه یا انتشار نسخهٔ جدید اجرا می‌شود؛ نه در هر Restart سرویس:

```bash
./scripts/deploy-production.sh
```

این اسکریپت، به‌ترتیب، `.venv` و `requirements-production.txt` را نصب می‌کند، `npm ci` و `npm run build` را اجرا می‌کند، تنظیمات Production را بررسی می‌کند و سپس migration، داده‌های مرجع و `collectstatic` را اجرا می‌کند. `redis-py` برای استفاده از Cache مشترک در محیط Production به‌صورت نسخه‌دار نصب می‌شود. دادهٔ دمو در این مسیر اجرا نمی‌شود.

اگر می‌خواهید تمام انتشار و اجرای موقت Gunicorn با یک فرمان انجام شود:

```bash
./scripts/deploy-production.sh --start
```

برای سرویس دائمی، بهتر است Deploy را جدا از Runtime انجام دهید و systemd فقط `scripts/start-production.sh` را اجرا کند:

```bash
./scripts/start-production.sh
```

برای نصب نمونهٔ systemd، بعد از اصلاح مسیرها و کاربر در فایل نمونه:

```bash
sudo cp deploy/systemd/garinkood.service.example /etc/systemd/system/garinkood.service
sudo systemctl daemon-reload
sudo systemctl enable --now garinkood
```

اسکریپت Runtime هیچ package نصب نمی‌کند، فایل `.env` نمی‌سازد، migration/collectstatic انجام نمی‌دهد و seed دمو اجرا نمی‌کند؛ فقط preflight امنیتی را اجرا و Gunicorn را روی `127.0.0.1:8000` اجرا می‌کند. پس از هر Deploy، سرویس را با `sudo systemctl restart garinkood` دوباره اجرا کنید.

### ۳. تنظیم Nginx

نمونهٔ تنظیمات Reverse Proxy در فایل زیر قرار دارد:

```text
deploy/nginx/garinkood.conf.example
```

قبل از فعال‌سازی، دامنه و مسیر `/srv/garinkood` را تغییر دهید. Nginx باید:

- `frontend/dist/` را سرو کند؛
- مسیرهای `/api/` و `/admin/` را به Gunicorn روی `127.0.0.1:8000` Proxy کند؛
- مسیرهای `/media/` و `/static/` را سرو کند؛
- برای React Router به `/index.html` fallback داشته باشد؛
- HTTPS را فعال کند.

---

## 🧪 اجرای محلی توسعه

برای توسعهٔ محلی، قابلیت میان‌بُر قبلی همچنان وجود دارد و فقط با `DEBUG=True` فعال می‌شود:

```bash
python garinkood/manage.py runserver
```

در این حالت وابستگی‌های محلی، SQLite، migrationها، داده‌های نمونه و Vite به‌صورت خودکار آماده می‌شوند. این میان‌بُر را برای Production استفاده نکنید.

آدرس‌های محلی:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000/api/`
- پنل مدیریت: `http://localhost:8000/admin/`

برای ساخت حساب مدیر، یک‌بار این دستور را در محیط توسعه اجرا کنید:

```bash
python garinkood/manage.py createsuperuser
```

---

## ⚙️ تنظیمات محیطی

### Backend — فایل `garinkood/.env`

برای تنظیم دستی، فایل `garinkood/.env.example` را به `garinkood/.env` کپی کنید. میان‌بُر `runserver` در اولین اجرای محلی، همین فایل توسعه را در صورت نبودن می‌سازد. تنظیمات پیش‌فرض برای توسعه:

```env
GARINKOOD_ENV=development
DEBUG=True
SECRET_KEY=replace-with-a-long-random-development-secret

DB_ENGINE=sqlite
DB_NAME=db.sqlite3
SQLITE_TIMEOUT=30

ALLOWED_HOSTS=localhost,127.0.0.1,testserver
SITE_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

> اگر این فایل وجود نداشته باشد و از یک فرمان غیر از shortcut توسعه استفاده کنید، `settings.py` به‌صورت پیش‌فرض PostgreSQL را انتخاب می‌کند و برای `DB_NAME`، `DB_USER` و `DB_PASSWORD` مقدار می‌خواهد. سرویس Production همیشه باید `.env` واقعی و بررسی‌شده داشته باشد.

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

## 🔐 چک‌لیست ایمنی Production

- `DEBUG=False` و `GARINKOOD_ENV=production` تنظیم شده باشد.
- `SECRET_KEY`، رمز PostgreSQL و کلیدهای سرویس‌ها واقعی، طولانی و خارج از Git باشند.
- `ALLOWED_HOSTS`، `CORS_ALLOWED_ORIGINS` و `CSRF_TRUSTED_ORIGINS` فقط دامنه‌های واقعی را شامل شوند.
- HTTPS، redirect امن و کوکی‌های secure فعال باشند.
- `python manage.py runserver` و `npm run dev` هرگز به‌عنوان سرویس Production اجرا نشوند.
- `seed_demo_marketplace` فقط برای توسعه است و اسکریپت Production آن را اجرا نمی‌کند.
- از PostgreSQL و پوشهٔ دائمی تصاویر Backup بگیرید.
- پس از هر تغییر وابستگی، `scripts/provision-production.sh` را اجرا کنید؛ Restart سرویس فقط `scripts/start-production.sh` را اجرا کند.

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
