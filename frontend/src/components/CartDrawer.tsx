// frontend/src/components/CartDrawer.tsx

import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useCartStore } from "../store/cartStore";
import PurchaseSteps from "./PurchaseSteps";
import { productsApi } from "../api/services";
import type { CartItem, ProductList } from "../types";
import { formatPrice } from "../utils/formatPrice";
import { cn } from "../utils/cn";

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
  discounted_price: number | null;
  /** Why the basket is being offered this — a random product is not a reason. */
  reason: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// ========================================
// Helper: تبدیل محصول API به فرمت پیشنهادی
// ========================================
function convertToSuggestion(apiProduct: ProductList, reason: string): SuggestedProduct {
  return {
    id: apiProduct.id,
    name: apiProduct.title,
    image: apiProduct.image_url || '/images/hero-farm.jpg',
    price: apiProduct.price,
    discounted_price: apiProduct.discounted_price ?? null,
    reason,
  };
}

// ========================================
// CartDrawer Component
// ========================================
export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  // Traps Tab inside the drawer, closes on Escape, locks background scrolling
  // and returns focus to the cart button when it closes.
  const drawerRef = useFocusTrap<HTMLElement>(isOpen, { onEscape: onClose });
  const [suggestion, setSuggestion] = useState<SuggestedProduct | null>(null);
  /*
    Which row is waiting on the server. A quantity tap that changes the total
    somewhere off-screen reads as a dead button, so the row itself carries the
    wait instead of a toast the shopper has to look for.
  */
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const navigate = useNavigate();

  // دریافت توابع و state از cartStore
  const { cart, fetchCart, addToCart, removeFromCart, updateQuantity, itemErrors } =
    useCartStore();

  // ========================================
  // لود سبد خرید و محصول پیشنهادی هنگام باز شدن
  // ========================================
  /*
    The one extra item the basket offers, chosen for a reason the shopper can
    see — a discounted product, or the best-selling one — and never something
    already in the basket. A random catalogue row is noise that also costs a
    request, so if nothing matches, no offer is shown at all.
  */
  const loadSuggestion = useCallback(async () => {
    const inCart = new Set(
      (useCartStore.getState().cart?.items ?? [])
        .map((item) => item.product?.id)
        .filter((id): id is number => typeof id === 'number'),
    );
    const attempts = [
      { params: { page: 1, page_size: 12, has_discount: true }, reason: 'هم‌اکنون تخفیف دارد' },
      { params: { page: 1, page_size: 12, ordering: '-sales_count' }, reason: 'پرفروش‌ترین محصول' },
    ];
    for (const attempt of attempts) {
      try {
        const response = await productsApi.getAll(attempt.params);
        const found = response.data.results.find(
          (product) => product.available && !inCart.has(product.id),
        );
        if (found) {
          setSuggestion(convertToSuggestion(found, attempt.reason));
          return;
        }
      } catch (error) {
        console.error('Failed to load suggestion:', error);
      }
    }
    setSuggestion(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCart();
      loadSuggestion();
    }
  }, [isOpen, fetchCart, loadSuggestion]);

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
    setBusyItem(itemId);
    try {
      await updateQuantity(itemId, newQty);
    } finally {
      setBusyItem(null);
    }
  }

  /**
   * Storefront listings carry a seller-defined minimum order and their own
   * stock ceiling; catalogue products keep the flat cap of ten. Clamping here
   * keeps the buttons honest, and the server re-checks either way.
   */
  function quantityBounds(item: CartItem) {
    const min = item.kind === 'listing' ? item.min_order_quantity : 1;
    const max =
      item.kind === 'listing'
        ? item.available_quantity
        : Math.min(10, item.available_quantity || 10);
    return { min, max };
  }

  async function handleRemove(itemId: number) {
    setBusyItem(itemId);
    try {
      await removeFromCart(itemId);
    } finally {
      setBusyItem(null);
    }
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
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="سبد خرید"
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed inset-y-0 end-0 z-[70] flex w-full max-w-md flex-col bg-white shadow-2xl outline-none dark:bg-emerald-950"
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
                      className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-l from-lime-300 to-white"
                    />
                  </div>
                </div>
              )}

              {/* Trust mini strip */}
              <div className="relative mt-3 flex items-center justify-between text-fluid-2xs text-white/85">
                <span className="flex items-center gap-1">
                  <Truck size={11} /> زمان ارسال پس از هماهنگی
                </span>
                <Link to="/legal/warranty" className="flex items-center gap-1 underline-offset-2 hover:underline">
                  <ShieldCheck size={11} /> ضمانت اصالت کالا
                </Link>
                <Link to="/legal/shipping" className="flex items-center gap-1 underline-offset-2 hover:underline">
                  ارسال و تحویل پس از هماهنگی
                </Link>
              </div>
            </div>

            {/* Keep the checkout journey visible from its first stage. */}
            {items.length > 0 && (
              <PurchaseSteps currentStep="cart" compact className="mx-4 mt-3" />
            )}

            {/* ======================================== */}
            {/* Pesticide Safety Warning */}
            {/* ======================================== */}
            {hasPesticide && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-orange-50 p-3 text-fluid-xs text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
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
                      navigate('/products');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="rounded-2xl bg-gradient-to-r from-emerald-600 to-lime-500 px-6 py-3 text-sm font-bold text-white shadow-lg"
                  >
                    مشاهده محصولات
                  </motion.button>
                </motion.div>
              ) : (
                <ul className="space-y-2.5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {items.map((item) => {
                      const { min, max } = quantityBounds(item);
                      const unit = item.kind === 'listing' ? item.listing?.unit ?? '' : '';
                      const isListing = item.kind === 'listing';
                      const soldOut = !item.is_in_stock;
                      const scarce =
                        !soldOut && item.available_quantity > 0 && item.available_quantity <= 5;
                      // A unit price is only worth printing when the line total
                      // could not be guessed from it — i.e. more than one item.
                      const showUnitPrice = item.quantity > 1 && item.unit_price > 0;

                      return (
                        <motion.li
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: 24, scale: 0.97 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -100, scale: 0.85, transition: { duration: 0.2 } }}
                          transition={{ type: "spring", stiffness: 260, damping: 26 }}
                          className={cn(
                            "relative overflow-hidden rounded-2xl border bg-white p-3 ps-3.5 shadow-sm transition-colors dark:bg-emerald-900/40",
                            isListing
                              ? "border-lime-200/80 dark:border-emerald-800"
                              : "border-slate-200/80 dark:border-emerald-800",
                            soldOut && "border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20",
                            busyItem === item.id && "opacity-65",
                          )}
                        >
                          {/*
                            Who is selling it, told by colour before it is told by
                            words: a آگهی comes from a غرفه and the seller answers
                            for it, a catalogue item is the platform's own.
                          */}
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute inset-y-0 start-0 w-1",
                              isListing ? "bg-lime-400" : "bg-emerald-500/70",
                            )}
                          />

                          <div className="flex items-start gap-3">
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100 dark:bg-emerald-950 dark:ring-emerald-800">
                              <img
                                src={
                                  isListing
                                    ? item.listing?.image_url || '/images/hero-farm.jpg'
                                    : item.product?.image_url || item.product?.image || '/images/hero-farm.jpg'
                                }
                                alt={item.title}
                                loading="lazy"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/images/hero-farm.jpg';
                                }}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm font-bold leading-5 text-slate-800 dark:text-white">
                                {item.title}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-fluid-2xs text-slate-400 dark:text-emerald-200/70">
                                {isListing ? (
                                  <>
                                    <span className="rounded-full bg-lime-100 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-800 dark:text-lime-200">
                                      غرفه
                                    </span>
                                    <span className="truncate">{item.listing?.storefront_name}</span>
                                  </>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-500 dark:bg-emerald-800/70 dark:text-emerald-100">
                                    {item.product?.category as string}
                                  </span>
                                )}
                                {unit && <span>هر {unit}</span>}
                                {showUnitPrice && (
                                  <span className="font-semibold text-slate-500 dark:text-emerald-200">
                                    · {formatPrice(item.unit_price)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => void handleRemove(item.id)}
                              aria-label={`حذف ${item.title} از سبد`}
                              className="-me-1 -mt-1 flex h-9 shrink-0 items-center gap-1 rounded-xl px-2 text-fluid-2xs font-bold text-rose-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 size={15} />
                              <span className="hidden sm:inline">حذف</span>
                            </button>
                          </div>

                          {/* Quantity and the line total, on one rail. */}
                          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-dashed border-slate-200 pt-2.5 dark:border-emerald-800">
                            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-emerald-700 dark:bg-emerald-900">
                              <motion.button
                                whileTap={{ scale: 0.88 }}
                                type="button"
                                disabled={busyItem === item.id || item.quantity >= max}
                                aria-label={`افزایش تعداد ${item.title}`}
                                onClick={() => void handleUpdateQty(item.id, Math.min(item.quantity + 1, max))}
                                className="flex h-9 w-9 items-center justify-center rounded-s-xl text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35 dark:text-lime-300 dark:hover:bg-emerald-800"
                              >
                                <Plus size={15} />
                              </motion.button>
                              <span
                                className="min-w-11 px-1 text-center text-sm font-extrabold tabular-nums text-slate-800 dark:text-white"
                                aria-live="polite"
                              >
                                {item.quantity.toLocaleString('fa-IR')}
                                {unit && <span className="ms-1 text-fluid-2xs font-bold text-slate-400">{unit}</span>}
                              </span>
                              <motion.button
                                whileTap={{ scale: 0.88 }}
                                type="button"
                                disabled={busyItem === item.id || item.quantity <= min}
                                aria-label={`کاهش تعداد ${item.title}`}
                                onClick={() => void handleUpdateQty(item.id, Math.max(min, item.quantity - 1))}
                                className="flex h-9 w-9 items-center justify-center rounded-e-xl text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-emerald-400 dark:hover:bg-emerald-800"
                              >
                                <Minus size={15} />
                              </motion.button>
                            </div>
                            <span className="text-sm font-extrabold text-emerald-700 dark:text-lime-300">
                              {formatPrice(item.total_price)}
                            </span>
                          </div>

                          {/* Stock and seller rules, said once and where they apply. */}
                          {min > 1 && item.quantity < min && (
                            <p className="mt-2 flex items-start gap-1 rounded-lg bg-amber-50 px-2 py-1 text-fluid-2xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                              <span>
                                حداقل سفارش این غرفه {min.toLocaleString('fa-IR')} {unit || 'عدد'} است.
                              </span>
                            </p>
                          )}
                          {scarce && (
                            <p className="mt-2 text-fluid-2xs font-bold text-amber-600 dark:text-amber-300">
                              فقط {Math.min(item.available_quantity, max).toLocaleString('fa-IR')} {unit || 'عدد'} باقی مانده است.
                            </p>
                          )}
                          {(itemErrors[item.id] || soldOut) && (
                            <p
                              role="alert"
                              className="mt-2 flex items-start gap-1 rounded-lg bg-rose-50 px-2 py-1 text-fluid-xs font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                            >
                              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                              <span>
                                {itemErrors[item.id] ??
                                  (item.available_quantity > 0
                                    ? `موجودی کافی نیست؛ حداکثر ${item.available_quantity.toLocaleString('fa-IR')} قابل سفارش است.`
                                    : 'این مورد دیگر موجود نیست.')}
                              </span>
                            </p>
                          )}
                        </motion.li>
                      );
                    })}
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
                        <p className="mb-0.5 flex items-center gap-1 text-fluid-2xs font-bold text-emerald-600 dark:text-lime-300">
                          <Gift size={11} /> {suggestion.reason}
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-600 dark:text-emerald-50">
                          {suggestion.name}
                        </p>
                        <p className="mt-0.5 flex items-baseline gap-1.5 text-fluid-2xs">
                          <span className="font-extrabold text-emerald-700 dark:text-lime-300">
                            {formatPrice(suggestion.discounted_price ?? suggestion.price)}
                          </span>
                          {suggestion.discounted_price !== null && suggestion.discounted_price < suggestion.price && (
                            <span className="text-slate-400 line-through">{formatPrice(suggestion.price)}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => void handleAddToCart(suggestion.id)}
                          className="rounded-lg bg-white px-2.5 py-1.5 text-fluid-2xs font-bold text-emerald-600 shadow ring-1 ring-emerald-200 transition hover:bg-emerald-50 dark:bg-emerald-900 dark:text-lime-300 dark:ring-emerald-700 dark:hover:bg-emerald-800"
                        >
                          افزودن
                        </button>
                        <button
                          type="button"
                          onClick={() => setSuggestion(null)}
                          aria-label="بستن این پیشنهاد"
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/70 hover:text-slate-600 dark:hover:bg-emerald-800"
                        >
                          <X size={13} />
                        </button>
                      </div>
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

                <p className="mt-3 text-center text-fluid-2xs text-slate-400 dark:text-emerald-400">
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