// frontend/src/components/AgriCalculator.tsx

import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Calculator, CheckCircle2, ShoppingCart, Sparkles } from "lucide-react";
import { formatPrice } from "../utils/formatPrice";
import { productsApi } from "../api/services";
import type { ProductList, MockProduct } from "../types";

// ========================================
// Types
// ========================================
interface AgriCalculatorProps {
  onAddToCart: (product: MockProduct, qty: number) => void;
}

type Crop = "wheat" | "pistachio" | "tomato" | "citrus";
type NeedType = "weed" | "growth" | "pest";

interface CalculationResult {
  product: ProductList | null;
  qty: number;
  unit: string;
  desc: string;
}

// ========================================
// Constants
// ========================================
const CROPS: { id: Crop; label: string; emoji: string }[] = [
  { id: "wheat", label: "گندم و جو", emoji: "🌾" },
  { id: "pistachio", label: "باغ پسته", emoji: " " },
  { id: "tomato", label: "گوجه و صیفی", emoji: "🍅" },
  { id: "citrus", label: "باغ مرکبات", emoji: "🍊" },
];

const NEED_TYPES: { id: NeedType; label: string; desc: string }[] = [
  { id: "weed", label: "مبارزه با علف هرز", desc: "علف‌کش تخصصی" },
  { id: "growth", label: "تقویت رشد و سرک", desc: "کود اوره / نیتروژن" },
  { id: "pest", label: "مبارزه با شته و آفت", desc: "حشره‌کش سیستمیک" },
];

// Product IDs for different needs (should match your database)
const PRODUCT_IDS: Record<NeedType, number> = {
  weed: 1,      // علف‌کش
  growth: 2,    // کود اوره
  pest: 9,      // حشره‌کش
};

// ========================================
// Helper: تبدیل محصول API به MockProduct
// ========================================
function convertToMockProduct(apiProduct: ProductList): MockProduct {
  return {
    id: apiProduct.id,
    name: apiProduct.title,
    category: typeof apiProduct.category === 'string' ? apiProduct.category : 'کود کشاورزی',
    categoryId: 'fertilizer',
    subCategoryId: '',
    brand: 'گرین کود',
    price: apiProduct.price,
    rating: 4.5,
    reviews: 0,
    image: apiProduct.image_url || '/images/products/default.jpg',
    inStock: apiProduct.is_in_stock,
    description: '',
    features: [],
    cropTags: [],
    pestTags: [],
    usage: {
      dosage: '',
      method: '',
      timing: '',
    },
    warnings: [],
    compatibleWith: [],
    brochureAvailable: false,
  };
}

