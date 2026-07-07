
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

### 👤 احراز هویت
- ✅ ثبت‌نام و ورود با Token Authentication
- ✅ پروفایل کاربر با امکان ویرایش
- ✅ پشتیبانی از کاربران مهمان (بدون لاگین)

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

قبل از شروع، مطمئن شوید که این‌ها نصب شده‌اند:

- ✅ **Python 3.11+** - [دانلود](https://www.python.org/downloads/)
- ✅ **Node.js 18+** - [دانلود](https://nodejs.org/)
- ✅ **PostgreSQL 16+** - [دانلود](https://www.postgresql.org/download/)
- ✅ **Git** - [دانلود](https://git-scm.com/)

---

## 🚀 شروع سریع

### ۱. کلون کردن پروژه

```bash
git clone https://github.com/your-username/garinkood.git
cd garinkood
۲. راه‌اندازی Backend (Django)
# ساخت virtual environment
python -m venv venv

# فعال‌سازی virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# نصب dependencies
pip install -r requirements.txt

# ساخت فایل .env
cd garinkood
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/Mac

# ویرایش .env و وارد کردن اطلاعات دیتابیس

# ساخت migrations
python manage.py makemigrations

# اعمال migrations
python manage.py migrate

# ساخت superuser (ادمین)
python manage.py createsuperuser

# اجرای سرور Django
python manage.py runserver 0.0.0.0:8000
۳. راه‌اندازی Frontend (React)
# در یک terminal جدید
cd frontend

# نصب dependencies
npm install

# کپی فایل .env
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/Mac

# اجرای سرور Vite
npm run dev
۴. دسترسی به پروژه
🌐 فرانت‌اند: http://localhost:5173
🔙 بک‌اند API: http://localhost:8000/api/
👨‍💼 پنل ادمین: http://localhost:8000/admin/
📁 ساختار پروژه
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
├── 📁 venv/                                  # 🐍 محیط مجازی Python
├── 📄 .gitignore
└── 📄 README.md
🔌 API Endpoints
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
🧪 تست
Backend Tests
cd garinkood
python manage.py test shop
Frontend Type Check
cd frontend
npm run type-check
Frontend Lint
cd frontend
npm run lint
🏗️ Build برای Production
Frontend
cd frontend
npm run build
خروجی در پوشه frontend/dist/ قرار می‌گیرد.
Backend
cd garinkood
python manage.py collectstatic
فایل‌های static در پوشه staticfiles/ جمع‌آوری می‌شوند.
🌍 Environment Variables
Backend (garinkood/.env)
SECRET_KEY=your-secret-key-here
DEBUG=True
DB_NAME=garinkood
DB_USER=postgres
DB_PASSWORD=your-password
DB_HOST=localhost
DB_PORT=5432
Frontend (frontend/.env)
VITE_PHONE_NUMBER=02112345678
VITE_WHATSAPP_NUMBER=989123456789
VITE_APP_NAME=گرین کود
🤝 مشارکت
مشارکت شما باعث خوشحالی ماست! 🎉
Fork پروژه را بگیرید
Branch جدید بسازید (git checkout -b feature/AmazingFeature)
Commit کنید (git commit -m 'Add some AmazingFeature')
Push کنید (git push origin feature/AmazingFeature)
Pull Request باز کنید
📝 لایسنس
این پروژه تحت لایسنس MIT منتشر شده است - جزئیات را در فایل LICENSE ببینید.
👥 تیم توسعه
توسعه‌دهنده اصلی - [imannosrati]
طراح UI/UX - [imannosrati]
📞 تماس
🌐 وبسایت: garinkood.ir
📧 ایمیل: info@garinkood.ir
📱 تلفن: ۰۲۱-۱۲۳۴۵۶۷۸
🙏 قدردانی
🎨 Tailwind CSS
⚛️ React
🐍 Django
🎬 Framer Motion
🎯 Lucide Icons
<div align="center">

ساخته شده با ❤️ برای کشاورزان ایران
⭐ اگر این پروژه برایتان مفید بود، لطفاً یک ستاره بدهید!
</div>
```