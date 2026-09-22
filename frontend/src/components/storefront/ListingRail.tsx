// frontend/src/components/storefront/ListingRail.tsx
//
// The horizontal listing carousel of the storefront page — the «پرفروش‌ترین‌های
// بانی‌مد» pattern: heading + count chip on one line, «همه» link on the far
// side, and the group's cards sliding in a smooth rail with round edge arrows.
//
// One card per column (single row, like a shop shelf), animated with the same
// rAF tween the home rails use so the whole site shares one scroll personality:
// snap on touch, tweened on the arrow buttons, pause on hover.

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

import { useCartStore } from '../../store/cartStore';
import { formatPrice } from '../../utils/formatPrice';
import { cn } from '../../utils/cn';
import type { MarketplaceListing } from '@/types/storefront';
import { useHorizontalRail } from '../../hooks/useHorizontalRail';

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
    itemCount: items.length,
    autoplayMs: AUTOPLAY_MS,
    fallbackRatio: 0.7,
    minimumStep: 240,
  });

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
    <section
      aria-label={`آگهی‌های دسته ${title}`}
      className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-emerald-900 dark:bg-emerald-950 sm:p-5"
    >
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
        {onOpenAll && (
          <button
            type="button"
            onClick={onOpenAll}
            className="ms-auto inline-flex shrink-0 items-center gap-1 text-fluid-xs font-bold text-emerald-700 transition hover:text-emerald-900 dark:text-lime-300"
          >
            همه
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="relative mt-3">
        <div
          ref={railRef}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="rail-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 touch-pan-x"
          role="region"
          aria-label={`کارت‌های دسته ${title}`}
        >
          {items.map((listing) => (
            <article
              key={listing.id}
              className="w-[46%] min-w-0 shrink-0 snap-start rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950/60 sm:w-[30%] lg:w-[23%]"
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
              <div className="flex flex-col gap-1 p-2.5">
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
                {isOwner ? (
                  (onEdit || onDelete) && (
                    <div className="mt-1 flex gap-1.5">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(listing)}
                          className="flex flex-1 items-center justify-center rounded-lg border border-emerald-300 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
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
                  <>
                    <button
                      type="button"
                      disabled={!listing.is_purchasable}
                      onClick={() => void quickAdd(listing)}
                      className="mt-1 flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-[12px] font-extrabold text-white transition hover:bg-emerald-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-300"
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
                  </>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Round edge arrows — the same controls the home rails use. */}
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="آگهی‌های بعدی"
          className="absolute left-1 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:scale-105 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 dark:bg-emerald-950 dark:text-white dark:ring-emerald-700"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="آگهی‌های قبلی"
          className="absolute right-1 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:scale-105 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 dark:bg-emerald-950 dark:text-white dark:ring-emerald-700"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
