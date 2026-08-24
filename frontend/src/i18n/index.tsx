import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "fa" | "en" | "ar";

type Dictionary = Record<string, string>;

const dictionaries: Record<Locale, Dictionary> = {
  fa: {
    "nav.home": "خانه", "nav.products": "محصولات", "nav.services": "خدمات کشاورزی", "nav.marketplace": "بازار کشاورزان", "nav.offers": "تخفیف‌ها", "nav.storefronts": "غرفه‌داران",
    "nav.cart": "سبد خرید", "nav.wishlist": "علاقه‌مندی‌ها", "nav.more": "بیشتر", "nav.messages": "پیام‌ها", "nav.direct": "دایرکت", "nav.profile": "حساب من", "nav.orders": "سفارش‌ها", "nav.login": "ورود", "nav.logout": "خروج",
    "header.searchPlaceholder": "جستجوی کود، سم، بذر و بازار کشاورزان...",
    "header.menu": "منو", "header.openMenu": "باز کردن منوی کامل", "header.closeMenu": "بستن منو",
    "header.themeToLight": "تغییر به حالت روز", "header.themeToDark": "تغییر به حالت شب",
    "language.label": "زبان", "language.fa": "فارسی", "language.en": "English", "language.ar": "العربية",
    "language.description": "زبان نمایش سایت را انتخاب کنید؛ همه صفحات بلافاصله به زبان انتخابی نمایش داده می‌شوند.",
    "settings.site": "تنظیمات سایت", "settings.siteDescription": "زبان و حالت نمایش (روز/شب) سایت را از اینجا مدیریت کنید.",
    "settings.theme": "حالت نمایش", "settings.light": "روز", "settings.dark": "شب",
    "account.title": "حساب کاربری", "account.overview": "نمای کلی", "account.buyer": "خریدهای من", "account.seller": "غرفه و فروش", "account.settings": "اطلاعات و نشانی", "account.signout": "خروج از حساب",
    "account.orders": "سفارش‌ها", "account.noOrders": "هنوز سفارشی ثبت نشده است.", "account.openOrders": "پیگیری سفارش‌ها", "account.store": "غرفه من", "account.createStore": "ساخت غرفه", "account.createListing": "ثبت آگهی محصول", "account.noStore": "هنوز غرفه‌ای ندارید.",
    "account.buyerDescription": "سفارش‌ها، اطلاعات تحویل و پیگیری خریدهای مزرعه را یکجا مدیریت کنید.", "account.sellerDescription": "غرفه، آگهی‌ها و وضعیت بررسی محصولات خود را مدیریت کنید.",
    "account.profileSaved": "اطلاعات حساب ذخیره شد.", "account.storeCreated": "غرفه شما ساخته شد و برای فعالیت آماده است.", "account.listingCreated": "آگهی شما برای بررسی ارسال شد.",
    "common.save": "ذخیره", "common.cancel": "انصراف", "common.back": "بازگشت", "common.loading": "در حال بارگذاری...", "common.viewAll": "مشاهده همه", "common.edit": "ویرایش", "common.status": "وضعیت", "common.send": "ارسال", "common.close": "بستن", "common.all": "همه",
    "role.buyer": "خریدار", "role.seller": "فروشنده", "role.farmer": "کشاورز", "role.cooperative": "تعاونی", "role.merchant": "تاجر", "role.company": "شرکت",
    "profile.personal": "اطلاعات شخصی", "profile.contact": "اطلاعات تماس و تحویل", "profile.firstName": "نام", "profile.lastName": "نام خانوادگی", "profile.email": "ایمیل", "profile.phone": "شماره تماس", "profile.address": "نشانی پیش‌فرض", "profile.username": "نام کاربری",
    "seller.verificationPending": "غرفه هنوز تأیید نشده است", "seller.verificationApproved": "غرفه تأیید شده", "seller.listings": "آگهی‌های من", "seller.noListings": "هنوز آگهی ثبت نکرده‌اید.",
    "access.loginRequired": "برای دسترسی به حساب کاربری، ابتدا وارد شوید.",
    "home.heroTitle": "کود، سم، بذر و ادوات — و بازار مستقیم محصول کشاورزان",
    "home.heroSubtitle": "از فروشگاه تخصصی خرید کنید یا مستقیم از غرفه کشاورزان و تعاونی‌ها سفارش بگیرید. هر آگهی پیش از انتشار بررسی می‌شود.",
    "home.buyFromShop": "خرید از فروشگاه", "home.farmersMarket": "بازار کشاورزان",
    "shop.title": "فروشگاه گرین کود", "shop.subtitle": "فقط محصولات تخصصی خود سایت؛ با دسته‌بندی و صفحه‌بندی کامل.",
    "shop.all": "همه محصولات", "shop.bestSellers": "پرفروش‌ترین‌ها", "shop.mostDiscounted": "پرتخفیف‌ترین‌ها", "shop.newest": "جدیدترین‌ها",
    "shop.categories": "دسته‌بندی‌ها", "shop.noProducts": "محصولی در این بخش یافت نشد.",
    "shop.previous": "قبلی", "shop.next": "بعدی", "shop.page": "صفحه",
    "shop.discount": "٪ تخفیف", "shop.buy": "افزودن به سبد",
    "storefronts.title": "غرفه‌داران", "storefronts.subtitle": "فهرست کامل فروشندگان، پرفروش‌ترین و پرتخفیف‌ترین محصولات غرفه‌ها",
    "storefronts.tab.stores": "غرفه‌ها", "storefronts.tab.bestSellers": "پرفروش‌ترین محصولات", "storefronts.tab.discounted": "پرتخفیف‌ترین محصولات",
    "storefronts.searchPlaceholder": "جستجوی نام، محصول یا شهر غرفه...",
    "storefronts.followers": "دنبال‌کننده", "storefronts.listings": "آگهی",
    "storefront.tab.listings": "آگهی‌ها", "storefront.tab.posts": "پست‌ها", "storefront.tab.stories": "استوری‌ها",
    "storefront.follow": "دنبال کردن", "storefront.unfollow": "دنبال نشدن", "storefront.message": "گفتگو با غرفه‌دار",
    "storefront.myStore": "غرفه من", "storefront.editStore": "ویرایش غرفه", "storefront.editHint": "نام، بیوگرافی و تصاویر غرفه را همین‌جا ویرایش کنید.",
    "storefront.storeName": "نام غرفه", "storefront.storeBio": "بیوگرافی غرفه", "storefront.storeAvatar": "تصویر غرفه", "storefront.storeCover": "تصویر کاور",
    "storefront.updated": "غرفه به‌روزرسانی شد.",
    "storefront.newPost": "پست جدید", "storefront.newStory": "استوری جدید", "storefront.composerHint": "تصویر و متن پست یا استوری غرفه را همین‌جا منتشر کنید.",
    "storefront.postPublished": "برای بررسی ارسال شد و پس از تأیید نمایش داده می‌شود.",
    "storefront.sendToDirect": "ارسال به دایرکت", "storefront.sendToDirectHint": "این محصول را برای مشاوره به دایرکت غرفه‌دار ارسال کنید.",
    "direct.title": "پیام‌ها", "direct.empty": "گفتگویی وجود ندارد.", "direct.noThread": "یک گفتگو را انتخاب کنید.",
    "direct.startHint": "با غرفه‌دار گفتگو را شروع کنید؛ محصولات را هم می‌توانید برای مشاوره به گفتگو پیوست کنید.",
    "direct.placeholder": "پیام خود را بنویسید...", "direct.attachedProduct": "محصول پیوست‌شده", "direct.you": "شما",
    "direct.opened": "گفتگو باز شد.", "direct.sent": "پیام ارسال شد.",
    "checkout.title": "اطلاعات تحویل سفارش",
    "footer.shipping": "ایران — ارسال به سراسر کشور",
    "footer.rights": "© گرین کود — تأمین، فروش و خدمات کشاورزی",
  },
  en: {
    "nav.home": "Home", "nav.products": "Products", "nav.services": "Farm services", "nav.marketplace": "Farmers market", "nav.offers": "Offers", "nav.storefronts": "Sellers",
    "nav.cart": "Cart", "nav.wishlist": "Wishlist", "nav.more": "More", "nav.messages": "Messages", "nav.direct": "Direct", "nav.profile": "My account", "nav.orders": "Orders", "nav.login": "Sign in", "nav.logout": "Sign out",
    "header.searchPlaceholder": "Search fertilizers, pesticides, seeds and farm products...",
    "header.menu": "Menu", "header.openMenu": "Open full menu", "header.closeMenu": "Close menu",
    "header.themeToLight": "Switch to light mode", "header.themeToDark": "Switch to dark mode",
    "language.label": "Language", "language.fa": "فارسی", "language.en": "English", "language.ar": "العربية",
    "language.description": "Choose the display language; every page switches instantly.",
    "settings.site": "Site settings", "settings.siteDescription": "Manage the site language and light/dark appearance here.",
    "settings.theme": "Appearance", "settings.light": "Light", "settings.dark": "Dark",
    "account.title": "Account centre", "account.overview": "Overview", "account.buyer": "My buying", "account.seller": "Store & selling", "account.settings": "Profile & address", "account.signout": "Sign out",
    "account.orders": "Orders", "account.noOrders": "No orders have been placed yet.", "account.openOrders": "Track orders", "account.store": "My storefront", "account.createStore": "Create storefront", "account.createListing": "Add produce listing", "account.noStore": "You do not have a storefront yet.",
    "account.buyerDescription": "Manage orders, delivery details and farm purchases in one place.", "account.sellerDescription": "Manage your storefront, produce listings and review status.",
    "account.profileSaved": "Account details were saved.", "account.storeCreated": "Your storefront has been created.", "account.listingCreated": "Your listing was sent for review.",
    "common.save": "Save", "common.cancel": "Cancel", "common.back": "Back", "common.loading": "Loading...", "common.viewAll": "View all", "common.edit": "Edit", "common.status": "Status", "common.send": "Send", "common.close": "Close", "common.all": "All",
    "role.buyer": "Buyer", "role.seller": "Seller", "role.farmer": "Farmer", "role.cooperative": "Cooperative", "role.merchant": "Merchant", "role.company": "Company",
    "profile.personal": "Personal details", "profile.contact": "Contact & delivery", "profile.firstName": "First name", "profile.lastName": "Last name", "profile.email": "Email", "profile.phone": "Phone", "profile.address": "Default address", "profile.username": "Username",
    "seller.verificationPending": "Storefront verification is pending", "seller.verificationApproved": "Verified storefront", "seller.listings": "My listings", "seller.noListings": "You have not added a listing yet.",
    "access.loginRequired": "Sign in first to access your account.",
    "home.heroTitle": "Fertilizers, pesticides, seeds and tools — plus a direct farm produce market",
    "home.heroSubtitle": "Buy from the specialist shop or order straight from farmers and cooperatives. Every listing is reviewed before publishing.",
    "home.buyFromShop": "Buy from shop", "home.farmersMarket": "Farmers market",
    "shop.title": "GarinKood shop", "shop.subtitle": "Only the site's own specialist products — with categories and full pagination.",
    "shop.all": "All products", "shop.bestSellers": "Best sellers", "shop.mostDiscounted": "Most discounted", "shop.newest": "Newest",
    "shop.categories": "Categories", "shop.noProducts": "No products found in this section.",
    "shop.previous": "Previous", "shop.next": "Next", "shop.page": "Page",
    "shop.discount": "% off", "shop.buy": "Add to cart",
    "storefronts.title": "Sellers", "storefronts.subtitle": "The full directory of sellers, their best-selling and most discounted products",
    "storefronts.tab.stores": "Storefronts", "storefronts.tab.bestSellers": "Best-selling products", "storefronts.tab.discounted": "Most discounted",
    "storefronts.searchPlaceholder": "Search storefront name, product or city...",
    "storefronts.followers": "followers", "storefronts.listings": "listings",
    "storefront.tab.listings": "Listings", "storefront.tab.posts": "Posts", "storefront.tab.stories": "Stories",
    "storefront.follow": "Follow", "storefront.unfollow": "Following", "storefront.message": "Message the seller",
    "storefront.myStore": "My storefront", "storefront.editStore": "Edit storefront", "storefront.editHint": "Edit the name, bio and images of your storefront right here.",
    "storefront.storeName": "Storefront name", "storefront.storeBio": "Storefront bio", "storefront.storeAvatar": "Storefront picture", "storefront.storeCover": "Cover picture",
    "storefront.updated": "Storefront updated.",
    "storefront.newPost": "New post", "storefront.newStory": "New story", "storefront.composerHint": "Publish a post or story image with a caption right here.",
    "storefront.postPublished": "Submitted for review; it will appear once approved.",
    "storefront.sendToDirect": "Send to direct", "storefront.sendToDirectHint": "Send this product to the seller's direct messages for advice.",
    "direct.title": "Messages", "direct.empty": "No conversations yet.", "direct.noThread": "Select a conversation.",
    "direct.startHint": "Start a conversation with the seller; you can also attach products to ask for advice.",
    "direct.placeholder": "Write your message...", "direct.attachedProduct": "Attached product", "direct.you": "You",
    "direct.opened": "Conversation opened.", "direct.sent": "Message sent.",
    "checkout.title": "Delivery details",
    "footer.shipping": "Iran — nationwide delivery",
    "footer.rights": "© GarinKood — agricultural supply, sales and services",
  },
  ar: {
    "nav.home": "الرئيسية", "nav.products": "المنتجات", "nav.services": "الخدمات الزراعية", "nav.marketplace": "سوق المزارعين", "nav.offers": "العروض", "nav.storefronts": "الباعة",
    "nav.cart": "السلة", "nav.wishlist": "المفضلة", "nav.more": "المزيد", "nav.messages": "الرسائل", "nav.direct": "الرسائل المباشرة", "nav.profile": "حسابي", "nav.orders": "الطلبات", "nav.login": "تسجيل الدخول", "nav.logout": "خروج",
    "header.searchPlaceholder": "ابحث عن الأسمدة والمبيدات والبذور ومنتجات المزارع...",
    "header.menu": "القائمة", "header.openMenu": "فتح القائمة الكاملة", "header.closeMenu": "إغلاق القائمة",
    "header.themeToLight": "التبديل إلى الوضع النهاري", "header.themeToDark": "التبديل إلى الوضع الليلي",
    "language.label": "اللغة", "language.fa": "فارسی", "language.en": "English", "language.ar": "العربية",
    "language.description": "اختر لغة العرض؛ تتحول جميع الصفحات فوراً إلى اللغة المختارة.",
    "settings.site": "إعدادات الموقع", "settings.siteDescription": "إدارة لغة الموقع والمظهر الليلي/النهاري من هنا.",
    "settings.theme": "المظهر", "settings.light": "نهاري", "settings.dark": "ليلي",
    "account.title": "مركز الحساب", "account.overview": "نظرة عامة", "account.buyer": "مشترياتي", "account.seller": "المتجر والبيع", "account.settings": "الملف والعنوان", "account.signout": "تسجيل الخروج",
    "account.orders": "الطلبات", "account.noOrders": "لا توجد طلبات حتى الآن.", "account.openOrders": "تتبع الطلبات", "account.store": "متجري", "account.createStore": "إنشاء متجر", "account.createListing": "إضافة إعلان منتج", "account.noStore": "ليس لديك متجر بعد.",
    "account.buyerDescription": "أدر طلباتك وبيانات التسليم ومشتريات المزرعة في مكان واحد.", "account.sellerDescription": "أدر متجرك وإعلانات المنتجات وحالة المراجعة.",
    "account.profileSaved": "تم حفظ بيانات الحساب.", "account.storeCreated": "تم إنشاء متجرك.", "account.listingCreated": "تم إرسال إعلانك للمراجعة.",
    "common.save": "حفظ", "common.cancel": "إلغاء", "common.back": "رجوع", "common.loading": "جارٍ التحميل...", "common.viewAll": "عرض الكل", "common.edit": "تعديل", "common.status": "الحالة", "common.send": "إرسال", "common.close": "إغلاق", "common.all": "الكل",
    "role.buyer": "مشتري", "role.seller": "بائع", "role.farmer": "مزارع", "role.cooperative": "تعاونية", "role.merchant": "تاجر", "role.company": "شركة",
    "profile.personal": "البيانات الشخصية", "profile.contact": "التواصل والتسليم", "profile.firstName": "الاسم", "profile.lastName": "اسم العائلة", "profile.email": "البريد الإلكتروني", "profile.phone": "رقم الهاتف", "profile.address": "العنوان الافتراضي", "profile.username": "اسم المستخدم",
    "seller.verificationPending": "توثيق المتجر قيد المراجعة", "seller.verificationApproved": "متجر موثق", "seller.listings": "إعلاناتي", "seller.noListings": "لم تضف إعلاناً بعد.",
    "access.loginRequired": "سجّل الدخول أولاً للوصول إلى حسابك.",
    "home.heroTitle": "الأسمدة والمبيدات والبذور والأدوات — وسوق مباشر لمنتجات المزارعين",
    "home.heroSubtitle": "اشترِ من المتجر المتخصص أو اطلب مباشرة من المزارعين والتعاونيات. تتم مراجعة كل إعلان قبل نشره.",
    "home.buyFromShop": "اشترِ من المتجر", "home.farmersMarket": "سوق المزارعين",
    "shop.title": "متجر غرين كود", "shop.subtitle": "منتجات الموقع المتخصصة فقط — مع التصنيفات والترقيم الكامل للصفحات.",
    "shop.all": "كل المنتجات", "shop.bestSellers": "الأكثر مبيعاً", "shop.mostDiscounted": "الأكثر خصماً", "shop.newest": "الأحدث",
    "shop.categories": "التصنيفات", "shop.noProducts": "لا توجد منتجات في هذا القسم.",
    "shop.previous": "السابق", "shop.next": "التالي", "shop.page": "صفحة",
    "shop.discount": "٪ خصم", "shop.buy": "أضف إلى السلة",
    "storefronts.title": "الباعة", "storefronts.subtitle": "قائمة الباعة الكاملة، وأكثر منتجاتهم مبيعاً وخصماً",
    "storefronts.tab.stores": "المتاجر", "storefronts.tab.bestSellers": "الأكثر مبيعاً", "storefronts.tab.discounted": "الأكثر خصماً",
    "storefronts.searchPlaceholder": "ابحث عن اسم المتجر أو المنتج أو المدينة...",
    "storefronts.followers": "متابع", "storefronts.listings": "إعلان",
    "storefront.tab.listings": "الإعلانات", "storefront.tab.posts": "المنشورات", "storefront.tab.stories": "القصص",
    "storefront.follow": "متابعة", "storefront.unfollow": "متابَع", "storefront.message": "مراسلة البائع",
    "storefront.myStore": "متجري", "storefront.editStore": "تعديل المتجر", "storefront.editHint": "عدّل الاسم والسيرة الذاتية وصور متجرك من هنا.",
    "storefront.storeName": "اسم المتجر", "storefront.storeBio": "سيرة المتجر", "storefront.storeAvatar": "صورة المتجر", "storefront.storeCover": "صورة الغلاف",
    "storefront.updated": "تم تحديث المتجر.",
    "storefront.newPost": "منشور جديد", "storefront.newStory": "قصة جديدة", "storefront.composerHint": "انشر صورة منشور أو قصة مع وصف من هنا.",
    "storefront.postPublished": "أُرسل للمراجعة وسيظهر بعد الموافقة.",
    "storefront.sendToDirect": "أرسل إلى الرسائل", "storefront.sendToDirectHint": "أرسل هذا المنتج إلى رسائل البائع المباشرة للاستشارة.",
    "direct.title": "الرسائل", "direct.empty": "لا توجد محادثات بعد.", "direct.noThread": "اختر محادثة.",
    "direct.startHint": "ابدأ محادثة مع البائع؛ يمكنك أيضاً إرفاق المنتجات لطلب الاستشارة.",
    "direct.placeholder": "اكتب رسالتك...", "direct.attachedProduct": "المنتج المرفق", "direct.you": "أنت",
    "direct.opened": "تم فتح المحادثة.", "direct.sent": "تم إرسال الرسالة.",
    "checkout.title": "بيانات تسليم الطلب",
    "footer.shipping": "إيران — التوصيل إلى جميع أنحاء البلاد",
    "footer.rights": "© غرين كود — التوريد والبيع والخدمات الزراعية",
  },
};

interface I18nContextValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): Locale {
  // Persian is always the site default; a saved preference is honoured only
  // when the visitor explicitly chose a language.
  const saved = localStorage.getItem("garinkood_locale");
  return saved === "en" || saved === "ar" || saved === "fa" ? saved : "fa";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const dir = locale === "en" ? "ltr" : "rtl";

  const setLocale = (next: Locale) => {
    setLocaleState(next);
  };

  useEffect(() => {
    localStorage.setItem("garinkood_locale", locale);
    document.documentElement.lang = locale === "fa" ? "fa" : locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    dir,
    setLocale,
    t: (key) => dictionaries[locale][key] || dictionaries.fa[key] || key,
  }), [locale, dir]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useTranslation must be used within I18nProvider.");
  return context;
}

/**
 * The languages offered in the site settings.
 */
export const LANGUAGES: { value: Locale; labelKey: string; native: string; flag: string }[] = [
  { value: "fa", labelKey: "language.fa", native: "فارسی", flag: "🇮🇷" },
  { value: "en", labelKey: "language.en", native: "English", flag: "🇬🇧" },
  { value: "ar", labelKey: "language.ar", native: "العربية", flag: "🇸🇦" },
];
