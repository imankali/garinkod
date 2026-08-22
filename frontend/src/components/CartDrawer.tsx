// frontend/src/components/CartDrawer.tsx

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Gift,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useCartStore } from "../store/cartStore";
import { productsApi } from "../api/services";
import type { ProductList } from "../types";
import { formatPrice } from "../utils/formatPrice";

// ========================================
// Constants
// ========================================
const FREE_SHIPPING_THRESHOLD = 3000000; // 3 میلیون تومان

// ========================================
// Types
// ========================================
interface SuggestedProduct {
  id: number;
  name: string;
  image: string;
  price: number;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// ========================================
// Helper: تبدیل محصول API به فرمت پیشنهادی
// ========================================
function convertToSuggestion(apiProduct: ProductList): SuggestedProduct {
  return {
    id: apiProduct.id,
    name: apiProduct.title,
    image: apiProduct.image_url || '/images/hero-farm.jpg',
    price: apiProduct.price,
  };
}

// ========================================
// CartDrawer Component
// ========================================
export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const [suggestion, setSuggestion] = useState<SuggestedProduct | null>(null);

  // دریافت توابع و state از cartStore
  const { cart, fetchCart, addToCart, removeFromCart, updateQuantity } = useCartStore();

  // ========================================
  // لود سبد خرید و محصول پیشنهادی هنگام باز شدن
  // ========================================
  useEffect(() => {
    if (isOpen) {
      fetchCart();
      loadSuggestion();
    }
  }, [isOpen]);

  // ========================================
  // لود یک محصول پیشنهادی تصادفی
  // ========================================
  async function loadSuggestion() {
    try {
      const response = await productsApi.getAll({ page: 1 });
      const products = response.data.results;
      if (products.length > 0) {
        const randomProduct = products[Math.floor(Math.random() * products.length)];
        if (randomProduct) {
          setSuggestion(convertToSuggestion(randomProduct));
        }
      }
    } catch (error) {
      console.error('Failed to load suggestion:', error);
    }
  }

  // ========================================
  // محاسبات مالی
  // ========================================
  const items = cart?.items || [];
  const subtotal = cart?.total_price || 0;
  const shippingProgress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const remainingForFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const shipping = subtotal > 0 ? (isFreeShipping ? 0 : 45000) : 0;
  const total = subtotal + shipping;
  const totalItems = cart?.total_items || 0;

  // ✅ بررسی وجود سموم در سبد (برای نمایش هشدار ایمنی)
  const hasPesticide = items.some((item) =>
    item.product?.category === "سموم دفع آفات" ||
    item.product?.category?.toString().toLowerCase().includes("pesticide")
  );

  // ========================================
  // Handlers
  // ========================================
  async function handleUpdateQty(itemId: number, newQty: number) {
    await updateQuantity(itemId, newQty);
  }

  async function handleRemove(itemId: number) {
    await removeFromCart(itemId);
  }

