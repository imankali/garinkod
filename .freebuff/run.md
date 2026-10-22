# اجرای محلی GarinKood (پیش‌نمایش)

## ۱) تولید آرتیفکت‌ها
- پیش‌نیازها: `venv/` موجود (pip requirements پروژه) و `frontend/node_modules` (در صورت نبود: `npm install` داخل `frontend`).
- دیتابیس: `garinkood/db.sqlite3` از قبل موجود است؛ اگر مایگریشن اعمال نشده بود:
  `cd garinkood` سپس با متغیرهای `DB_ENGINE=sqlite DEBUG=True SECRET_KEY=django-insecure-local-development-only` دستور `python manage.py migrate` اجرا شود.
- آرتیفکت build لازم نیست؛ هر دو سرور حالت توسعه هستند.

## ۲) اجرای سرورها (هر دو جدا و detached)

### انتخاب پورت بک‌اند — مهم ⚠️
- پورت ۸۰۰۰ و ۸۰۰۱ معمولاً توسط برنامهٔ شخصی کاربر (`C:\Users\iman\laya_server.py`) اشغال است — **هرگز آن پروسه را نکشید.**
- قبل از استارت، بررسی کنید: `netstat -ano | findstr :8000` → اگر اشغال بود جنگو روی **۸۰۱۰** بالا بیاید
  (اگر ۸۰۱۰ هم بود اولین پورت آزاد بعدی).
- `vite.config.ts` هدف پراکسی `/api` و `/media` و `/static` را از متغیر محیطی `DJANGO_PORT` می‌خواند (پیش‌فرض 8000)،
  پس فقط env را ست کنید، نه ویرایش کانفیگ.

- بک‌اند (Django :8010 وقتی 8000 اشغال است) — پاورشل:
  ```
  $env:DB_ENGINE='sqlite'; $env:DEBUG='True'; $env:SECRET_KEY='django-insecure-local-development-only'
  (Start-Process -FilePath 'D:\project\mysite\venv\Scripts\python.exe' -ArgumentList 'manage.py','runserver','127.0.0.1:8010','--noreload' -WorkingDirectory 'D:\project\mysite\garinkood' -RedirectStandardOutput 'D:\project\mysite\.freebuff\django-8010.log' -RedirectStandardError 'D:\project\mysite\.freebuff\django-8010.log.err' -WindowStyle Hidden -PassThru).Id
  ```
  (خروجی `PassThru` گاهی چسبیده و تایم‌اوت می‌شود؛ پروسه ساخته می‌شود — با `netstat -ano | findstr :8010` تأیید شود.)
- فرانت (Vite :5173) — پاورشل؛ حتماً `DJANGO_PORT` را هم‌سان با پورت بک‌اند ست کنید:
  ```bash
  DJANGO_PORT=8010 powershell -NoProfile -Command "Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory 'D:\project\mysite\frontend' -RedirectStandardOutput 'D:\project\mysite\.freebuff\preview-bdc01235-bfe5-4110-b0aa-d18042948d35.log' -RedirectStandardError 'D:\project\mysite\.freebuff\preview-bdc01235-bfe5-4110-b0aa-d18042948d35.log.err' -WindowStyle Hidden"
  ```
  (پیشوند `DJANGO_PORT=8010` از bash می‌آید؛ `$env:` داخل `-Command` هنگام فراخوانی از bash قابل‌اتکا نیست.)
- بررسی سلامت: `http://127.0.0.1:5173/` (200) و `http://127.0.0.1:8010/health/live/` (200) و
  `http://127.0.0.1:5173/api/marketplace/storefronts/` باید JSON واقعی برگرداند (نه `{"detail":"Not Found"}`).
- Vite با پروکسی `/api` و `/media` به پورت `DJANGO_PORT` (بدون `changeOrigin` تا Host واقعی حفظ شود).

## ۳) نکته دسترسی گوشی
- IP وای‌فای واقعی (آداپتور Wi-Fi، نه آداپتورهای مجازی Hyper-V) + پورت 5173؛ قانون فایروال «GarinKood dev 5173» از قبل اضافه شده است.
