// frontend/src/components/storefront/ListingRail.tsx
//
// The horizontal listing carousel of the storefront page — the «پرفروش‌ترین‌های
// بانی‌مد» pattern: heading + count chip on one line, «همه» link on the far
// side, and the group's cards sliding in a smooth rail with round edge arrows.
//
// One card per column (single row, like a shop shelf), animated with the same
// rAF tween the home rails use so the whole site shares one scroll personality:
// snap on touch, tweened on the arrow buttons, pause on hover.

import { useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

import { useCartStore } from '../../store/cartStore';
import { formatPrice } from '../../utils/formatPrice';
import { cn } from '../../utils/cn';
import { isLowStock } from '../listing/StockBadge';
import { useAutoRotate } from '../../hooks/useAutoRotate';
import AutoRotateToggle from '../ui/AutoRotateToggle';
import type { MarketplaceListing } from '@/types/storefront';

type Listing = MarketplaceListing;

const AUTOPLAY_MS = 3500;

export default function ListingRail({
  title,
  count,
  items,
  onOpen,
  onOpenAll,
  isOwner = false,
  onEdit,
  onDelete,
  onSendToDirect,
}: {
  title: string;
  count: number;
  items: Listing[];
  onOpen: (listing: Listing) => void;
  /** Where the section's «همه» goes — usually a filtered storefront grid. */
  onOpenAll?: () => void;
  isOwner?: boolean;
  onEdit?: (listing: Listing) => void;
  onDelete?: (listing: Listing) => void;
  onSendToDirect?: (listing: Listing) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const hoverPause = useRef(false);
  const touchPause = useRef(false);
  const busyId = useRef<number | null>(null);
  const cancelTween = useRef<(() => void) | null>(null);
  const addToCart = useCartStore((state) => state.addToCart);
  // Shared site-wide switch, reduced-motion default included.
  const { playing } = useAutoRotate();

  /** rAF tween of the rail's own scrollLeft — identical to the home rails so
   *  every carousel on the site moves the same way. */
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
  const cardStep = (rail: HTMLDivElement): number => {
    const first = rail.children[0] as HTMLElement | undefined;
    const width = first ? first.getBoundingClientRect().width : 0;
    return width > 0 ? width + 12 : Math.max(rail.clientWidth * 0.7, 240);
  };

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
  }, [animateTo]);
  const inViewRef = useRef(false);
  /** Mouse drag-to-scroll state — touch already pans natively, so only the
   *  mouse path is hijacked. `moved` suppresses the click that follows a drag
   *  so grabbing the rail never opens the listing under the cursor. */
  const drag = useRef<{ pointerId: number; lastX: number; moved: boolean; active: boolean } | null>(null);

  const endDrag = () => {
    const d = drag.current;
    const rail = railRef.current;
    if (d) d.active = false;
    if (rail) {
      rail.style.scrollSnapType = '';
      rail.style.userSelect = '';
      rail.style.cursor = '';
    }
  };

  const onRailPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const rail = railRef.current;
    if (!rail) return;
    cancelTween.current?.();
    drag.current = { pointerId: event.pointerId, lastX: event.clientX, moved: false, active: true };
    rail.style.scrollSnapType = 'none';
    rail.style.userSelect = 'none';
    rail.style.cursor = 'grabbing';
    try { rail.setPointerCapture(event.pointerId); } catch { /* older browsers */ }
  };

  const onRailPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const rail = railRef.current;
    if (!d?.active || !rail || event.pointerId !== d.pointerId) return;
    const dx = event.clientX - d.lastX;
    d.lastX = event.clientX;
    if (Math.abs(dx) < 0.5) return;
    d.moved = true;
    // Drag the content like a sheet of paper: moving the mouse left brings
    // the next cards (which live to the left in RTL) into view. scrollBy
    // handles the browser's scrollLeft sign convention for us.
    rail.scrollBy({ left: dx, behavior: 'instant' as ScrollBehavior });
  };

  const onRailClickCapture = (event: React.MouseEvent) => {
    if (drag.current?.moved) {
      event.preventDefault();
      event.stopPropagation();
      drag.current.moved = false;
    }
  };

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

  // Autoplay like the home rails, slower here: a storefront shelf is content
  // the visitor is browsing, not a flash-deal strip to chase.
  useEffect(() => {
    if (items.length < 2 || !playing) return;
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
      if (atEnd) scrollToCard(0);
      else scrollToCard(Math.min(currentIndex + 1, rail.children.length - 1));
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [items.length, playing, scrollToCard]);

  async function quickAdd(listing: Listing) {
    if (busyId.current === listing.id) return;
    busyId.current = listing.id;
    try {
      await addToCart(listing.id, 1);
      toast.success(`«${listing.title}» به سبد خرید اضافه شد`);
    } catch {
      toast.error('افزودن به سبد ناموفق بود');
    } finally {
      busyId.current = null;
    }
  }

  return (
    <section aria-label={`آگهی‌های دسته ${title}`}>
      {/* Heading row: title + count on one side, «همه» on the far side — the
          بانی‌مد/دیجی‌پی شکل. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="min-w-0 truncate text-fluid-base font-extrabold text-slate-900 dark:text-white">
            {title}
          </h3>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-fluid-2xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-lime-300">
            {count.toLocaleString('fa-IR')} آگهی
          </span>
        </div>
        {items.length > 1 && <AutoRotateToggle tone="surface" className="ms-auto" />}
        {onOpenAll && (
          <button
            type="button"
            onClick={onOpenAll}
            className="inline-flex shrink-0 items-center gap-1 text-fluid-xs font-bold text-emerald-700 transition hover:text-emerald-900 dark:text-lime-300"
          >
            مشاهده بیشتر
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="relative mt-3">
        <div
          ref={railRef}
          onPointerEnter={() => { hoverPause.current = true; }}
          onPointerLeave={() => { hoverPause.current = false; endDrag(); }}
          onPointerDown={onRailPointerDown}
          onPointerMove={onRailPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onRailClickCapture}
          onTouchStart={() => {
            cancelTween.current?.();
            touchPause.current = true;
          }}
          onTouchEnd={() => {
            window.setTimeout(() => { touchPause.current = false; }, 2500);
          }}
          className="rail-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 touch-pan-x cursor-grab select-none"
          role="region"
          aria-label={`کارت‌های دسته ${title}`}
        >
          {items.map((listing) => (
            <article
              key={listing.id}
              className="flex w-[46%] min-w-0 shrink-0 snap-start flex-col rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950/60 sm:w-[30%] lg:w-[23%]"
            >
              <button
                type="button"
                onClick={() => onOpen(listing)}
                className="relative block w-full text-start"
                aria-label={`مشاهده جزئیات ${listing.title}`}
              >
                <img
                  src={listing.image_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-28 w-full rounded-t-2xl object-cover sm:h-32"
                />
                {listing.discount_percent > 0 && (
                  <span className="absolute start-2 top-2 rounded-full bg-brand-orange px-2 py-0.5 text-fluid-2xs font-bold text-white">
                    {listing.discount_percent.toLocaleString('fa-IR')}٪
                  </span>
                )}
                {isLowStock(listing.quantity_available) && (
                  <span className="absolute end-2 top-2 rounded-full bg-amber-400/95 px-2 py-0.5 text-fluid-2xs font-extrabold text-amber-950 shadow-sm">
                    موجودی محدود
                  </span>
                )}
                {isOwner && listing.status !== 'published' && (
                  <span
                    className={cn(
                      'absolute end-2 top-2 rounded-full px-2 py-0.5 text-fluid-2xs font-bold',
                      listing.status === 'rejected'
                        ? 'bg-rose-600 text-white'
                        : 'bg-amber-500 text-white',
                    )}
                  >
                    {listing.status_label}
                  </span>
                )}
              </button>
              {/* flex-grow keeps every card the same height, so the action row
                  (cart button / ask link) lines up across the whole shelf —
                  long titles never push one card's button lower. */}
              <div className="flex flex-grow flex-col gap-1 p-2.5">
                <button
                  type="button"
                  onClick={() => onOpen(listing)}
                  className="min-w-0 truncate text-start text-[13px] font-bold text-slate-800 hover:text-emerald-700 hover:underline dark:text-white dark:hover:text-lime-300"
                  title={listing.title}
                >
                  {listing.title}
                </button>
                <p className="flex items-baseline gap-1.5 text-xs text-slate-500 dark:text-emerald-200">
                  <strong className="text-emerald-700 dark:text-lime-300">
                    {formatPrice(listing.discounted_price)}
                  </strong>
                  {listing.discount_percent > 0 && (
                    <del className="text-fluid-2xs text-slate-400">{formatPrice(listing.price)}</del>
                  )}
                  <span className="text-fluid-2xs">/ {listing.unit}</span>
                </p>
                <div className="mt-auto" />
                {isOwner ? (
                  (onEdit || onDelete) && (
                    <div className="mt-1 flex gap-1.5">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(listing)}
                          className="flex flex-1 items-center justify-center rounded-lg border border-emerald-300 py-1.5 text-[12px] font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
                        >
                          ویرایش
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(listing)}
                          className="flex w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                          aria-label={`حذف آگهی ${listing.title}`}
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  <div className="mt-1 flex flex-col items-stretch gap-1">
                    <button
                      type="button"
                      disabled={!listing.is_purchasable}
                      onClick={() => void quickAdd(listing)}
                      className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-[12px] font-extrabold text-white transition hover:bg-emerald-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-300"
                      aria-label={`افزودن ${listing.title} به سبد خرید`}
                    >
                      <ShoppingCart size={13} aria-hidden="true" />
                      {listing.is_purchasable ? 'افزودن به سبد' : 'ناموجود'}
                    </button>
                    {onSendToDirect && (
                      <button
                        type="button"
                        onClick={() => onSendToDirect(listing)}
                        className="text-center text-fluid-2xs font-bold text-sky-600 transition hover:text-sky-800 dark:text-sky-300"
                        title="پرسیدن این آگهی در گفتگو با غرفه‌دار"
                      >
                        پرسش درباره این کالا
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
