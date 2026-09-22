# ممیزی مقیاس‌پذیری و تکرار کد گرین‌کود

**تاریخ بررسی:** ۲۲ سپتامبر ۲۰۲۶
**دامنه:** کد همین مخزن؛ بدون ادعای اندازه‌گیری production
**نتیجهٔ کوتاه:** پروژه از نظر قابلیت‌ها بزرگ شده، اما هنوز چند مرز معماری مهم در فرانت‌اند و بک‌اند با فایل‌های مادرِ بسیار بزرگ نگه داشته شده‌اند. بهترین مسیر، شکستن تدریجی همین مرزهاست؛ مهاجرت یک‌باره به microservice یا بازنویسی کامل ارزش ریسک آن را ندارد.

---

## ۱. شواهد اندازه‌گیری‌شده

| بخش | فایل/خطوط تقریبی | مسئلهٔ اصلی |
|---|---:|---|
| `frontend/src` | ۲۴۷ فایل، ۵۱٬۰۸۲ خط | صفحات و کامپوننت‌های domainمحور، اما بدون مرز رسمی feature |
| بک‌اند Python | ۲۴۲ فایل، ۴۹٬۰۱۲ خط با migration و تست | اپ `shop` هنوز چند bounded context را هم‌زمان حمل می‌کند |
| بک‌اند runtime | ۱۳۵ فایل، ۲۹٬۴۸۷ خط بدون migration و تست | نقطهٔ تمرکز منطق در view/serializerهای بزرگ |
| `frontend/src/components/management/ContentStudio.tsx` | حدود ۸۰٫۹KiB | چند فرم و editor مستقل در یک کامپوننت |
| `garinkood/shop/api_views.py` | حدود ۱۵۷٫۵KB | auth، catalog، cart، order، marketplace، finance و management در یک فایل |
| `garinkood/shop/serializers.py` | حدود ۱۰۷٫۳KB | قراردادهای چند دامنه در یک namespace |
| `frontend/src/api/services.ts` | اکنون facade حدود ۰٫۳KB؛ implementationهای domain حدود ۱٬۳۹۲ خط | endpointها در ۸ ماژول domain قرار گرفته‌اند و facade برای سازگاری باقی مانده است |

این اعداد «ظرفیت production» نیستند؛ فقط سطح coupling و هزینهٔ تغییر را نشان می‌دهند. ظرفیت واقعی همچنان باید با PostgreSQL، Redis، تصاویر واقعی و چند worker روی staging اندازه‌گیری شود.

---

## ۲. تکرارهای قطعی پیدا‌شده و اصلاح‌شده

### ۲.۱ ساخت payload آگهی برای دایرکت — سه کپی

این projection در سه محل تکرار شده بود:

- `components/MarketplaceListingCard.tsx`
- `components/storefront/ListingDetailModal.tsx`
- `pages/StorefrontPage.tsx`

هر سه، شناسه، عنوان، قیمت، تصویر و نام غرفه را جداگانه به `openDirect` می‌ساختند. این نوع تکرار خطرناک است: اضافه شدن یک فیلد به قرارداد پیام باید در سه فایل هم‌زمان انجام شود.

**اصلاح:** `src/utils/listingPayload.ts::toAttachedListing` اکنون تنها صاحب این projection است و هر سه caller از آن استفاده می‌کنند. این تابع عمداً فقط `AttachedListing` کوچک دایرکت را می‌سازد و کل شیء marketplace را وارد state پیام نمی‌کند.

### ۲.۲ موتور rail افقی — دو کپی بزرگ

منطق زیر در `OfferRail` و `ListingRail` تقریباً یکسان بود:

- محاسبهٔ اندازهٔ کارت و علامت اسکرول در RTL
- توقف روی hover و touch
- `requestAnimationFrame` با easing
- توقف autoplay خارج از viewport
- احترام به `prefers-reduced-motion`
- برگشت به ابتدای rail در انتها

**اصلاح:** `src/hooks/useHorizontalRail.ts::useHorizontalRail` این قرارداد را یک‌جا نگه می‌دارد. دو rail فقط تفاوت domain خود را اعلام می‌کنند: تعداد آیتم، سرعت autoplay و اندازهٔ fallback. ظاهر کارت‌ها در componentهای خودشان باقی مانده است؛ بنابراین abstraction بیش از حد ایجاد نشده است.

### ۲.۳ صفحه‌بندی — سه کپی UI

ساختار دکمه‌های «قبلی / صفحه X از Y / بعدی» در این سه سطح تکرار شده بود:

- `components/management/ModerationQueue.tsx`
- `components/management/UserLevels.tsx`
- `pages/Finance.tsx`

**اصلاح:** `src/components/ui/Pagination.tsx` primitive مشترک صفحه‌بندی است و اختلاف فقط `ariaLabel` و state صفحه است.

