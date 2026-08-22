// frontend/src/data/shopData.ts
// ✅ داده‌های استاتیک برای UI (دسته‌بندی‌ها، محصولات نمونه، و غیره)
// ✅ این فایل فقط داده دارد، نه interface (interfaces در types/index.ts هستند)

import type { LucideIcon } from "lucide-react";
import { Bug, Sprout, Wheat, Tractor, Droplets, Shovel } from "lucide-react";
import type { MockProduct } from "../types";

// ========================================
// Categories Data (برای MegaMenu و MobileMenu)
// ========================================

export interface CategoryItem {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  items: { label: string; id: string }[];
}

export const categories: CategoryItem[] = [
  {
    id: "pesticide",
    label: "سموم دفع آفات",
    icon: Bug,
    color: "from-[#0F8A5F] to-[#0c6b49]",
    items: [
      { label: "حشره‌کش‌ها", id: "insecticide" },
      { label: "قارچ‌کش‌ها", id: "fungicide" },
      { label: "علف‌کش‌ها", id: "herbicide" },
      { label: "کنه‌کش‌ها", id: "miticide" },
    ],
  },
  {
    id: "fertilizer",
    label: "کود کشاورزی",
    icon: Sprout,
    color: "from-emerald-500 to-[#0F8A5F]",
    items: [
      { label: "کود NPK", id: "npk" },
      { label: "کود اوره", id: "urea" },
      { label: "اسید هیومیک", id: "humic" },
      { label: "ریزمغذی‌ها", id: "micronutrient" },
    ],
  },
  {
    id: "seed",
    label: "بذر و نهال",
    icon: Wheat,
    color: "from-amber-500 to-orange-500",
    items: [
      { label: "بذر صیفی‌جات", id: "vegetable-seed" },
      { label: "بذر زراعی", id: "field-seed" },
      { label: "بذر گلخانه‌ای", id: "greenhouse-seed" },
      { label: "نهال میوه", id: "sapling" },
    ],
  },
  {
    id: "equipment",
    label: "ادوات کشاورزی",
    icon: Tractor,
    color: "from-lime-600 to-[#0F8A5F]",
    items: [
      { label: "سمپاش", id: "sprayer" },
      { label: "سیستم آبیاری", id: "irrigation-eq" },
      { label: "ابزار دستی", id: "hand-tool" },
      { label: "ماشین‌آلات", id: "machinery" },
    ],
  },
  {
    id: "irrigation",
    label: "آبیاری",
    icon: Droplets,
    color: "from-sky-500 to-cyan-600",
    items: [
      { label: "قطره‌ای", id: "drip" },
      { label: "بارانی", id: "sprinkler" },
      { label: "پمپ آب", id: "pump" },
      { label: "شیرآلات", id: "valve" },
    ],
  },
  {
    id: "tools",
    label: "ابزار باغبانی",
    icon: Shovel,
    color: "from-teal-500 to-emerald-600",
    items: [
      { label: "ابزار دستی", id: "garden-tool" },
      { label: "لباس کار", id: "workwear" },
      { label: "کوددهی دستی", id: "manual-feeder" },
      { label: "قیچی باغبانی", id: "shears" },
    ],
  },
];

// ========================================
// Crops Data (برای CropSelector)
// ========================================

export interface Crop {
  id: string;
  label: string;
  emoji: string;
  matchCategoryIds: string[];
}

export const crops: Crop[] = [
  { id: "wheat", label: "گندم", emoji: "🌾", matchCategoryIds: ["fertilizer", "pesticide", "seed"] },
  { id: "pistachio", label: "پسته", emoji: "🌰", matchCategoryIds: ["pesticide", "irrigation", "fertilizer"] },
  { id: "rice", label: "برنج", emoji: "🍚", matchCategoryIds: ["fertilizer", "pesticide"] },
  { id: "tomato", label: "گوجه‌فرنگی", emoji: "🍅", matchCategoryIds: ["seed", "fertilizer", "pesticide"] },
  { id: "cucumber", label: "خیار گلخانه‌ای", emoji: "🥒", matchCategoryIds: ["seed", "irrigation", "equipment"] },
  { id: "citrus", label: "باغ مرکبات", emoji: "🍊", matchCategoryIds: ["fertilizer", "pesticide", "equipment"] },
];