// ========================================
// AgriCalculator Component
// ========================================
export default function AgriCalculator({ onAddToCart }: AgriCalculatorProps) {
  const [crop, setCrop] = useState<Crop>("wheat");
  const [area, setArea] = useState<number>(2);
  const [needType, setNeedType] = useState<NeedType>("weed");

  // ========================================
  // دریافت محصولات از API
  // ========================================
  const { data: productsData, isLoading, error } = useQuery({
    queryKey: ['calculator-products'],
    queryFn: async () => {
      const response = await productsApi.getAll({ page: 1 });
      return response.data.results || [];
    },
    staleTime: 5 * 60 * 1000, // 5 دقیقه cache
  });

  const products = productsData || [];

  // ========================================
  // محاسبه نتیجه
  // ========================================
  function calculateResult(): CalculationResult {
    if (products.length === 0) {
      return {
        product: null,
        qty: 0,
        unit: '',
        desc: 'در حال بارگذاری...',
      };
    }

    const targetProductId = PRODUCT_IDS[needType];
    const product = products.find((p) => p.id === targetProductId) || products[0];

    let qty: number;
    let unit: string;
    let desc: string;

    switch (needType) {
      case "weed":
        qty = Math.ceil(area * 3.5); // 3.5 لیتر در هکتار
        unit = "لیتر / بطری";
        desc = "برای کنترل علف‌های هرز پهن‌برگ و باریک‌برگ";
        break;
      case "growth":
        qty = Math.ceil((area * 200) / 50); // 200 کیلو در هکتار، کیسه 50 کیلویی
        unit = "کیسه ۵۰ کیلویی";
        desc = "برای تأمین نیتروژن و رشد سریع گیاه";
        break;
      case "pest":
        qty = Math.ceil(area * 2); // 2 بسته در هکتار
        unit = "بسته ۲۵۰ میلی‌لیتری";
        desc = "برای نابودی شته، سفیدبالک و آفات مکنده";
        break;
      default:
        qty = 0;
        unit = '';
        desc = '';
    }

    return { product, qty, unit, desc };
  }

  const result = calculateResult();
  const totalPrice = (result.product?.price || 0) * result.qty;

  // ========================================
  // Handle Add to Cart
  // ========================================
  function handleAddToCart() {
    if (!result.product || result.qty === 0) return;

    const mockProduct = convertToMockProduct(result.product);
    onAddToCart(mockProduct, result.qty);
  }

  // ========================================
  // Loading State
  // ========================================
  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-center rounded-3xl border border-emerald-100 bg-white p-12 dark:border-emerald-900/40 dark:bg-[#08392a]">
          <div className="text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-slate-500 dark:text-emerald-300">در حال بارگذاری محصولات...</p>
          </div>
        </div>
      </section>
    );
  }

  // ========================================
  // Error State
  // ========================================
  if (error) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-center rounded-3xl border border-rose-200 bg-rose-50 p-12 dark:border-rose-900/40 dark:bg-rose-950/30">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-rose-700 dark:text-rose-300">خطا در بارگذاری محصولات</p>
            <p className="text-sm text-slate-500 dark:text-emerald-400 mt-2">لطفاً صفحه را refresh کنید</p>
          </div>
        </div>
      </section>
    );
  }

  // ========================================
  // Render
  // ========================================
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-[#F7F3E8] p-6 shadow-xl dark:border-emerald-900/40 dark:from-[#08392a] dark:to-[#052e22] md:p-8">

        {/* ======================================== */}
        {/* Header */}
        {/* ======================================== */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-gradient-accent px-3 py-1 text-xs font-bold text-white shadow-sm">
              <Calculator size={13} /> ابزار هوشمند کشاورز
            </span>
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white md:text-3xl">
              ماشین‌حساب مصرف دقیق سم و کود
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-emerald-200/80 md:text-sm">
              با وارد کردن متراژ زمین و محصول زراعی، مقدار دقیق نهاده مورد نیاز خود را محاسبه کنید.
            </p>
          </div>
        </div>

        {/* ======================================== */}
        {/* Main Grid */}
        {/* ======================================== */}
        <div className="grid gap-6 lg:grid-cols-12">

          {/* ======================================== */}
          {/* Controls */}
          {/* ======================================== */}
          <div className="space-y-5 rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur dark:bg-emerald-950/60 lg:col-span-7">

            {/* Step 1: Crop Selection */}
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-700 dark:text-emerald-100">
                ۱. محصول کشاورزی شما چیست؟
              </label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {CROPS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCrop(item.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl p-2.5 text-xs font-bold transition-all ${
                      crop === item.id
                        ? "bg-[#0F8A5F] text-white shadow-md"
                        : "bg-slate-50 text-slate-600 hover:bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-200"
                    }`}
                    aria-pressed={crop === item.id}
                    aria-label={`انتخاب ${item.label}`}
                  >
                    <span className="text-lg">{item.emoji}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Area Selection */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-emerald-100">
                <span>۲. مساحت زمین یا باغ شما (به هکتار):</span>
                <span className="text-base text-[#0F8A5F] dark:text-lime-300">
                  {area} هکتار ({area * 10000} متر مربع)
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={20}
                step={0.5}
                value={area}
                onChange={(e) => setArea(Number(e.target.value))}
                className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-emerald-100 accent-[#0F8A5F] dark:bg-emerald-900"
                aria-label="مساحت زمین"
                aria-valuemin={0.5}
                aria-valuemax={20}
                aria-valuenow={area}
              />
              <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                <span>نیم هکتار</span>
                <span>۵ هکتار</span>
                <span>۱۰ هکتار</span>
                <span>۲۰ هکتار</span>
              </div>
            </div>

            {/* Step 3: Need Type Selection */}
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-700 dark:text-emerald-100">
                ۳. نیاز فعلی مزرعه شما چیست؟
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {NEED_TYPES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setNeedType(item.id)}
                    className={`flex flex-col items-start rounded-xl p-3 text-right transition-all ${
                      needType === item.id
                        ? "border-2 border-[#0F8A5F] bg-emerald-50/80 dark:bg-emerald-900/60"
                        : "border border-slate-100 bg-slate-50 hover:border-emerald-200 dark:border-emerald-900/30 dark:bg-emerald-900/30"
                    }`}
                    aria-pressed={needType === item.id}
                    aria-label={item.label}
                  >
                    <span className="text-xs font-bold text-slate-800 dark:text-white">{item.label}</span>
                    <span className="text-[10px] text-slate-400 dark:text-emerald-300">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ======================================== */}
          {/* Result Card */}
          {/* ======================================== */}
          <div className="flex flex-col justify-between rounded-2xl bg-brand-gradient p-6 text-white shadow-lg lg:col-span-5">
            <div>
              {/* Result Header */}
              <div className="mb-4 flex items-center justify-between border-b border-white/20 pb-3">
                <span className="text-xs font-semibold text-emerald-100">
                  پیشنهاد هوشمند کارشناسان کشت‌یار
                </span>
                <Sparkles size={16} className="text-lime-300" />
              </div>

              {/* Product Info */}
              {result.product ? (
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white p-1">
                    <img
                      src={result.product.image_url || result.product.image}
                      alt={result.product.title}
                      className="h-full w-full object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/products/default.jpg';
                      }}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold">{result.product.title}</h3>
                    <p className="text-xs text-lime-200">{result.desc}</p>
                  </div>
                </div>
              ) : (
                <div className="mb-4 text-center text-sm text-emerald-200">
                  محصولی یافت نشد
                </div>
              )}

              {/* Calculation Details */}
              <div className="mb-6 space-y-2.5 rounded-xl bg-black/20 p-4 backdrop-blur">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-100">مقدار مورد نیاز شما:</span>
                  <span className="text-sm font-extrabold text-lime-300">
                    {result.qty.toLocaleString("fa-IR")} {result.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-100">قیمت واحد کالا:</span>
                  <span>{formatPrice(result.product?.price || 0)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/15 pt-2 text-sm font-bold">
                  <span>مجموع هزینه تقریبی:</span>
                  <span className="text-base text-lime-300">{formatPrice(totalPrice)}</span>
                </div>
              </div>
            </div>

            {/* Add to Cart Button */}
            <div className="space-y-2">
              <motion.button
                whileHover={{ scale: result.product && result.qty > 0 ? 1.02 : 1 }}
                whileTap={{ scale: result.product && result.qty > 0 ? 0.98 : 1 }}
                onClick={handleAddToCart}
                disabled={!result.product || result.qty === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-extrabold text-[#0F8A5F] shadow-lg transition-colors hover:bg-lime-300 hover:text-[#064E3B] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`افزودن ${result.qty} عدد به سبد خرید`}
              >
                <ShoppingCart size={18} />
                افزودن کل پکیج به سبد خرید ({result.qty} عدد)
              </motion.button>
              <p className="flex items-center justify-center gap-1 text-center text-[10px] text-emerald-200">
                <CheckCircle2 size={12} /> ارسال رایگان و تضمین اصالت برای این سفارش فعال است
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}