### ۲.۴ انتخاب کانال خبرنامه — دو کپی UI

selector موبایل/ایمیل با همان گزینه‌ها، کلاس‌ها و رفتار در `components/NewsletterForm.tsx` و `pages/Newsletter.tsx` تکرار شده بود. اکنون `components/newsletter/ChannelToggle.tsx` primitive دامنه‌ای مشترک است و هر دو مصرف‌کننده فقط state خود را به آن می‌دهند؛ در همین نقطه `aria-pressed` نیز صریح شده است.

### ۲.۵ وضعیت خطای قابل retry برای query — دو کپی UI

کارت خطای `React Query` با آیکن، پیام API و دکمهٔ retry در `pages/ExportDashboard.tsx` و `pages/OrderTrackingPage.tsx` یکسان بود. `components/ui/QueryErrorState.tsx` این shell را مشترک می‌کند و title/message را از صفحه می‌گیرد؛ تفاوت domain در صفحه باقی می‌ماند.

### ۲.۶ قرارداد ثبت‌نام — دو type literal

بدنهٔ `register` در `api/services/auth.ts` و قرارداد action در `store/authStore.ts` عیناً دوباره نوشته شده بود. اکنون `types/user.ts::RegisterPayload` منبع واحد هر دو است؛ API shape تغییر نکرده است.

### ۲.۷ دو باگ قابل‌مشاهده در تست full-suite که در همین بررسی اصلاح شدند

بررسی فقط به شکل فایل‌ها محدود نماند و suite بک‌اند یک regression واقعی را نشان داد:

- در `CommentViewSet.helpful`، بعد از حذف رأی، همان `QuerySet` ارزیابی‌شده دوباره استفاده می‌شد؛ cache داخلی Django رأی حذف‌شده را برمی‌گرداند و پاسخ اشتباهاً `voted=true` می‌داد. lookup رأی اکنون بعد از mutation دوباره query می‌شود.
- رجیستری تست امنیتی `ApiPermissionPolicyTests`، `HeroSlideViewSet` عمومی را در فهرست public policy نداشت؛ endpoint عملاً policy داشت اما تست آن را به‌عنوان public route بازبینی‌نشده گزارش می‌کرد. نام آن به registry اضافه شد تا policy عمومی قابل ردیابی بماند.

این دو مورد duplication نبودند، اما نمونهٔ خوبی‌اند که چرا refactor باید کنار تست واقعی انجام شود، نه فقط با grep یا compile.

### ۲.۸ تکرارهای مشابهی که فعلاً ادغام نشدند

- `ProductCard` و `MarketplaceListingCard` ظاهر مشابه دارند اما قرارداد، قیمت‌گذاری، مالک و رفتار خریدشان یکی نیست. ادغام آن‌ها در یک کارت با ده‌ها flag، coupling را بیشتر می‌کند.
- `ListingDetailModal` و modalهای محصول از primitive مشترک `ui/Modal` استفاده می‌کنند، اما محتوای domain خود را حفظ کرده‌اند.
- گزینهٔ checkbox/filter در `components/shop/FilterPopover.tsx` و `pages/shop/ShopFilterBar.tsx` حدوداً تکرار شده است؛ قبل از استخراج باید معلوم شود هر دو از یک مدل filter و یک قرارداد accessibility استفاده می‌کنند.
- overlay در `components/CompareModal.tsx` و `components/WishlistModal.tsx` شبیه است، اما بهتر است ابتدا primitive modal/overlay موجود بررسی شود و با wrapperهای متعدد دوباره abstraction ساخته نشود.
- فرم‌های مدیریت در `ContentStudio` کنترل‌های ورودی مشابه دارند؛ این‌ها کاندیدای استخراج به `management/ui` هستند، اما جابه‌جایی کامل آن فایل باید با تست فرم‌ها و snapshot/رفتار فعلی انجام شود.

اصل تصمیم: فقط کدی که **رفتار و قرارداد یکسان** دارد به shared منتقل شود، نه هر چیزی که ظاهراً شبیه است.

---

## ۳. اولین گام پوشه‌بندی که انجام شد

`frontend/src/api/services.ts` از یک فایل monolith به APIهای دامنه‌ای تقسیم شد:

```text
frontend/src/api/
  client.ts                    # axios، CSRF، session و error policy
  services.ts                  # compatibility barrel برای importهای قدیمی
  services/
    index.ts                   # public barrel
    auth.ts                    # login، profile، level، avatar
    catalog.ts                 # product، category، comment
    commerce.ts                # cart، order، payment، finance، trust
    content.ts                 # article، page، legal، service، newsletter
    farming.ts                 # location، agri input، land، consultation
    management.ts              # management dashboard، moderation، ops
    marketplace.ts             # storefront، listing، post
    messaging.ts               # conversation، message، desk
```

