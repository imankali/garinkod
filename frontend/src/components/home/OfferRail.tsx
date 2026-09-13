// frontend/src/components/home/OfferRail.tsx

import { useRef } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';

import { formatPrice } from '../../utils/formatPrice';
import { toPersianDigits } from '../../utils/normalizeDigits';
import type { ProductList } from '@/types/shop';

/**
 * The horizontal card rail shared by the flash-deal and best-seller panels.
 *
 * Native CSS scroll-snap instead of a JS carousel library: momentum scrolling,
 * free keyboard scrolling inside the region, and no observer code to keep in
 * sync with RTL. The round left/right buttons match ProductCarousel's (the
 * «تازه‌های انبار» rail) so every horizontal rail on the site scrolls the same
 * way; on touch widths the swipe itself is the control.
 *
 * Cards show the discount badge, the struck-through original price and the
 * final price — the same trio Digikala shows, because hiding the original
 * price makes a "discount" unverifiable.
 */
export default function OfferRail({ products }: { products: ProductList[] }) {
  // The rail lives on the home page; prefetching the target product page the
  // moment a card gains pointer focus removes most of the navigation latency.
  const queryClient = useQueryClient();
  const railRef = useRef<HTMLDivElement>(null);

  const move = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(rail.clientWidth * 0.8, 280), behavior: 'smooth' });
  };

  return (
    <div className="group/rail relative">
      <div
        ref={railRef}
        className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 touch-pan-x sm:px-6 [scrollbar-width:thin]"
        role="region"
        aria-label="کارت‌های قابل پیمایش افقی"
      >
      {products.map((product) => (
        <Link
          key={product.id}
          to={`/products/${product.slug}`}
          onMouseEnter={() => {
            void queryClient.prefetchQuery({
              queryKey: ['product', product.slug],
              queryFn: () => Promise.resolve(undefined),
              staleTime: 30 * 1000,
            });
          }}
          className="group w-40 shrink-0 snap-start rounded-xl bg-white p-3 text-slate-900 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:-translate-y-1 focus-visible:outline-2 focus-visible:outline-emerald-600 motion-reduce:hover:translate-y-0 sm:w-44"
        >
          <div className="relative">
            <img
              src={product.image_url}
              alt=""
              width={160}
              height={160}
              loading="lazy"
              decoding="async"
              className="h-28 w-full rounded-lg object-cover"
            />
            {product.discount_percent > 0 && (
              <span className="absolute right-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-fluid-2xs font-extrabold text-white">
                {toPersianDigits(product.discount_percent)}٪
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-fluid-xs leading-6 group-hover:text-emerald-800">
            {product.title}
          </p>
          {typeof product.avg_rating === 'number' && product.avg_rating > 0 && (
            <p className="mt-1 flex items-center gap-1 text-fluid-2xs font-bold text-amber-500">
              <Star size={12} aria-hidden="true" className="fill-current" />
              <span className="tabular-nums">{toPersianDigits(product.avg_rating.toFixed(1))}</span>
              {typeof product.reviews_count === 'number' && product.reviews_count > 0 && (
                <span className="font-normal text-slate-400">
                  ({toPersianDigits(product.reviews_count)})
                </span>
              )}
            </p>
          )}
          <div className="mt-2">
            {product.discount_percent > 0 ? (
              <>
                <p className="text-fluid-2xs text-slate-400 line-through">
                  {formatPrice(product.price)}
                </p>
                <p className="text-fluid-sm font-extrabold text-emerald-800">
                  {formatPrice(product.discounted_price)}
                </p>
              </>
            ) : (
              <p className="text-fluid-sm font-extrabold text-emerald-800">
                {formatPrice(product.price)}
              </p>
            )}
          </div>
        </Link>
        ))}
      </div>

      {/* Same controls as the «تازه‌های انبار» carousel: round buttons on
          pointer widths, swipe on touch. In RTL, «قبلی» scrolls right. */}
      <button
        type="button"
        onClick={() => move(-1)}
        aria-label="محصولات قبلی"
        className="absolute left-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:scale-105 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 md:flex dark:bg-emerald-950 dark:text-white dark:ring-emerald-700"
      >
        <ChevronLeft size={22} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        aria-label="محصولات بعدی"
        className="absolute right-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:scale-105 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 md:flex dark:bg-emerald-950 dark:text-white dark:ring-emerald-700"
      >
        <ChevronRight size={22} aria-hidden="true" />
      </button>
    </div>
  );
}
