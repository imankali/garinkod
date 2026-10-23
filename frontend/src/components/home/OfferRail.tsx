// frontend/src/components/home/OfferRail.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, Star } from 'lucide-react';

import { formatPrice } from '../../utils/formatPrice';
import { toPersianDigits } from '../../utils/normalizeDigits';
import { useCartStore } from '../../store/cartStore';
import { useDragToScroll } from '../../hooks/useDragToScroll';
import PlaybackToggle from '../ui/PlaybackToggle';
import { productsApi } from '../../api/services';
import toast from 'react-hot-toast';
import type { ProductList } from '@/types/shop';

/**
 * The horizontal card rail shared by the flash-deal, best-seller, new-stock
 * and top-rated panels of the home page.
 *
 * Behaviours, each deliberate:
 *  - One row of cards, the same shape as every other rail on the site. Products
 *    used to be paired into two-row columns, which made the four panels on the
 *    home page twice as tall as the department rails and pushed the second row
 *    below the fold on a phone. Card widths now match the other rails
 *    (46% / 30% / 23%), so the panels read as one family.
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

export default function OfferRail({
  products,
  label = 'کارت‌های قابل پیمایش افقی',
  inset = true,
}: {
  products: ProductList[];
  /** Accessible name of the scroll region — lets each panel (flash deals,
   *  best-sellers, …) be told apart by screen readers and tests. */
  label?: string;
  /** Home panels that already sit inside `page-shell` turn this off, so the
   *  cards start on the same line as the section heading instead of a gutter
   *  further in. */
  inset?: boolean;
}) {
  const queryClient = useQueryClient();
  const railRef = useRef<HTMLDivElement>(null);
  const hoverPause = useRef(false);
  const touchPause = useRef(false);
  const busyId = useRef<number | null>(null);
  const cancelTween = useRef<(() => void) | null>(null);
  const addToCart = useCartStore((state) => state.addToCart);

  /** Mouse drag-to-scroll — the shared rails hook: touch pans natively, the
   *  mouse grab follows the pointer, a drag swallows the click that follows
   *  it, and a flick keeps gliding after release. */
  const railDrag = useDragToScroll<HTMLDivElement>(railRef);
  // WCAG 2.2.2: rotation stops when the visitor says so, not only on hover.
  const [playing, setPlaying] = useState(true);

  /** rAF tween of the rail's own scrollLeft — the only horizontal scroll
   *  primitive that behaves identically in every engine we tested AND never
   *  touches the page's vertical scroll. (scrollIntoView used to drag the
   *  whole document toward the rail whenever the next card sat at the
   *  viewport edge, which read as the site scrolling itself up and down.)
   *
   *  The rail carries `snap-mandatory`, and Chromium rewrites every
   *  programmatic scrollLeft assignment to the nearest snap point — which
   *  collapses this tween into a single-frame jump (measured: intermediate
   *  values never land). So the tween suspends snap for its 450 ms and hands
   *  it back afterwards; manual swipes still snap. */
  const animateTo = useCallback((targetLeft: number) => {
    const rail = railRef.current;
    if (!rail) return;
    cancelTween.current?.();
    const start = rail.scrollLeft;
    const delta = targetLeft - start;
    if (Math.abs(delta) < 1) return;
    rail.style.scrollSnapType = 'none';
    const duration = 450;
    const startedAt = performance.now();
    let raf = 0;
    const done = () => {
      rail.style.scrollSnapType = '';
      cancelTween.current = null;
    };
    const step = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      rail.scrollLeft = start + delta * eased;
      if (progress < 1) raf = window.requestAnimationFrame(step);
      else done();
    };
    raf = window.requestAnimationFrame(step);
    cancelTween.current = () => {
      window.cancelAnimationFrame(raf);
      done();
    };
  }, []);

  /** Pixel advance of one column (column + gap). Without layout (jsdom,
   *  hidden node) it falls back to the ~80%-viewport page step. */
  const cardStep = useCallback((rail: HTMLDivElement): number => {
    const first = rail.children[0] as HTMLElement | undefined;
    const width = first ? first.getBoundingClientRect().width : 0;
    return width > 0 ? width + 12 : Math.max(rail.clientWidth * 0.8, 280);
  }, []);

  /** Bring column `index` flush to the start edge. The RTL sign comes from the
   *  live scroll position (negative while scrolled in Chromium RTL), falling
   *  back to the computed direction when the rail sits at 0. */
  const scrollToCard = useCallback((index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const unit = Math.max(cardStep(rail), 1);
    const at = rail.scrollLeft;
    const sign =
      at < 0 ? -1
      : at > 0 ? 1
      : getComputedStyle(rail).direction === 'rtl' ? -1 : 1;
    animateTo(sign * index * unit);
  }, [animateTo, cardStep]);


  // Autoplay runs only while the rail is actually on screen: a rail parked
  // far down the page neither moves itself nor nudges the reader's place.
  const inViewRef = useRef(false);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof IntersectionObserver === 'undefined') {
      inViewRef.current = true;
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { inViewRef.current = Boolean(entry?.isIntersecting); },
      { threshold: 0.35 },
    );
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);

  // Autoplay: one column per 2s. Pointer hover or an active touch pauses it —
  // the standard carousel contract; moving the pointer away resumes.
  useEffect(() => {
    if (!playing || products.length < 2) return;
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const timer = window.setInterval(() => {
      const rail = railRef.current;
      if (!rail || !inViewRef.current || hoverPause.current || touchPause.current) return;
      const maxScroll = rail.scrollWidth - rail.clientWidth;
      if (maxScroll <= 4) return;
      const unit = Math.max(cardStep(rail), 1);
      const travelled = Math.abs(rail.scrollLeft);
      const atEnd = travelled >= maxScroll - 4;
      const currentIndex = Number.isFinite(travelled / unit)
        ? Math.round(travelled / unit)
        : 0;
      if (atEnd) {
        scrollToCard(0); // loop back to the start
      } else {
        scrollToCard(Math.min(currentIndex + 1, rail.children.length - 1));
      }
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [products.length, playing, scrollToCard, cardStep]);

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
      className="group flex h-full flex-1 flex-col gap-1 rounded-xl bg-white p-2 text-slate-900 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:-translate-y-1 focus-visible:outline-2 focus-visible:outline-emerald-600 motion-reduce:hover:translate-y-0"
    >
      <div className="relative">
        <img
          src={product.image_url}
          alt={product.title}
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
      {products.length > 1 && (
        <div className="mb-1 flex justify-end">
          <PlaybackToggle
            playing={playing}
            onToggle={() => setPlaying((value) => !value)}
            subject="پیشنهادها"
            variant="chip"
          />
        </div>
      )}
      <div
        ref={railRef}
        {...railDrag.handlers}
        onPointerDownCapture={() => cancelTween.current?.()}
        onPointerEnter={() => { hoverPause.current = true; }}
        onPointerLeave={() => { hoverPause.current = false; }}
        onTouchStart={() => {
          // A finger on the rail takes over from any running animation:
          // cancel it and hand snap back before the browser records the swipe.
          cancelTween.current?.();
          touchPause.current = true;
        }}
        onTouchEnd={() => {
          // Give momentum scrolling a beat to settle before autoplay resumes.
          window.setTimeout(() => { touchPause.current = false; }, 2500);
        }}
        className={`rail-scroll mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-4 touch-pan-x ${
          inset ? 'px-4 sm:px-6' : ''
        }`}
        role="region"
        aria-label={label}
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="flex w-[46%] min-w-0 shrink-0 snap-start sm:w-[30%] lg:w-[23%]"
          >
            {renderCard(product)}
          </div>
        ))}
      </div>

      {/* Round arrows removed: the rail drags with the mouse on desktop and
          pans natively on touch — one gesture model across every rail. */}
    </div>
  );
}
