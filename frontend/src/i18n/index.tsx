import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "fa" | "en" | "ar";

type Dictionary = Record<string, string>;

const dictionaries: Record<Locale, Dictionary> = {
  fa: {
    "nav.home": "خانه", "nav.products": "محصولات", "nav.services": "خدمات کشاورزی", "nav.marketplace": "بازار کشاورزان", "nav.offers": "تخفیف‌ها",
    "language.label": "زبان", "language.fa": "فارسی", "language.en": "English", "language.ar": "العربية",
    "account.title": "حساب کاربری", "account.overview": "نمای کلی", "account.buyer": "خریدهای من", "account.seller": "غرفه و فروش", "account.settings": "اطلاعات و نشانی", "account.signout": "خروج از حساب",
    "account.orders": "سفارش‌ها", "account.noOrders": "هنوز سفارشی ثبت نشده است.", "account.openOrders": "پیگیری سفارش‌ها", "account.store": "غرفه من", "account.createStore": "ساخت غرفه", "account.createListing": "ثبت آگهی محصول", "account.noStore": "هنوز غرفه‌ای ندارید.",
    "account.buyerDescription": "سفارش‌ها، اطلاعات تحویل و پیگیری خریدهای مزرعه را یکجا مدیریت کنید.", "account.sellerDescription": "غرفه، آگهی‌ها و وضعیت بررسی محصولات خود را مدیریت کنید.",
    "account.profileSaved": "اطلاعات حساب ذخیره شد.", "account.storeCreated": "غرفه شما ساخته شد و برای فعالیت آماده است.", "account.listingCreated": "آگهی شما برای بررسی ارسال شد.",
    "common.save": "ذخیره", "common.cancel": "انصراف", "common.back": "بازگشت", "common.loading": "در حال بارگذاری...", "common.viewAll": "مشاهده همه", "common.edit": "ویرایش", "common.status": "وضعیت",
    "role.buyer": "خریدار", "role.seller": "فروشنده", "role.farmer": "کشاورز", "role.cooperative": "تعاونی", "role.merchant": "تاجر", "role.company": "شرکت",
    "profile.personal": "اطلاعات شخصی", "profile.contact": "اطلاعات تماس و تحویل", "profile.firstName": "نام", "profile.lastName": "نام خانوادگی", "profile.email": "ایمیل", "profile.phone": "شماره تماس", "profile.address": "نشانی پیش‌فرض", "profile.username": "نام کاربری",
    "seller.verificationPending": "غرفه هنوز تأیید نشده است", "seller.verificationApproved": "غرفه تأیید شده", "seller.listings": "آگهی‌های من", "seller.noListings": "هنوز آگهی ثبت نکرده‌اید.",
    "access.loginRequired": "برای دسترسی به حساب کاربری، ابتدا وارد شوید.",
  },
  en: {
    "nav.home": "Home", "nav.products": "Products", "nav.services": "Farm services", "nav.marketplace": "Farmers market", "nav.offers": "Offers",
    "language.label": "Language", "language.fa": "فارسی", "language.en": "English", "language.ar": "العربية",
    "account.title": "Account centre", "account.overview": "Overview", "account.buyer": "My buying", "account.seller": "Store & selling", "account.settings": "Profile & address", "account.signout": "Sign out",
    "account.orders": "Orders", "account.noOrders": "No orders have been placed yet.", "account.openOrders": "Track orders", "account.store": "My storefront", "account.createStore": "Create storefront", "account.createListing": "Add produce listing", "account.noStore": "You do not have a storefront yet.",
    "account.buyerDescription": "Manage orders, delivery details and farm purchases in one place.", "account.sellerDescription": "Manage your storefront, produce listings and review status.",
    "account.profileSaved": "Account details were saved.", "account.storeCreated": "Your storefront has been created.", "account.listingCreated": "Your listing was sent for review.",
    "common.save": "Save", "common.cancel": "Cancel", "common.back": "Back", "common.loading": "Loading...", "common.viewAll": "View all", "common.edit": "Edit", "common.status": "Status",
    "role.buyer": "Buyer", "role.seller": "Seller", "role.farmer": "Farmer", "role.cooperative": "Cooperative", "role.merchant": "Merchant", "role.company": "Company",
    "profile.personal": "Personal details", "profile.contact": "Contact & delivery", "profile.firstName": "First name", "profile.lastName": "Last name", "profile.email": "Email", "profile.phone": "Phone", "profile.address": "Default address", "profile.username": "Username",
    "seller.verificationPending": "Storefront verification is pending", "seller.verificationApproved": "Verified storefront", "seller.listings": "My listings", "seller.noListings": "You have not added a listing yet.",
    "access.loginRequired": "Sign in first to access your account.",
  },
  ar: {
    "nav.home": "الرئيسية", "nav.products": "المنتجات", "nav.services": "الخدمات الزراعية", "nav.marketplace": "سوق المزارعين", "nav.offers": "العروض",
    "language.label": "اللغة", "language.fa": "فارسی", "language.en": "English", "language.ar": "العربية",
    "account.title": "مركز الحساب", "account.overview": "نظرة عامة", "account.buyer": "مشترياتي", "account.seller": "المتجر والبيع", "account.settings": "الملف والعنوان", "account.signout": "تسجيل الخروج",
    "account.orders": "الطلبات", "account.noOrders": "لا توجد طلبات حتى الآن.", "account.openOrders": "تتبع الطلبات", "account.store": "متجري", "account.createStore": "إنشاء متجر", "account.createListing": "إضافة إعلان منتج", "account.noStore": "ليس لديك متجر بعد.",
    "account.buyerDescription": "أدر طلباتك وبيانات التسليم ومشتريات المزرعة في مكان واحد.", "account.sellerDescription": "أدر متجرك وإعلانات المنتجات وحالة المراجعة.",
    "account.profileSaved": "تم حفظ بيانات الحساب.", "account.storeCreated": "تم إنشاء متجرك.", "account.listingCreated": "تم إرسال إعلانك للمراجعة.",
    "common.save": "حفظ", "common.cancel": "إلغاء", "common.back": "رجوع", "common.loading": "جارٍ التحميل...", "common.viewAll": "عرض الكل", "common.edit": "تعديل", "common.status": "الحالة",
    "role.buyer": "مشتري", "role.seller": "بائع", "role.farmer": "مزارع", "role.cooperative": "تعاونية", "role.merchant": "تاجر", "role.company": "شركة",
    "profile.personal": "البيانات الشخصية", "profile.contact": "التواصل والتسليم", "profile.firstName": "الاسم", "profile.lastName": "اسم العائلة", "profile.email": "البريد الإلكتروني", "profile.phone": "رقم الهاتف", "profile.address": "العنوان الافتراضي", "profile.username": "اسم المستخدم",
    "seller.verificationPending": "توثيق المتجر قيد المراجعة", "seller.verificationApproved": "متجر موثق", "seller.listings": "إعلاناتي", "seller.noListings": "لم تضف إعلاناً بعد.",
    "access.loginRequired": "سجّل الدخول أولاً للوصول إلى حسابك.",
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
  const saved = localStorage.getItem("garinkood_locale");
  return saved === "en" || saved === "ar" || saved === "fa" ? saved : "fa";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const dir = locale === "en" ? "ltr" : "rtl";

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
