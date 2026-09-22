// frontend/src/components/home/OfferRail.tsx

import { useRef } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ShoppingCart, Star } from 'lucide-react';

import { formatPrice } from '../../utils/formatPrice';
import { toPersianDigits } from '../../utils/normalizeDigits';
import { useCartStore } from '../../store/cartStore';
import { productsApi } from '../../api/services';
import toast from 'react-hot-toast';
import type { ProductList } from '@/types/shop';
import { useHorizontalRail } from '../../hooks/useHorizontalRail';

/**
 * The horizontal card rail shared by the flash-deal, best-seller, new-stock
 * and top-rated panels of the home page.
 *
 * Behaviours, each deliberate:
 *  - Cards are laid out in two-row columns: one product on top, one on the
 *    bottom. That makes each card wide (~48% of the rail on a phone, 30% on
 *    desktop — two products per column, four visible on a phone) without
 *    shrinking how much the reader sees.
 *  - Native CSS scroll-snap: momentum scrolling, keyboard friendly, RTL-safe.
 *  - Autoplay every 2s, one column per tick, toward the reading direction; it
 *    loops back to the start at the end. Pointer hover or an active touch
 *    pauses it; reduced-motion users never see the rail move by itself.
 *  - Movement is a rAF tween of the rail's own scrollLeft: it can never
 *    scroll the surrounding page vertically (scrollIntoView did), and it
 *    lands exactly on a snap point in every engine.
 *  - Round left/right buttons on every width — touch users get buttons *and*
 *    swipe.
 *  - A per-card add-to-cart button (quantity 1): browsing and buying are one
 *    gesture, not two pages.
 */
const AUTOPLAY_MS = 2000;

export default function OfferRail({ products }: { products: ProductList[] }) {
  const queryClient = useQueryClient();
  const addToCart = useCartStore((state) => state.addToCart);
  const busyId = useRef<number | null>(null);
  const {
    railRef,
    move,
    onPointerEnter,
    onPointerLeave,
    onTouchStart,
    onTouchEnd,
  } = useHorizontalRail({
    itemCount: products.length,
    autoplayMs: AUTOPLAY_MS,
    fallbackRatio: 0.8,
    minimumStep: 280,
  });

  // Pair products into two-row columns so the rail keeps the intended card
  // density on both mobile and desktop.
  const columns: ProductList[][] = [];
  for (let index = 0; index < products.length; index += 2) {
    columns.push(products.slice(index, index + 2));
  }

  async function quickAdd(product: ProductList) {
    if (busyId.current === product.id) return;
    busyId.current = product.id;
    try {
      await addToCart(product.id, 1);
      toast.success(`«${product.title}» به سبد خرید اضافه شد`);
    } catch {
      toast.error('افزودن به سبد ناموفق بود');
    } finally {
      busyId.current = null;
    }
  }

  const renderCard = (product: ProductList) => (
    <Link
      key={product.id}
      to={`/products/${product.slug}`}
      onMouseEnter={() => {
        // Prefetch with the SAME queryFn the product page uses (same
        // cache key): a resolved-undefined stub used to poison the
        // shared ['product', slug] entry and throw in React Query v5.
        void queryClient.prefetchQuery({
          queryKey: ['product', product.slug],
          queryFn: async () => (await productsApi.getBySlug(product.slug)).data,
          staleTime: 5 * 60 * 1000,
        });
      }}
      className="group flex flex-1 flex-col gap-1 rounded-xl bg-white p-2 text-slate-900 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:-translate-y-1 focus-visible:outline-2 focus-visible:outline-emerald-600 motion-reduce:hover:translate-y-0"
    >
      <div className="relative">
        <img
          src={product.image_url}
          alt=""
          width={280}
          height={224}
          loading="lazy"
          decoding="async"
          className="h-32 w-full rounded-lg object-cover sm:h-40"
        />
        {product.discount_percent > 0 && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
            {toPersianDigits(product.discount_percent)}٪
          </span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 group-hover:text-emerald-800 sm:text-fluid-sm">
        {product.title}
      </p>
      {typeof product.avg_rating === 'number' && product.avg_rating > 0 && (
        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-amber-500">
          <Star size={12} aria-hidden="true" className="fill-current" />
          <span className="tabular-nums">{toPersianDigits(product.avg_rating.toFixed(1))}</span>
          {typeof product.reviews_count === 'number' && product.reviews_count > 0 && (
            <span className="font-normal text-slate-400">
              ({toPersianDigits(product.reviews_count)})
            </span>
          )}
        </p>
      )}
      <div className="mt-1">
        {product.discount_percent > 0 ? (
          <>
            <p className="text-[11px] text-slate-400 line-through">
              {formatPrice(product.price)}
            </p>
            <p className="text-[13px] font-extrabold text-emerald-800 sm:text-fluid-sm">
              {formatPrice(product.discounted_price)}
            </p>
          </>
        ) : (
          <p className="text-[13px] font-extrabold text-emerald-800 sm:text-fluid-sm">
            {product.price_on_request ? 'تماس بگیرید' : formatPrice(product.price)}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label={`افزودن ${product.title} به سبد خرید`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void quickAdd(product);
        }}
        className="mt-auto flex h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-[13px] font-extrabold text-white transition hover:bg-emerald-700 active:scale-[0.97]"
      >
        <ShoppingCart size={14} aria-hidden="true" />
        افزودن
      </button>
    </Link>
  );

  return (
    <div className="group/rail relative">
      <div
        ref={railRef}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="rail-scroll mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 touch-pan-x sm:px-6"
        role="region"
        aria-label="کارت‌های قابل پیمایش افقی"
      >
        {columns.map((column, columnIndex) => (
          <div
            key={column[0]?.id ?? `column-${columnIndex}`}
            className="flex w-[48%] min-w-0 shrink-0 snap-start flex-col gap-3 sm:w-[30%]"
          >
            {column.map((product) => renderCard(product))}
          </div>
        ))}
      </div>

      {/* Round controls, visible on every width — touch users get buttons and
          swipe. RTL carousel contract (Digikala-style): the RIGHT button slides
          the content rightward, bringing the earlier (right-side) products into
          view; the LEFT button slides content leftward for the later ones. The
          chevrons point the way the CONTENT moves, not the way new items enter. */}
      <button
        type="button"
        onClick={() => move(1)}
        aria-label="محصولات بعدی"
        className="absolute left-1 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:scale-105 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 dark:bg-emerald-950 dark:text-white dark:ring-emerald-700"
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => move(-1)}
        aria-label="محصولات قبلی"
        className="absolute right-1 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:scale-105 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 dark:bg-emerald-950 dark:text-white dark:ring-emerald-700"
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
