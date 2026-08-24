// frontend/src/components/ProductDetailModal.tsx

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Beaker,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  X,
} from "lucide-react";
import { formatPrice } from "../utils/formatPrice";
import type { MockProduct } from "../types";

// ========================================
// Types
// ========================================
type Tab = "description" | "usage" | "warnings" | "brochure";

interface TabItem {
  id: Tab;
  label: string;
  icon: typeof FileText;
}

interface ProductDetailModalProps {
  product: MockProduct | null;
  onClose: () => void;
  onAddToCart: (product: MockProduct, qty: number, e?: React.MouseEvent) => void;
  isWishlisted: boolean;
  onToggleWishlist: (product: MockProduct) => void;
}

// ========================================
// Tabs Configuration
// ========================================
const tabs: TabItem[] = [
  { id: "description", label: "توضیحات", icon: FileText },
  { id: "usage", label: "نحوه مصرف و دوز", icon: Beaker },
  { id: "warnings", label: "هشدارها", icon: AlertTriangle },
  { id: "brochure", label: "بروشور", icon: Download },
];

// ========================================
// ProductDetailModal Component
// ========================================
export default function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  isWishlisted,
  onToggleWishlist,
}: ProductDetailModalProps) {
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState<Tab>("description");

  // اگر محصولی وجود ندارد، هیچ چیزی نمایش نده
  if (!product) return null;

  // ========================================
  // Handle Add to Cart
  // ========================================
  function handleAdd(e: React.MouseEvent) {
    if (!product) return;
    onAddToCart(product, qty, e);
    onClose();
    setQty(1);
    setActiveTab("description");
  }

  return (
    <AnimatePresence>
      {product && (
        <>
          {/* ======================================== */}
          {/* Overlay */}
          {/* ======================================== */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm"
          />

          {/* ======================================== */}
          {/* Modal Panel */}
          {/* ======================================== */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed inset-x-4 top-1/2 z-[90] mx-auto max-h-[90vh] max-w-3xl -translate-y-1/2 overflow-y-auto rounded-3xl bg-white shadow-2xl md:inset-x-auto"
          >
            {/* Close Button */}
            <motion.button
              onClick={onClose}
              whileHover={{ rotate: 90, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute end-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-md backdrop-blur"
              aria-label="بستن"
            >
              <X size={18} />
            </motion.button>

            <div className="grid gap-0 md:grid-cols-2">
              {/* ======================================== */}
              {/* Product Image */}
              {/* ======================================== */}
              <div className="relative h-56 overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-[#F7F3E8] md:h-full">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/hero-farm.jpg';
                  }}
                />

                {/* Badge */}
                {product.badge && (
                  <span className="absolute start-4 top-4 rounded-full bg-brand-orange px-3 py-1 text-xs font-bold text-white shadow-lg">
                    {product.badge}
                  </span>
                )}

                {/* Out of Stock Badge */}
                {!product.inStock && (
                  <span className="absolute bottom-4 start-4 rounded-full bg-slate-800/90 px-3 py-1 text-xs font-bold text-white">
                    ناموجود
                  </span>
                )}
              </div>

              {/* ======================================== */}
              {/* Product Info */}
              {/* ======================================== */}
              <div className="flex flex-col p-6">
                {/* Category & Brand */}
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-bold text-[#0F8A5F]">{product.category}</p>
                  <p className="text-xs text-slate-400">برند: {product.brand}</p>
                </div>

                {/* Product Name */}
                <h2 className="mb-2 text-xl font-extrabold text-slate-800">{product.name}</h2>

                {/* Rating & Reviews */}
                <div className="mb-3 flex items-center gap-1.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      fill={i < Math.round(product.rating) ? "currentColor" : "none"}
                      className={i < Math.round(product.rating) ? "" : "text-slate-200"}
                    />
                  ))}
                  <span className="ms-1 text-xs text-slate-400">
                    ({product.rating}) · {product.reviews.toLocaleString("fa-IR")} نظر ثبت‌شده
                  </span>
                </div>

                {/* Price */}
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-brand-gradient">{formatPrice(product.price)}</span>
                  {product.oldPrice && (
                    <span className="text-sm text-slate-400 line-through">{formatPrice(product.oldPrice)}</span>
                  )}
                </div>

                {/* ======================================== */}
                {/* Tabs */}
                {/* ======================================== */}
                <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1 no-scrollbar">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition-colors ${
                        activeTab === tab.id ? "text-white" : "text-slate-500 hover:text-[#0F8A5F]"
                      }`}
                    >
                      {activeTab === tab.id && (
                        <motion.span
                          layoutId="detail-tab-pill"
                          className="absolute inset-0 rounded-lg bg-brand-gradient-accent"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <tab.icon size={12} className="relative" />
                      <span className="relative">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* ======================================== */}
                {/* Tab Content */}
                {/* ======================================== */}
                <div className="mb-4 min-h-[110px] flex-1">
                  <AnimatePresence mode="wait">
                    {/* Description Tab */}
                    {activeTab === "description" && (
                      <motion.div
                        key="description"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="mb-3 text-sm leading-relaxed text-slate-500">{product.description}</p>
                        <ul className="space-y-1.5">
                          {product.features.map((feature) => (
                            <li key={feature} className="flex items-center gap-2 text-xs text-slate-600">
                              <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}

                    {/* Usage Tab */}
                    {activeTab === "usage" && (
                      <motion.div
                        key="usage"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3 text-xs"
                      >
                        <div className="rounded-xl bg-emerald-50 p-3">
                          <p className="mb-1 flex items-center gap-1.5 font-bold text-[#0F8A5F]">
                            <Beaker size={13} /> دوز مصرف
                          </p>
                          <p className="text-slate-600">{product.usage.dosage}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="mb-1 font-bold text-slate-600">روش مصرف</p>
                          <p className="text-slate-600">{product.usage.method}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="mb-1 flex items-center gap-1.5 font-bold text-slate-600">
                            <CalendarClock size={13} /> زمان مصرف
                          </p>
                          <p className="text-slate-600">{product.usage.timing}</p>
                        </div>
                        {product.usage.preHarvestInterval && (
                          <div className="rounded-xl bg-orange-50 p-3">
                            <p className="mb-1 font-bold text-orange-600">دوره کارنس (فاصله تا برداشت)</p>
                            <p className="text-slate-600">{product.usage.preHarvestInterval}</p>
                          </div>
                        )}
                        {product.compatibleWith.length > 0 && (
                          <div>
                            <p className="mb-1.5 font-bold text-slate-600">محصولات سازگار برای مصرف همراه</p>
                            <div className="flex flex-wrap gap-1.5">
                              {product.compatibleWith.map((c) => (
                                <span key={c} className="rounded-full bg-white px-2.5 py-1 text-[10px] text-slate-600 ring-1 ring-slate-200">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Warnings Tab */}
                    {activeTab === "warnings" && (
                      <motion.div
                        key="warnings"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2"
                      >
                        {product.warnings.length > 0 ? (
                          product.warnings.map((w) => (
                            <div key={w} className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                              {w}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400">هشدار خاصی برای این محصول ثبت نشده است.</p>
                        )}
                      </motion.div>
                    )}

                    {/* Brochure Tab */}
                    {activeTab === "brochure" && (
                      <motion.div
                        key="brochure"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {product.brochureAvailable ? (
                          <button className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 py-4 text-xs font-bold text-[#0F8A5F] transition-colors hover:bg-emerald-50">
                            <Download size={15} />
                            دانلود برگه آنالیز و بروشور محصول (PDF)
                          </button>
                        ) : (
                          <p className="text-xs text-slate-400">بروشور این محصول به‌زودی بارگذاری می‌شود.</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ======================================== */}
                {/* Actions: Quantity, Add to Cart, Wishlist */}
                {/* ======================================== */}
                <div className="mt-auto flex items-center gap-3">
                  {/* Quantity Selector */}
                  <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setQty((q) => q + 1)}
                      className="flex h-11 w-11 items-center justify-center text-[#0F8A5F] hover:bg-emerald-50"
                      aria-label="افزایش تعداد"
                    >
                      <Plus size={16} />
                    </motion.button>
                    <span className="w-8 text-center font-bold">{qty}</span>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="flex h-11 w-11 items-center justify-center text-slate-500 hover:bg-slate-100"
                      aria-label="کاهش تعداد"
                    >
                      <Minus size={16} />
                    </motion.button>
                  </div>

                  {/* Add to Cart Button */}
                  <motion.button
                    onClick={handleAdd}
                    disabled={!product.inStock}
                    whileHover={product.inStock ? { scale: 1.02 } : {}}
                    whileTap={product.inStock ? { scale: 0.97 } : {}}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-gradient-accent py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ShoppingCart size={17} />
                    {product.inStock ? "افزودن به سبد خرید" : "ناموجود"}
                  </motion.button>

                  {/* Wishlist Button */}
                  <motion.button
                    onClick={() => onToggleWishlist(product)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                      isWishlisted ? "border-rose-200 bg-rose-50 text-rose-500" : "border-slate-200 bg-white text-slate-400 hover:text-rose-500"
                    }`}
                    aria-label={isWishlisted ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
                  >
                    <Heart size={18} fill={isWishlisted ? "currentColor" : "none"} />
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}