# راهنمای وابستگی‌های Python گرین کود

## فایل‌ها

| فایل | کاربرد |
|---|---|
| `garinkood/requirements.txt` | فقط وابستگی‌های runtime برای اجرای Django API در production |
| `garinkood/requirements-dev.txt` | runtime به‌علاوه ابزارهای تست، HTTP smoke test و audit امنیتی |
| `frontend/package.json` | تمام وابستگی‌های Node/React/Vite/Playwright؛ این‌ها نباید در requirements Python قرار بگیرند |

## نصب production

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r garinkood/requirements.txt
```

## نصب محیط توسعه

```bash
python -m pip install -r garinkood/requirements-dev.txt
cd frontend
npm ci
```

## بررسی وابستگی‌ها

```bash
# بررسی آسیب‌پذیری Python runtime
pip-audit -r garinkood/requirements.txt

# کنترل کیفیت backend
cd garinkood
python manage.py check
python manage.py test shop

# کنترل کیفیت frontend
cd ../frontend
npm run lint
npm run type-check
npm run build
```

## نکات مهم

- نسخه‌های runtime به‌صورت دقیق pin شده‌اند تا deployment قابل تکرار باشد.
- packageهای پرداخت خارجی، Redis، Celery، AI یا storage تا زمانی که واقعاً در کد و configuration فعال نشده‌اند، عمداً به runtime اضافه نشده‌اند؛ اضافه‌کردن dependency بدون integration فقط سطح حمله و هزینه نگهداری را بالا می‌برد.
- credentialهای payment provider یا سرویس خارجی هرگز نباید در `requirements.txt`، `.env.example` واقعی یا Git قرار بگیرند.
- `psycopg2-binary` برای استقرار container/local فعلی انتخاب شده است. در buildهای native سازمانی می‌توان آن را با `psycopg2` کامپایل‌شده جایگزین کرد.