کدهای قدیمی هنوز با `import { productsApi } from '../api/services'` کار می‌کنند. این compatibility layer عمداً باقی مانده است تا refactor یک‌باره و پرریسک نشود. کد جدید بهتر است dependency محدود بگیرد:

```ts
import { productsApi } from '@/api/services/catalog';
import { messagesApi } from '@/api/services/messaging';
```

در مرحلهٔ بعد، هر فایل هنگام تغییر خودش به import دامنه‌ای منتقل شود و پس از صفر شدن مصرف legacy barrel، `services.ts` حذف شود.

---

## ۴. ساختار پیشنهادی نهایی فرانت‌اند

ساختار فعلی کاملاً خراب نیست؛ پوشه‌های `components/home`، `components/storefront`، `components/direct` و typeهای domain قدم‌های درستی هستند. ساختار هدف باید همان جهت را رسمی کند:

```text
frontend/src/
  app/
    App.tsx
    router.tsx
    providers.tsx
    shell/                    # Header، Footer، global overlays
  features/
    catalog/
      api/
      components/
      hooks/
      pages/
      types.ts
    marketplace/
      api/
      components/
      hooks/
      pages/
      types.ts
    messaging/
      api/
      components/
      hooks/
      types.ts
    account/
    checkout/
    farming/
    management/
    content/
  shared/
    ui/                       # Button، Modal، Pagination، Skeleton
    hooks/                    # useHorizontalRail، debounce و غیره
    utils/                    # formatter و projectionهای واقعاً عمومی
    types/                    # PaginatedResponse و typeهای primitive
  infrastructure/
    api/                      # client و error policy
    analytics/
    config/
```

### قانون وابستگی

1. `app` می‌تواند featureها و shared را مصرف کند؛ featureها نباید از `app` import کنند.
2. featureها فقط API، type و componentهای feature خودشان را مستقیم می‌شناسند.
3. `shared` نباید به feature یا صفحهٔ محصول/غرفه وابسته باشد.
4. `infrastructure/api/client` تنها جایی است که axios، CSRF و policy خطای global را می‌شناسد.
5. `types` باید نزدیک domain بماند؛ barrel سراسری فقط برای سازگاری است و نباید محل منطق شود.

### مسیر مهاجرت بدون شکستن سایت

- **گام A:** routeها را از `App.tsx` به `app/router.tsx` منتقل کن؛ shell و overlayهای global جدا بمانند.
- **گام B:** هر صفحهٔ بالای ۳۰KB را بر اساس use-case به feature components تقسیم کن؛ اول `ContentStudio`، سپس `StorefrontPage` و `Profile`.
- **گام C:** importهای API را از compatibility barrel به `api/services/<domain>` منتقل کن.
- **گام D:** پس از عبور تست‌ها و صفر شدن import قدیمی، barrelهای compatibility را حذف کن.

از `git mv` گسترده در یک commit پرهیز شود؛ هر گام باید با type-check، unit test و build قابل rollback باشد.

---

## ۵. ساختار پیشنهادی بک‌اند

بک‌اند در مدل‌ها از تفکیک خوبی شروع کرده است (`agri_inputs`، `machinery`، `logistics` و `export` مستقل‌اند). گلوگاه فعلی، اپ `shop` و مخصوصاً دو فایل بزرگ view/serializer است. پیشنهاد مرحله‌ای:

```text
garinkood/shop/
  accounts/
    api.py
    serializers.py
    services.py
  catalog/
    api.py
    serializers.py
    filters.py
    selectors.py
  orders/
    api.py
    serializers.py
    services.py             # checkout، inventory و payment orchestration
  marketplace/
    api.py
    serializers.py
    selectors.py
  messaging/
    api.py
    serializers.py
    services.py
  farming/
    api.py
    serializers.py
  content/
    api.py
    serializers.py
  management/
    api.py
    serializers.py
  infrastructure/
    permissions.py
    pagination.py
    media.py
```

در Django لازم نیست در گام اول app label، migration یا جدول‌ها تغییر کنند. می‌توان از packageهای داخلی شروع کرد و `api_views.py` و `serializers.py` را مدتی به‌عنوان compatibility re-export نگه داشت. ترتیب امن:

1. کد بدون side effect را به `selectors.py` منتقل کن.
2. orchestrationهای تراکنشی مثل checkout و reserve/release موجودی را به `services.py` ببر.
3. view فقط permission، ورودی، فراخوانی service و response را نگه دارد.
4. serializer فقط validation/representation را نگه دارد؛ query و side effect داخل آن نباشد.
5. URLهای هر دامنه را در `api/<domain>_urls.py` نگه دار، اما mount فعلی را تا پایان migration تغییر نده.