// ========================================
// Mock Products Data (برای نمایش اولیه و تست)
// ========================================

export const products: MockProduct[] = [
  {
    id: 1,
    name: "سم علف‌کش گلایفوزیت ۴۱٪",
    category: "سموم دفع آفات",
    categoryId: "pesticide",
    subCategoryId: "herbicide",
    brand: "کیمیا سبز",
    price: 385000,
    oldPrice: 450000,
    rating: 4.6,
    reviews: 128,
    image: "/images/products/herbicide.jpg",
    badge: "پرفروش",
    inStock: true,
    description:
      "علف‌کش سیستمیک با طیف اثر گسترده، مناسب از بین بردن علف‌های هرز یک‌ساله و چندساله در زمین‌های زراعی و باغی.",
    features: ["حجم ۱ لیتری", "اثر سریع طی ۷ روز", "قابل استفاده در تمام فصول", "دارای مجوز سازمان حفظ نباتات"],
    cropTags: ["wheat", "citrus"],
    pestTags: ["علف هرز پهن‌برگ", "علف هرز باریک‌برگ"],
    usage: {
      dosage: "۳ تا ۵ لیتر در هکتار بسته به تراکم علف هرز",
      method: "محلول‌پاشی یکنواخت روی برگ علف‌های هرز در حال رشد",
      timing: "قبل از کاشت یا پس از برداشت، در هوای آفتابی و بدون باد",
      preHarvestInterval: "۱۴ روز",
    },
    warnings: ["دور از دسترس کودکان نگهداری شود", "هنگام مصرف از دستکش و ماسک استفاده شود", "از تماس با پوست و چشم خودداری کنید"],
    compatibleWith: ["کود اوره گرانوله", "کود مایع اسید هیومیک"],
    brochureAvailable: true,
  },
  {
    id: 2,
    name: "کود اوره گرانوله ۵۰ کیلویی",
    category: "کود کشاورزی",
    categoryId: "fertilizer",
    subCategoryId: "urea",
    brand: "پتاس ایران",
    price: 620000,
    rating: 4.8,
    reviews: 256,
    image: "/images/products/urea-fertilizer.jpg",
    badge: "تخفیف ویژه",
    inStock: true,
    description:
      "کود نیتروژنه با ۴۶٪ نیتروژن خالص، مناسب برای رشد سریع و افزایش عملکرد محصولات زراعی و باغی.",
    features: ["کیسه ۵۰ کیلوگرمی", "۴۶٪ نیتروژن خالص", "حلالیت بالا در آب", "مناسب تمام خاک‌ها"],
    cropTags: ["wheat", "rice", "tomato", "citrus"],
    pestTags: [],
    usage: {
      dosage: "۱۵۰ تا ۲۵۰ کیلوگرم در هکتار",
      method: "پخش سطحی یا کوددهی نواری همراه با آبیاری",
      timing: "قبل از کاشت و مرحله رشد رویشی",
    },
    warnings: ["در محل خشک و دور از رطوبت نگهداری شود", "از تماس مستقیم طولانی با پوست خودداری کنید"],
    compatibleWith: ["کود مایع اسید هیومیک", "ریزمغذی کامل"],
    brochureAvailable: true,
  },
  {
    id: 3,
    name: "بذر هیبرید گوجه‌فرنگی گلخانه‌ای",
    category: "بذر و نهال",
    categoryId: "seed",
    subCategoryId: "greenhouse-seed",
    brand: "بذر یار",
    price: 145000,
    rating: 4.7,
    reviews: 94,
    image: "/images/products/tomato-seeds.jpg",
    inStock: true,
    description: "بذر هیبرید مقاوم به بیماری با جوانه‌زنی بالای ۹۵٪، مخصوص کشت گلخانه‌ای و فضای باز.",
    features: ["بسته ۱۰۰۰ عددی", "جوانه‌زنی ۵٪+", "مقاوم به ویروس TMV", "مناسب کشت گلخانه‌ای"],
    cropTags: ["tomato", "cucumber"],
    pestTags: [],
    usage: {
      dosage: "۲۵۰ تا ۳۵۰ گرم بذر در هکتار",
      method: "کشت در نشاءخانه سپس نشاءکاری در گلخانه یا زمین اصلی",
      timing: "فصل بهار و پاییز برای کشت گلخانه‌ای",
    },
    warnings: ["بذر را در محل خنک و خشک نگهداری کنید"],
    compatibleWith: ["کود مایع اسید هیومیک", "کود NPK کامل"],
    brochureAvailable: false,
  },
  {
    id: 4,
    name: "سمپاش پشتی موتوری ۲۵ لیتری",
    category: "ادوات کشاورزی",
    categoryId: "equipment",
    subCategoryId: "sprayer",
    brand: "تکنو فارم",
    price: 4250000,
    oldPrice: 4800000,
    rating: 4.9,
    reviews: 67,
    image: "/images/products/sprayer.jpg",
    badge: "جدید",
    inStock: true,
    description: "سمپاش موتوری با موتور بنزینی قدرتمند، مناسب سمپاشی باغات و مزارع بزرگ با راندمان بالا.",
    features: ["مخزن ۵ لیتری", "موتور  زمانه", "فشار پاشش تا ۴۰ بار", "گارانتی ۸ ماهه"],
    cropTags: ["citrus", "cucumber", "pistachio"],
    pestTags: [],
    usage: {
      dosage: "-",
      method: "پرکردن مخزن با محلول سم رقیق‌شده طبق دستورالعمل هر سم",
      timing: "صبح زود یا عصر برای جلوگیری از تبخیر سریع محلول",
    },
    warnings: ["قبل از استفاده دفترچه راهنما را مطالعه کنید", "پس از سمپاشی مخزن را کاملاً بشویید"],
    compatibleWith: ["تمام سموم مایع رقیق‌شدنی"],
    brochureAvailable: true,
  },
  {
    id: 5,
    name: "کود مایع اسید هیومیک",
    category: "کود کشاورزی",
    categoryId: "fertilizer",
    subCategoryId: "humic",
    brand: "زیست کود سبز",
    price: 275000,
    rating: 4.5,
    reviews: 143,
    image: "/images/products/liquid-fertilizer.jpg",
    inStock: true,
    description: "محرک رشد ریشه و بهبود ساختار خاک، افزایش جذب عناصر غذایی توسط گیاه.",
    features: ["حجم ۱ لیتری", "افزایش رشد ریشه", "بهبود ساختار خاک", "سازگار با کود‌های دیگر"],
    cropTags: ["wheat", "tomato", "citrus", "cucumber"],
    pestTags: [],
    usage: {
      dosage: "۲ تا ۳ لیتر در هکتار محلول در آب آبیاری",
      method: "کود‌آبیاری (فرتیگیشن) یا محلول‌پاشی برگی",
      timing: "مراحل اولیه رشد و قبل از گلدهی",
    },
    warnings: ["پیش از مصرف با کود‌های حاوی کلسیم آزمایش سازگاری انجام دهید"],
    compatibleWith: ["کود اوره گرانوله", "ریزمغذی کامل"],
    brochureAvailable: false,
  },
  {
    id: 6,
    name: "قارچ‌کش سیستمیک تری‌فورین",
    category: "سموم دفع آفات",
    categoryId: "pesticide",
    subCategoryId: "fungicide",
    brand: "کیمیا سبز",
    price: 310000,
    rating: 4.4,
    reviews: 58,
    image: "/images/products/fungicide.jpg",
    inStock: true,
    description: "قارچ‌کش سیستمیک برای کنترل سفیدک پودری و سایر بیماری‌های قارچی گیاهان.",
    features: ["بسته ۵۰۰ گرمی", "اثر سیستمیک", "کنترل سفیدک پودری", "دوره کارنس کوتاه"],
    cropTags: ["cucumber", "citrus", "pistachio"],
    pestTags: ["سفیدک پودری", "لکه برگی"],
    usage: {
      dosage: "۱ تا ۱.۵ در هزار محلول در آب",
      method: "محلول‌پاشی کامل روی سطح برگ‌ها",
      timing: "در اولین نشانه‌های آلودگی و تکرار هر ۱۰ روز",
      preHarvestInterval: "۷ روز",
    },
    warnings: ["از استنشاق پودر خودداری کنید", "مناسب استفاده در گلخانه با تهویه مناسب"],
    compatibleWith: ["کود مایع اسید هیومیک"],
    brochureAvailable: true,
  },
  {
    id: 7,
    name: "نهال پیوندی سیب گلدن",
    category: "بذر و نهال",
    categoryId: "seed",
    subCategoryId: "sapling",
    brand: "نهالستان البرز",
    price: 195000,
    rating: 4.6,
    reviews: 39,
    image: "/images/products/apple-sapling.jpg",
    inStock: true,
    description: "نهال پیوندی با پایه مقاوم، آماده کشت در باغ با کیفیت تضمین‌شده.",
    features: ["ارتفاع ۱۲۰-۱۵۰ سانتی‌متر", "پایه مقاوم", "شروع باردهی از سال سوم", "گارانتی سلامت"],
    cropTags: ["citrus"],
    pestTags: [],
    usage: {
      dosage: "-",
      method: "کاشت در چاله آماده‌شده با کود پایه و آبیاری منظم",
      timing: "پاییز یا اوایل بهار قبل از باز شدن جوانه‌ها",
    },
    warnings: ["ریشه نهال را از خشک شدن محافظت کنید"],
    compatibleWith: ["کود اوره گرانوله", "کود مایع اسید هیومیک"],
    brochureAvailable: false,
  },
  {
    id: 8,
    name: "قیچی باغبانی حرفه‌ای فلزی",
    category: "ابزار باغبانی",
    categoryId: "tools",
    subCategoryId: "shears",
    brand: "تکنو فارم",
    price: 165000,
    oldPrice: 210000,
    rating: 4.3,
    reviews: 210,
    image: "/images/products/pruning-shears.jpg",
    inStock: true,
    description: "قیچی باغبانی با تیغه فولاد ضدزنگ و دسته ارگونومیک، مناسب هرس شاخه‌های تا  سانتی‌متر.",
    features: ["تیغه فولاد ضدزنگ", "دسته ضدلغزش", "مناسب هرس تا  سانتی‌متر", "قفل ایمنی"],
    cropTags: ["citrus"],
    pestTags: [],
    usage: {
      dosage: "-",
      method: "هرس شاخه‌های خشک و اضافی با فشار یکنواخت",
      timing: "فصل خواب درخت (پاییز و زمستان)",
    },
    warnings: ["پس از هر استفاده تیغه را ضدعفونی کنید"],
    compatibleWith: [],
    brochureAvailable: false,
  },
  {
    id: 9,
    name: "حشره‌کش ایمیداکلوپراید ۳۵٪",
    category: "سموم دفع آفات",
    categoryId: "pesticide",
    subCategoryId: "insecticide",
    brand: "پارس شیمی",
    price: 295000,
    rating: 4.5,
    reviews: 81,
    image: "/images/products/insecticide.jpg",
    badge: "پیشنهاد ویژه",
    inStock: true,
    description: "حشره‌کش سیستمیک با دوام بالا برای کنترل شته، سفیدبالک و تریپس در محصولات زراعی و باغی.",
    features: ["بسته ۲۵۰ میلی‌لیتری", "اثر سیستمیک", "دوام تا ۲۱ روز", "طیف اثر گسترده"],
    cropTags: ["cucumber", "citrus", "tomato"],
    pestTags: ["شته", "سفیدبالک", "تریپس"],
    usage: {
      dosage: "۰.۵ در هزار محلول در آب",
      method: "محلول‌پاشی کامل سطح برگ و ساقه",
      timing: "در اولین مشاهده آفت، عصر هنگام",
      preHarvestInterval: "۱۰ روز",
    },
    warnings: ["برای زنبور عسل خطرناک است، در زمان گلدهی استفاده نشود", "از تجهیزات محافظت فردی استفاده کنید"],
    compatibleWith: ["قارچ‌کش سیستمیک تری‌فورین"],
    brochureAvailable: true,
  },
  {
    id: 10,
    name: "کود کامل NPK ۲۰-۲۰-۲۰",
    category: "کود کشاورزی",
    categoryId: "fertilizer",
    subCategoryId: "npk",
    brand: "پتاس ایران",
    price: 540000,
    oldPrice: 610000,
    rating: 4.7,
    reviews: 176,
    image: "/images/products/urea-fertilizer.jpg",
    badge: "پرفروش",
    inStock: true,
    description: "کود کامل و متعادل NPK محلول در آب، مناسب تمام مراحل رشد گیاه در زراعت و باغبانی.",
    features: ["بسته ۱ کیلوگرمی", "حلالیت ۱۰۰٪", "دارای ریزمغذی همراه", "مناسب کودآبیاری"],
    cropTags: ["wheat", "tomato", "cucumber", "citrus", "rice"],
    pestTags: [],
    usage: {
      dosage: "۲ تا ۳ کیلوگرم در هزار لیتر آب آبیاری",
      method: "کودآبیاری از طریق سیستم قطره‌ای یا محلول‌پاشی برگی",
      timing: "هر ۱ تا ۱۵ روز در طول فصل رشد",
    },
    warnings: ["از مخلوط کردن با کودهای حاوی کلسیم بدون آزمایش خودداری کنید"],
    compatibleWith: ["کود مایع اسید هیومیک"],
    brochureAvailable: true,
  },
  {
    id: 11,
    name: "کیت آبیاری قطره‌ای ۱۰۰۰ متری",
    category: "آبیاری",
    categoryId: "irrigation",
    subCategoryId: "drip",
    brand: "آبیاری نوین",
    price: 1850000,
    rating: 4.6,
    reviews: 44,
    image: "/images/products/sprayer.jpg",
    inStock: true,
    description: "کیت کامل آبیاری قطره‌ای شامل نوار تیپ، اتصالات و شیر کنترل، مناسب زمین‌های تا ۲۰۰۰ متر مربع.",
    features: ["طول لوله ۱۰۰ متر", "فاصله قطره‌چکان ۳۰ سانتی‌متر", "شامل اتصالات کامل", "مقاوم به UV"],
    cropTags: ["cucumber", "citrus", "tomato"],
    pestTags: [],
    usage: {
      dosage: "-",
      method: "نصب نوار تیپ در امتداد ردیف کشت و اتصال به منبع آب",
      timing: "قبل از شروع فصل کشت",
    },
    warnings: ["از خم شدن بیش از حد لوله در حین نصب خودداری کنید"],
    compatibleWith: ["کود مایع اسید هیومیک", "کود NPK کامل"],
    brochureAvailable: true,
  },
  {
    id: 12,
    name: "ست ابزار دستی باغبانی ۵ تکه",
    category: "ابزار باغبانی",
    categoryId: "tools",
    subCategoryId: "garden-tool",
    brand: "تکنو فارم",
    price: 210000,
    rating: 4.2,
    reviews: 97,
    image: "/images/products/pruning-shears.jpg",
    inStock: false,
    description: "ست کامل ابزار دستی باغبانی شامل بیل کوچک، شن‌کش، کولتیواتور، بذرکار و دستکش.",
    features: ["۵ قطعه کاربردی", "دسته چوبی ارگونومیک", "کیف حمل رایگان", "مناسب باغچه خانگی"],
    cropTags: ["tomato", "cucumber"],
    pestTags: [],
    usage: {
      dosage: "-",
      method: "استفاده برای شخم سطحی، کاشت بذر و وجین علف‌های هرز",
      timing: "در تمام مراحل باغبانی",
    },
    warnings: [],
    compatibleWith: [],
    brochureAvailable: false,
  },
];

// ========================================
// Helper Data
// ========================================

export const brands = Array.from(new Set(products.map((p) => p.brand)));

export const trendingSearches = [
  "کود اوره",
  "سم علف‌کش",
  "بذر گوجه گلخانه‌ای",
  "سمپاش موتوری",
  "کود مایع هیومیک",
  "نهال پیوندی",
];

export const navLinks = [
  { label: "خانه", href: "/" },
  { label: "محصولات", href: "/products" },
  { label: "خدمات کشاورزی", href: "/services" },
  { label: "بازار کشاورزان", href: "/marketplace" },
  { label: "تخفیف‌ها", href: "/products?featured=true" },
];