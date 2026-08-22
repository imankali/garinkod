# گزارش بررسی باگ‌های فرانت‌اند — ۲۲ اوت ۲۰۲۶

## دامنهٔ بررسی

- تمام routeهای SPA: خانه، محصولات، جزئیات محصول، checkout، سفارش‌ها، خدمات، فروش محصول کشاورز، marketplace، پشتیبانی، affiliate، finance، studio، rewards، management، profile و login
- TypeScript strict type check
- ESLint
- Vite production build
- ارتباط API در preview محلی

## ایرادهای پیدا شده و اصلاح‌شده

| مورد | اثر احتمالی | اصلاح |
|---|---|---|
| ESLint 9 config نداشت | `npm run lint` شکست می‌خورد و کیفیت فرانت قابل کنترل نبود | `frontend/eslint.config.js` اضافه شد؛ lint بدون warning/error پاس می‌شود. |
| Hook dependency ناقص در CartDrawer، MegaMenu، Affiliate، Studio و Management | stale state، refetch تکراری یا رفتار غیرقابل پیش‌بینی | `useCallback`/`useMemo` و dependencyهای کامل اضافه شدند. |
| ناوبری موبایل با `window.location.href` | hard reload، از دست‌رفتن cache و state کلاینت | MobileBottomNav، MobileMenu، ProfileMenu و CartDrawer به `useNavigate` منتقل شدند. |
| کپی کد تخفیف/affiliate در برخی مرورگرها unhandled rejection می‌داد | دکمه کپی ممکن بود بدون بازخورد شکست بخورد | utility `copyText` با fallback اضافه شد؛ پیام موفقیت/خطا نشان داده می‌شود. |
| Props خالی در TopBar/ProfileMenu | lint error و کد زائد | interface/destructuring اصلاح شد. |
| staff بدون role می‌توانست dashboard عملیات ببیند | ریسک دسترسی بیش از حد به داده عملیاتی | dashboard برای کارمند بدون group مسدود شد؛ PII سفارش فقط برای role دارای `view_order` بازمی‌گردد و KPIهای حساس برای role نامرتبط `محدود` نشان داده می‌شوند. |
| Clipboard و مسیرهای مدیریت نیاز به fallback/error handling داشتند | تجربه ناقص در مرورگرهای محدود | fallback و toast اضافه شدند. |

## کنترل‌های پاس‌شده

```text
npm run lint:           PASS
npm run type-check:     PASS
npm run build:          PASS
Django tests:           PASS (17 tests)
Django system check:    PASS
Django migration check: PASS
```

## مسیرهای بررسی‌شده در preview

تمام این مسیرها پاسخ ۲۰۰ SPA دادند:

```text
/
/products
/products/:slug
/checkout
/orders
/services
/farmer-sell
/marketplace
/support
/affiliate
/finance
/studio
/rewards
/management
/profile
/login
```

## باگ/ریسک باقی‌مانده که نیازمند فاز بعد است

1. **E2E browser tests نداریم.** پاسخ ۲۰۰ و build کافی نیست؛ باید Playwright/Cypress برای ثبت‌نام، checkout، coupon، مدیریت نقش، ارسال کامنت و studio اضافه شود.
2. **ترجمه کامل نیست.** زیرساخت i18n وجود دارد، اما صفحات legacy هنوز متن فارسی دارند و باید با ترجمه انسانی تکمیل شوند.
3. **Cookie auth جایگزین token localStorage شد.** cookie با HttpOnly/SameSite/secure production تنظیم می‌شود؛ برای production باید CSRF strategy و domain/proxy cookie policy نیز مرور شود.
4. **صفحات بزرگ فشرده‌اند.** بعضی pageها مانند Profile/Marketplace/Management باید به componentهای کوچک‌تر شکسته شوند تا نگهداری و تست آسان‌تر شود.
5. **Accessibility audit کامل لازم است.** focus trap modalها، keyboard navigation، رنگ کنتراست و screen reader test باید با ابزار خودکار و دستی بررسی شوند.
6. **حالت‌های offline/network ضعیف‌اند.** برخی صفحه‌ها API error را فقط toast می‌کنند و retry UI یا empty-state کامل ندارند.
7. **Playwright suite اضافه شد اما browser binary در این sandbox به علت قطع download اجرا نشد.** در CI یا ماشین deploy، `npx playwright install chromium` و سپس `npm run test:e2e` اجرا شود.
8. **Preview route ۲۰۰ به معنی تست بصری کامل نیست.** مرورگر واقعی در اندازه‌های موبایل/تبلت/دسکتاپ باید با screenshot regression کنترل شود.
