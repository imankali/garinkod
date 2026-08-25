// frontend/src/components/ProductCard.tsx

import { motion } from "framer-motion";
import { Eye, GitCompare, Heart, PackageX, ShoppingCart, Star } from "lucide-react";
import { formatPrice } from "../utils/formatPrice";
import type { MockProduct } from "../types";

// ========================================
// ProductCard Props Interface
// ========================================
interface ProductCardProps {
  product: MockProduct;
  index: number;
  isWishlisted: boolean;
  isComparing: boolean;
  compareDisabled: boolean;
  onToggleWishlist: (product: MockProduct) => void;
  onAddToCart: (product: MockProduct, e: React.MouseEvent) => void;
  onQuickView: (product: MockProduct) => void;
  onToggleCompare: (product: MockProduct) => void;
}

// ========================================
// ProductCard Component
// ========================================
export default function ProductCard({
  product,
  index,
  isWishlisted,
  isComparing,
  compareDisabled,
  onToggleWishlist,
  onAddToCart,
  onQuickView,
  onToggleCompare,
}: ProductCardProps) {
  // محاسبه درصد تخفیف
  const discountPercent = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;
  const productUrl = product.slug ? `/products/${product.slug}` : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay: (index % 4) * 0.06, duration: 0.4 }}
      whileHover={{ y: -8 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-shadow duration-300 hover:shadow-2xl hover:shadow-emerald-900/10 dark:border-emerald-900/40 dark:bg-[#08392a]"
    >
      {/* ======================================== */}
      {/* Badges & Wishlist Button */}
      {/* ======================================== */}
      <div className="absolute inset-x-3 top-3 z-10 flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          {product.badge && (
            <span className="rounded-full bg-brand-orange px-2.5 py-1 text-fluid-2xs font-bold text-white shadow-lg">
              {product.badge}
            </span>
          )}
          {discountPercent > 0 && (
            <span className="rounded-full bg-slate-900/85 px-2.5 py-1 text-fluid-2xs font-bold text-lime-300 backdrop-blur">
              {discountPercent.toLocaleString("fa-IR")}٪ تخفیف
            </span>
          )}
          {!product.inStock && (
            <span className="flex items-center gap-1 rounded-full bg-slate-500/90 px-2.5 py-1 text-fluid-2xs font-bold text-white backdrop-blur">
              <PackageX size={10} /> ناموجود
            </span>
          )}
        </div>

        {/* Wishlist Toggle Button */}
        <motion.button
          onClick={() => onToggleWishlist(product)}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.85 }}
          className={`flex h-11 w-11 items-center justify-center rounded-full shadow-md backdrop-blur transition-colors ${
            isWishlisted ? "bg-rose-500 text-white" : "bg-white/90 text-slate-400 hover:text-rose-500"
          }`}
          aria-label={isWishlisted ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
        >
          <Heart size={16} fill={isWishlisted ? "currentColor" : "none"} />
        </motion.button>
      </div>

      {/* ======================================== */}
      {/* Product Image */}
      {/* ======================================== */}
      <div className="relative aspect-[4/3] h-40 w-full overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-[#F7F3E8] dark:from-emerald-950 dark:to-emerald-900 md:h-48">
        <a
          href={productUrl || '#'}
          aria-label={`مشاهده ${product.name}`}
          onClick={(event) => {
            if (!productUrl) {
              event.preventDefault();
              onQuickView(product);
            }
          }}
          className="block h-full w-full"
        >
          <motion.img
            src={product.image}
            alt={product.name}
            width={320}
            height={240}
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`aspect-[4/3] h-full w-full object-cover ${!product.inStock ? "grayscale" : ""}`}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/hero-farm.jpg';
            }}
          />
        </a>

        {/* Quick View Overlay — pointer/hover devices only. */}
        <motion.button
          onClick={() => onQuickView(product)}
          tabIndex={-1}
          className="pointer-events-none absolute inset-x-3 bottom-3 hidden translate-y-2 items-center justify-center gap-1.5 rounded-xl bg-white/95 py-2.5 text-xs font-bold text-slate-700 opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 [@media(hover:hover)]:flex"
          aria-label="نمای سریع محصول"
        >
          <Eye size={14} /> نمای سریع
        </motion.button>
      </div>

      {/* ======================================== */}
      {/* Product Info */}
      {/* ======================================== */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category & Brand */}
        <div className="mb-1 flex items-center justify-between">
          <p className="text-fluid-xs font-medium text-[#0F8A5F] dark:text-lime-300">{product.category}</p>
          <p className="text-fluid-2xs text-slate-400">{product.brand}</p>
        </div>

        {/* Product Name */}
        <h3 className="mb-2 flex-1 text-fluid-sm font-semibold text-slate-700 dark:text-emerald-50" title={product.name}>
          {productUrl ? (
            <a
              href={productUrl}
              // The stretched link makes the whole card tappable, which is the
              // real target on a phone rather than the two-line title itself.
              className="line-clamp-2 min-h-11 py-1.5 leading-6 transition-colors before:absolute before:inset-0 before:z-[1] before:content-[''] hover:text-[#0F8A5F]"
            >
              {product.name}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onQuickView(product)}
              className="line-clamp-2 min-h-11 py-1.5 text-start leading-6 transition-colors hover:text-[#0F8A5F]"
            >
              {product.name}
            </button>
          )}
        </h3>

        {/* Ratings are shown only when verified review data exists. */}
        {product.reviews > 0 && (
          <div className="mb-2 flex items-center gap-1 text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={12}
                fill={i < Math.round(product.rating) ? "currentColor" : "none"}
                className={i < Math.round(product.rating) ? "" : "text-slate-200"}
              />
            ))}
            <span className="ms-1 text-xs text-slate-400">
              ({product.rating}) · {product.reviews.toLocaleString("fa-IR")} نظر
            </span>
          </div>
        )}

        {/* Price */}
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-sm font-bold text-slate-800 dark:text-white">{formatPrice(product.price)}</span>
          {product.oldPrice && (
            <span className="text-xs text-slate-400 line-through">{formatPrice(product.oldPrice)}</span>
          )}
        </div>

        {/* ======================================== */}
        {/* Actions: Add to Cart & Compare */}
        {/* ======================================== */}
        <div className="relative z-[2] flex items-center gap-2">
          {/* Add to Cart Button */}
          <motion.button
            onClick={(e) => onAddToCart(product, e)}
            disabled={!product.inStock}
            whileHover={product.inStock ? { scale: 1.03 } : {}}
            whileTap={product.inStock ? { scale: 0.97 } : {}}
            className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-gradient-accent px-2 text-fluid-xs font-bold text-white shadow-md transition-shadow hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShoppingCart size={14} aria-hidden="true" className="shrink-0" />
            {/* The short label keeps the button on one line in narrow grid
                columns (two-up on a phone, five-up on desktop); the full
                wording stays available to screen readers. */}
            <span className="truncate 2xl:hidden">
              {product.inStock ? "افزودن" : "اطلاع"}
            </span>
            <span className="hidden truncate 2xl:inline">
              {product.inStock ? "افزودن به سبد" : "اطلاع از موجودی"}
            </span>
            <span className="sr-only 2xl:hidden">
              {product.inStock ? "افزودن به سبد خرید" : "اطلاع از موجودی"}
            </span>
          </motion.button>

          {/* Compare Button */}
          <motion.button
            onClick={() => onToggleCompare(product)}
            disabled={!isComparing && compareDisabled}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title={isComparing ? "حذف از مقایسه" : "افزودن به مقایسه"}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
              isComparing
                ? "border-[#0F8A5F] bg-emerald-50 text-[#0F8A5F]"
                : "border-slate-200 text-slate-400 hover:text-[#0F8A5F]"
            }`}
          >
            <GitCompare size={15} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}