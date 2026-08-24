// frontend/src/components/WishlistModal.tsx

import { AnimatePresence, motion } from "framer-motion";
import { Heart, ShoppingBag, Trash2, X } from "lucide-react";
import type { MockProduct } from "../types";
import { formatPrice } from "../utils/formatPrice";

// ========================================
// Types
// ========================================
interface WishlistModalProps {
  wishlist: MockProduct[];
  onClose: () => void;
  onRemove: (id: number) => void;
  onAddToCart: (product: MockProduct, qty: number, e?: React.MouseEvent) => void;
}

// ========================================
// WishlistModal Component
// ========================================
export default function WishlistModal({
  wishlist,
  onClose,
  onRemove,
  onAddToCart,
}: WishlistModalProps) {
  return (
    <AnimatePresence>
      <>
        {/* ======================================== */}
        {/* Overlay */}
        {/* ======================================== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[85] bg-slate-900/60 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* ======================================== */}
        {/* Modal Panel */}
        {/* ======================================== */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          className="fixed inset-x-4 top-1/2 z-[90] mx-auto max-w-2xl -translate-y-1/2 overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-emerald-950"
          role="dialog"
          aria-modal="true"
          aria-label="لیست علاقه‌مندی‌ها"
        >
          {/* ======================================== */}
          {/* Header */}
          {/* ======================================== */}
          <div className="sticky top-0 z-10 flex items-center justify-between bg-gradient-to-l from-rose-500 to-pink-500 px-5 py-4 text-white">
            <div className="flex items-center gap-2">
              <Heart size={20} fill="currentColor" />
              <p className="text-lg font-extrabold">علاقه‌مندی‌های من</p>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {wishlist.length.toLocaleString("fa-IR")} محصول
              </span>
            </div>
            <button
              onClick={onClose}
              className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
              aria-label="بستن"
            >
              <X size={18} />
            </button>
          </div>

          {/* ======================================== */}
          {/* Content */}
          {/* ======================================== */}
          <div className="max-h-[70vh] overflow-y-auto p-4">
            {wishlist.length === 0 ? (
              /* ========================================
                 Empty State
                 ======================================== */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Heart size={64} className="mb-4 text-slate-300 dark:text-emerald-700" />
                <p className="text-lg font-bold text-slate-700 dark:text-white">
                  لیست علاقه‌مندی‌های شما خالی است
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-emerald-300">
                  محصولات مورد علاقه خود را با کلیک روی ❤️ اضافه کنید
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl transition-shadow"
                >
                  مشاهده محصولات
                </button>
              </div>
            ) : (
              /* ========================================
                 Wishlist Items
                 ======================================== */
              <ul className="space-y-3">
                {wishlist.map((product) => (
                  <motion.li
                    key={product.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/50"
                  >
                    {/* Product Image */}
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-emerald-50 dark:bg-emerald-800">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/images/hero-farm.jpg';
                        }}
                      />
                    </div>

                    {/* Product Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-700 dark:text-white">
                        {product.name}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-emerald-300">
                        {product.category}
                      </p>
                      <p className="mt-1 text-sm font-bold text-emerald-600 dark:text-lime-300">
                        {formatPrice(product.price)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      {/* Add to Cart */}
                      <button
                        onClick={(e) => {
                          onAddToCart(product, 1, e);
                        }}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                        aria-label={`افزودن ${product.name} به سبد خرید`}
                      >
                        <ShoppingBag size={12} />
                        افزودن به سبد
                      </button>

                      {/* Remove from Wishlist */}
                      <button
                        onClick={() => onRemove(product.id)}
                        className="flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition-colors"
                        aria-label={`حذف ${product.name} از علاقه‌مندی‌ها`}
                      >
                        <Trash2 size={12} />
                        حذف
                      </button>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}