### چیزهایی که فعلاً نباید انجام شود

- انتقال به microservice قبل از جدا شدن transaction boundaryها
- جدا کردن marketplace از سفارش بدون تصمیم دربارهٔ موجودی، commission و settlement
- ساخت repository abstraction برای هر model بدون نیاز اندازه‌گیری‌شده
- ادغام همهٔ serializerها در یک base serializer بزرگ

برای این پروژه modular monolith با PostgreSQL، Redis، worker مستقل و object storage اختیاری، در این مرحله از microservice قابل اتکاتر و کم‌هزینه‌تر است.

---

## ۶. برنامهٔ scale عملیاتی

### فاز ۱ — همین حالا

- importهای دامنه‌ای API و shared primitiveها را تثبیت کن.
- برای endpointهای list، query count و latency budget تست داشته باش.
- برای تصاویر، CDN/object storage و پردازش async را از web request جدا نگه دار.
- در production حتماً PostgreSQL و Redis مشترک برای cache/throttle استفاده شود؛ LocMemCache برای چند worker کافی نیست.

### فاز ۲ — رشد کاتالوگ و marketplace

- cache کوتاه‌مدت برای catalog/reference data با invalidation روشن
- `select_related`/`prefetch_related` و تست جلوگیری از N+1 برای هر list endpoint
- pagination با سقف سخت، ordering whitelist و filter indexهای اندازه‌گیری‌شده
- queue واقعی برای encode تصویر، notification و کارهای سنگین؛ web process فقط enqueue کند
- rate limit و idempotency برای checkout، payment و webhook

### فاز ۳ — رشد تیم

- CODEOWNERS برای `features/*` و bounded contextهای بک‌اند
- قرارداد API و schema validation در CI
- lint معماری برای جلوگیری از import feature A در feature B بدون facade
- budget برای اندازهٔ فایل: فایل بزرگ موجود باید backlog باشد، نه اینکه هر feature جدید به آن اضافه شود
- dashboard برای P50/P95، 5xx، query count، queue depth، DB connections و cache hit rate

---

## ۷. کنترل‌های این تغییر

اجراشده در این محیط:

```text
npm ci --no-audit --no-fund                 PASS
npm run type-check                          PASS
npm run lint                                PASS
npm run build                                PASS (۲۶۱۲ ماژول)
npm run test:unit                            PASS (۳۱ فایل، ۲۲۴ تست)
manage.py check                              PASS
makemigrations --check --dry-run             PASS (No changes detected)
manage.py test shop                          PASS (۵۹۹ تست)
```

در اجرای Django هشدارهای محیطیِ شناخته‌شده دیده شد: `OPERATIONS_TOKEN` در محیط تست خالی است و `staticfiles/` قبل از `collectstatic` وجود ندارد. در اجرای اولیهٔ suite با SQLite یک log از `database table is locked: shop_cartitem` در مسیر concurrent cart دیده شد؛ علت این بود که `CartSerializer` بعد از خروج از lock، CartItemها را دوباره می‌خواند. serialization اکنون داخل همان lock انجام می‌شود و تست concurrent مربوطه و full suite بعد از اصلاح بدون آن Internal Server Error سبز شدند. با این حال concurrency واقعی باید روی PostgreSQL staging نیز سنجیده شود. تولید schema exit code صفر داشت اما ۱۳ warning و ۲۰ error مستندسازی‌شده در serializer annotation، viewهای function-based و collision نام‌ها گزارش کرد؛ این مورد backlog جداگانهٔ قرارداد OpenAPI است، نه نتیجهٔ این refactor. تست‌های مرورگر و Lighthouse به browser/runtime مستقل نیاز دارند و صرفاً از روی compile نباید سبز فرض شوند.

### تغییراتی که عمداً در این مرحله انجام نشد

- `shop/api_views.py` و `shop/serializers.py` جابه‌جا نشدند؛ چون با ۳۰هزار خط runtime، importهای داخلی و قراردادهای زیاد، شکستن آن‌ها بدون نصب dependencyهای Django و اجرای کل suite ریسک regression بالایی دارد. ساختار هدف و ترتیب migration در این سند ثبت شد.
- `App.tsx` هنوز route registry و shell را با هم دارد؛ ابتدا API boundary و duplication کم‌ریسک اصلاح شد. جداسازی router باید commit/مرحلهٔ مستقل با پوشش route انجام شود.
- ظاهر کارت‌ها به یک mega-component تبدیل نشد؛ تفاوت domain آن‌ها واقعی است و abstraction اشتباه برای scale تیمی بدتر از کمی تشابه UI است.

این گزارش معیار ادامهٔ کار است: هر refactor بعدی باید یک تکرار یا coupling مشخص را با تست و اندازه‌گیری حذف کند، نه فقط فایل‌ها را جابه‌جا کند.