  async function handleAddToCart(productId: number) {
    await addToCart(productId, 1);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed inset-y-0 left-0 z-[70] flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-emerald-950"
          >
            {/* ======================================== */}
            {/* Header */}
            {/* ======================================== */}
            <div className="relative overflow-hidden bg-gradient-to-l from-emerald-600 to-lime-500 px-5 py-5 text-white">
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                    <ShoppingBag size={22} />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold">سبد خرید شما</h2>
                    <p className="text-xs text-white/90">{totalItems} کالا در سبد</p>
                  </div>
                </div>
                <motion.button
                  onClick={onClose}
                  whileHover={{ rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
                >
                  <X size={20} />
                </motion.button>
              </div>

              {/* Free shipping progress bar */}
              {subtotal > 0 && (
                <div className="relative mt-4 rounded-xl bg-white/15 p-3 backdrop-blur">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    {isFreeShipping ? (
                      <span className="flex items-center gap-1.5 font-bold text-lime-200">
                        <CheckCircle2 size={14} /> ارسال رایگان فعال شد!
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Truck size={14} /> {formatPrice(remainingForFreeShipping)} تا ارسال رایگان
                      </span>
                    )}
                    <span className="font-bold">{Math.round(shippingProgress)}%</span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-white/20">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${shippingProgress}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-lime-300 to-white"
                    />
                  </div>
                </div>
              )}

              {/* Trust mini strip */}
              <div className="relative mt-3 flex items-center justify-between text-[10px] text-white/85">
                <span className="flex items-center gap-1">
                  <Truck size={11} /> زمان ارسال پس از هماهنگی
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck size={11} /> ضمانت اصالت کالا
                </span>
                <span className="flex items-center gap-1">
                  ثبت سفارش با هماهنگی کارشناس
                </span>
              </div>
            </div>

            {/* ======================================== */}
            {/* Pesticide Safety Warning */}
            {/* ======================================== */}
            {hasPesticide && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-orange-50 p-3 text-[11px] text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                سبد شما شامل سموم کشاورزی است. لطفاً هنگام مصرف از تجهیزات ایمنی استفاده کرده و دستورالعمل مصرف را
                رعایت کنید.
              </motion.div>
            )}

            {/* ======================================== */}
            {/* Items List */}
            {/* ======================================== */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {items.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex h-full flex-col items-center justify-center gap-4 text-center"
                >
                  <span className="text-7xl">🛒</span>
                  <div>
                    <p className="text-lg font-bold text-slate-700 dark:text-white">سبد خرید شما خالی است</p>
                    <p className="mt-1 text-sm text-slate-400">محصولات مورد علاقه خود را اضافه کنید</p>
                  </div>
                  <motion.button
                    onClick={() => {
                      onClose();
                      window.location.href = '/products';
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="rounded-2xl bg-gradient-to-r from-emerald-600 to-lime-500 px-6 py-3 text-sm font-bold text-white shadow-lg"
                  >
                    مشاهده محصولات
                  </motion.button>
                </motion.div>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {items.map((item) => (
                      <motion.li
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -100, scale: 0.8, transition: { duration: 0.25 } }}
                        transition={{ type: "spring", stiffness: 250, damping: 24 }}
                        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-3 shadow-sm dark:border-emerald-800 dark:from-emerald-900 dark:to-emerald-950"
                      >
                        {/* Product Image */}
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white shadow-inner">
                          <img
                            src={item.product.image_url || item.product.image || '/images/hero-farm.jpg'}
                            alt={item.product.title}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/hero-farm.jpg';
                            }}
                          />
                        </div>

                        {/* Product Info */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-700 dark:text-white">
                            {item.product.title}
                          </p>
                          <div className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                            <span>{item.product.category}</span>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-emerald-700 dark:bg-emerald-900">
                              <motion.button
                                whileTap={{ scale: 0.85 }}
                                onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                                className="flex h-8 w-8 items-center justify-center rounded-r-lg text-emerald-600 hover:bg-emerald-50 dark:text-lime-300 dark:hover:bg-emerald-800"
                              >
                                <Plus size={14} />
                              </motion.button>
                              <motion.span
                                key={item.quantity}
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                className="w-6 text-center text-sm font-bold text-slate-700 dark:text-white"
                              >
                                {item.quantity}
                              </motion.span>
                              <motion.button
                                whileTap={{ scale: 0.85 }}
                                onClick={() => handleUpdateQty(item.id, Math.max(1, item.quantity - 1))}
                                className="flex h-8 w-8 items-center justify-center rounded-l-lg text-slate-500 hover:bg-slate-100 dark:text-emerald-400 dark:hover:bg-emerald-800"
                              >
                                <Minus size={14} />
                              </motion.button>
                            </div>
                            <span className="text-sm font-bold text-emerald-600 dark:text-lime-300">
                              {formatPrice(item.total_price)}
                            </span>
                          </div>
                        </div>

                        {/* Remove Button */}
                        <motion.button
                          whileHover={{ scale: 1.15, rotate: 10 }}
                          whileTap={{ scale: 0.85 }}
                          onClick={() => handleRemove(item.id)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 size={16} />
                        </motion.button>
                      </motion.li>
                    ))}
                  </AnimatePresence>

                  {/* ======================================== */}
                  {/* Cross-sell Suggestion */}
                  {/* ======================================== */}
                  {suggestion && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-dashed border-lime-200 bg-lime-50/60 p-3 dark:border-emerald-700 dark:bg-emerald-900/30"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
                        <img
                          src={suggestion.image}
                          alt={suggestion.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/hero-farm.jpg';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="mb-0.5 flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-lime-300">
                          <Gift size={11} /> شاید به این هم نیاز داشته باشید
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-600 dark:text-emerald-50">
                          {suggestion.name}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddToCart(suggestion.id)}
                        className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-bold text-emerald-600 shadow ring-1 ring-emerald-200 dark:bg-emerald-900 dark:text-lime-300 dark:ring-emerald-700"
                      >
                        افزودن
                      </button>
                    </motion.div>
                  )}
                </ul>
              )}
            </div>

            {/* ======================================== */}
            {/* Footer - Checkout Section */}
            {/* ======================================== */}
            {items.length > 0 && (
              <div className="border-t border-slate-100 bg-gradient-to-br from-white to-emerald-50/30 p-5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:border-emerald-800 dark:from-emerald-950 dark:to-emerald-900/30">
                {/* Price Breakdown */}
                <div className="mb-4 space-y-2 rounded-2xl bg-white/60 p-3 backdrop-blur dark:bg-emerald-900/50">
                  <div className="flex justify-between text-sm text-slate-500 dark:text-emerald-200">
                    <span>جمع کالاها ({totalItems} عدد)</span>
                    <span className="font-semibold text-slate-700 dark:text-white">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500 dark:text-emerald-200">
                    <span className="flex items-center gap-1">
                      <Truck size={14} /> هزینه ارسال
                    </span>
                    {isFreeShipping ? (
                      <span className="font-bold text-emerald-600 dark:text-lime-300">
                        <Sparkles size={12} className="inline" /> رایگان!
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-700 dark:text-white">{formatPrice(shipping)}</span>
                    )}
                  </div>
                  <div className="flex justify-between border-t border-dashed border-slate-200 pt-2 dark:border-emerald-700">
                    <span className="font-bold text-slate-800 dark:text-white">مبلغ قابل پرداخت</span>
                    <span className="text-lg font-extrabold text-emerald-600 dark:text-lime-300">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>

                {/* Checkout Button */}
                <motion.a
                  href="/checkout"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative block w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-lime-500 py-4 text-center text-sm font-bold text-white shadow-lg shadow-emerald-200"
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-l from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Sparkles size={16} />
                    ادامه و ثبت سفارش
                  </span>
                </motion.a>

                <p className="mt-3 text-center text-[10px] text-slate-400 dark:text-emerald-400">
                  مبلغ و موجودی نهایی پیش از تأیید سفارش توسط کارشناس بررسی می‌شود.
                </p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}