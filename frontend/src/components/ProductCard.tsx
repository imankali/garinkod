// frontend/src/components/ProductCard.tsx

import { motion, useReducedMotion } from "framer-motion";
import { Eye, GitCompare, Heart, PackageX, ShoppingCart, Star } from "lucide-react";
import { formatPrice } from "../utils/formatPrice";
import SkeletonCard from "./ui/SkeletonCard";
import type { MockProduct } from '@/types/shop';

// ========================================
// Shared tactile feedback (Phase-2 polish)
// ========================================
// One easing/duration for every pressable part of the card: the press reads
// instantly (0.2s), returns smoothly (easeInOut), and — via the conditional
// whileHover/whileTap below — never fires on a disabled control. Kept as a
// module-local constant so react-refresh sees this file as component-only.
const TACTILE = { duration: 0.2, ease: "easeInOut" } as const;

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
  /** Renders the geometry-exact shimmer instead of real content. Parents
      driving initial loads usually swap in <SkeletonCard variant="product" />
      directly; this prop covers in-place refinements (e.g. isFetching with
      no cached items) without duplicating skeleton markup. */
  isLoading?: boolean;
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
  isLoading = false,
}: ProductCardProps) {
  const reduceMotion = useReducedMotion();
  const cardMotion = reduceMotion ? {} : {
    /* Fade only: a y-offset here makes framer-motion measure the card against
       the window and restore window.scrollY around the keyframe pass, which
       raced the route's scroll-reset and landed /storefronts deep on entry. */
    initial: { opacity: 0 },
    whileInView: { opacity: 1 },
    viewport: { once: true, amount: 0.1 },
  };
  const desktopHover = reduceMotion ? undefined : { y: -4 };

  // Loading contract: identical outer geometry, zero layout shift on swap-in.
  // This component holds no hooks, so an early return is safe.
  if (isLoading) {
    return <SkeletonCard variant="product" />;
  }

  // محاسبه درصد تخفیف
  const discountPercent = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;
  const productUrl = product.slug ? `/products/${product.slug}` : undefined;
  // A disabled control must not *look* pressed either — tactile feedback is
  // gated on the same condition as the `disabled` attribute.
  const compareInteractive = isComparing || !compareDisabled;

  return (
    <motion.div
      {...cardMotion}
      viewport={{ once: true, margin: "-80px" }}
      transition={reduceMotion ? undefined : { delay: Math.min(index * 0.04, 0.2), duration: 0.35 }}
      whileHover={desktopHover}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-shadow duration-300 hover:shadow-xl hover:shadow-emerald-900/10 dark:border-emerald-900/40 dark:bg-ink"
    >
      {/* ======================================== */}
      {/* Badges & Wishlist Button */}
      {/* ======================================== */}
      <div className="absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-1">
        <div className="flex flex-col gap-1.5">
          {product.badge && (
            <span className="rounded-full bg-brand-orange px-2 py-0.5 text-fluid-2xs font-bold text-white shadow">
              {product.badge}
            </span>
          )}
          {discountPercent > 0 && (
            <span className="rounded-full bg-slate-900/85 px-2 py-0.5 text-fluid-2xs font-bold text-lime-300 backdrop-blur">
              {discountPercent.toLocaleString("fa-IR")}٪ تخفیف
            </span>
          )}
          {!product.inStock && (
            <span className="flex items-center gap-1 rounded-full bg-slate-500/90 px-2 py-0.5 text-fluid-2xs font-bold text-white backdrop-blur">
              <PackageX size={10} /> ناموجود
            </span>
          )}
        </div>

        {/* Wishlist Toggle Button — heart keeps a springier personality than
            the CTAs, but rides the same easing so the card feels like one
            material, not five. */}
        <motion.button
      type="button"
          onClick={() => onToggleWishlist(product)}
          whileHover={reduceMotion ? undefined : { scale: 1.08 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          transition={TACTILE}
          className={`tap-target flex h-9 w-9 items-center justify-center rounded-full shadow-md backdrop-blur transition-colors ${
            isWishlisted ? "bg-rose-500 text-white" : "bg-white/90 text-slate-400 hover:text-rose-500"
          }`}
          aria-label={isWishlisted ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
        >
          <Heart size={15} fill={isWishlisted ? "currentColor" : "none"} />
        </motion.button>
      </div>

      {/* ======================================== */}
      {/* Product Image */}
      {/* ======================================== */}
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-emerald-950 dark:to-emerald-900">
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
          {/* Real <picture>: when the backend pipeline has produced variants,
              the browser picks AVIF → WebP → the JPEG the API still ships. */}
          <picture>
            {product.imageSrcset?.avif ? (
              <source
                type="image/avif"
                srcSet={product.imageSrcset.avif}
                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 320px"
              />
            ) : null}
            {product.imageSrcset?.webp ? (
              <source
                type="image/webp"
                srcSet={product.imageSrcset.webp}
                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 320px"
              />
            ) : null}
            <motion.img
              src={product.imageSrcset?.fallback || product.image}
              alt={product.name}
              width={320}
              height={320}
              // Grid cards are never the LCP — stay lazy and off the main thread.
              loading="lazy"
              decoding="async"
              whileHover={reduceMotion ? undefined : { scale: 1.05 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={`h-full w-full object-cover ${!product.inStock ? "grayscale" : ""}`}
              onError={(e) => {
                // Guard against a fallback that itself fails (loop), and prefer
                // the 94KB WebP placeholder over the 263KB JPEG.
                const img = e.currentTarget;
                if (img.src.endsWith('/images/hero-farm.jpg')) return;
                img.onerror = null;
                img.src = img.src.endsWith('/images/hero-farm-768.webp')
                  ? '/images/hero-farm.jpg'
                  : '/images/hero-farm-768.webp';
              }}
            />
          </picture>
        </a>

        {/* Hover cross-fade to the second photo, the way a paper catalogue
            cannot be. Touch devices never see it, so it is hidden outright
            rather than waiting for a hover that will not come. */}
        {product.secondImage && (
          <img
            src={product.secondImage}
            alt=""
            width={320}
            height={320}
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 [@media(hover:none)]:hidden"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}

        {product.expiringSoon && (
          <span className="pointer-events-none absolute bottom-2 start-2 z-10 inline-flex items-center gap-1 rounded-full bg-rose-600/90 px-2 py-0.5 text-fluid-2xs font-bold text-white backdrop-blur">
            نزدیک تاریخ انقضا
          </span>
        )}

        {/* Quick View Overlay — pointer/hover devices only. */}
        <motion.button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQuickView(product);
          }}
          tabIndex={-1}
          className="pointer-events-none absolute inset-x-2 bottom-2 z-[2] hidden translate-y-2 items-center justify-center gap-1 rounded-lg bg-white/95 py-2 text-[11px] font-bold text-slate-700 opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 [@media(hover:hover)]:flex"
          aria-label="نمای سریع محصول"
        >
          <Eye size={14} /> نمای سریع
        </motion.button>
      </div>

      {/* ======================================== */}
      {/* Product Info */}
      {/* ======================================== */}
      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        {/* Category & Brand */}
        <div className="mb-1 flex items-center justify-between gap-1.5">
          <p className="min-w-0 truncate text-fluid-2xs font-medium text-green-700 dark:text-lime-300">{product.category}</p>
          <p className="shrink-0 text-fluid-2xs text-slate-400">{product.brand}</p>
        </div>

        {/* Product Name */}
        <h3 className="mb-1.5 flex-1 text-fluid-xs font-semibold leading-5 text-slate-700 dark:text-emerald-50 sm:text-fluid-sm" title={product.name}>
          {productUrl ? (
            <a
              href={productUrl}
              // The stretched link makes the whole card tappable, which is the
              // real target on a phone rather than the two-line title itself.
              className="line-clamp-2 min-h-10 py-0.5 leading-5 transition-colors before:absolute before:inset-0 before:z-[1] before:content-[''] hover:text-green-700"
            >
              {product.name}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onQuickView(product)}
              className="line-clamp-2 min-h-10 py-0.5 text-start leading-5 transition-colors hover:text-green-700"
            >
              {product.name}
            </button>
          )}
        </h3>

        {/* Ratings are shown only when verified review data exists. */}
        {product.reviews > 0 && (
          // One star, not five: at a 150px card the five-star row wrapped onto
          // a second line and pushed the price below the fold of the card. The
          // number and the review count carry the same information in one line
          // and are what the rails already show.
          <div className="mb-1.5 flex items-center gap-1 text-fluid-2xs font-bold text-amber-500">
            <Star size={11} fill="currentColor" aria-hidden="true" className="shrink-0" />
            <span className="tabular-nums">{product.rating.toLocaleString("fa-IR")}</span>
            <span className="font-normal text-slate-400">
              ({product.reviews.toLocaleString("fa-IR")})
            </span>
          </div>
        )}

        {/* Price — a quote-only line (bulk stock, price moves weekly) shows
            «تماس بگیرید» instead of a stale number the shop cannot honour. */}
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {product.priceOnRequest ? (
            <>
              <span className="text-fluid-xs font-extrabold text-slate-800 dark:text-white sm:text-fluid-sm">تماس بگیرید</span>
              <span className="text-fluid-2xs text-slate-400">قیمت استعلامی</span>
            </>
          ) : (
            <>
              <span className="text-fluid-xs font-extrabold text-slate-800 dark:text-white sm:text-fluid-sm">{formatPrice(product.price)}</span>
              {product.oldPrice && (
                <span className="text-fluid-2xs text-slate-400 line-through">{formatPrice(product.oldPrice)}</span>
              )}
            </>
          )}
        </div>

        {/* ======================================== */}
        {/* Actions: Add to Cart & Compare */}
        {/* ======================================== */}
        <div className="relative z-[2] flex items-center gap-1.5">
          {/* Add to Cart Button — the primary CTA. Tactile press (0.97) is
              the premium touch; it is intentionally absent when the item is
              out of stock, because a dead button should not pretend to live. */}
          <motion.button
      type="button"
            onClick={(e) => onAddToCart(product, e)}
            disabled={!product.inStock}
            whileHover={!reduceMotion && product.inStock ? { y: -4 } : undefined}
            whileTap={!reduceMotion && product.inStock ? { scale: 0.97 } : undefined}
            transition={TACTILE}
            className="tap-target flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-brand-gradient-accent px-1.5 text-fluid-2xs font-bold text-white shadow-md transition-shadow hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 sm:text-fluid-xs"
          >
            <ShoppingCart size={13} aria-hidden="true" className="shrink-0" />
            {/* The short label keeps the button on one line in narrow grid
                columns (two-up on a phone, five-up on desktop); the full
                wording stays available to screen readers. */}
            <span className="min-w-0 truncate 2xl:hidden">
              {product.inStock ? "افزودن" : "اطلاع"}
            </span>
            <span className="hidden min-w-0 truncate 2xl:inline">
              {product.inStock ? "افزودن به سبد" : "اطلاع از موجودی"}
            </span>
            <span className="sr-only 2xl:hidden">
              {product.inStock ? "افزودن به سبد خرید" : "اطلاع از موجودی"}
            </span>
          </motion.button>

          {/* Compare Button — hover/tap only when it can actually respond. */}
          <motion.button
      type="button"
            onClick={() => onToggleCompare(product)}
            disabled={!compareInteractive}
            whileHover={!reduceMotion && compareInteractive ? { y: -4 } : undefined}
            whileTap={!reduceMotion && compareInteractive ? { scale: 0.97 } : undefined}
            transition={TACTILE}
            title={isComparing ? "حذف از مقایسه" : "افزودن به مقایسه"}
            className={`tap-target flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-30 dark:border-emerald-700 ${
              isComparing
                ? "border-green-700 bg-emerald-50 text-green-700 dark:bg-emerald-900 dark:text-lime-300"
                : "border-slate-200 text-slate-400 hover:text-green-700 dark:text-emerald-400"
            }`}
          >
            <GitCompare size={14} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
