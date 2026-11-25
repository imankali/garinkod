// frontend/src/components/shop/ProductCard.tsx

import { Link } from 'react-router';
import { ImageOff, Plus } from 'lucide-react';
import { useState } from 'react';

import type { ProductList } from '@/types/shop';
import { cn } from '../../lib/cn';
import { percent } from '../../lib/price';
import { useCartStore } from '../../store/cartStore';
import Price from '../ui/Price';

/**
 * The catalogue card.
 *
 * Anatomy, and why each part is there:
 *   photo   — square, object-cover, on a tinted plate so a transparent PNG
 *             does not float on white. Scales 1.03 INSIDE its frame on hover
 *             (the child moves, not the card — the card must stay still under
 *             the pointer).
 *   badges  — at most two, both checkable facts: the discount number and
 *             "ناموجود". A card that shouts three labels says nothing.
 *   title   — two lines, then ellipsis. The whole card is the link (a stretched
 *             ::after), so the tap target is the card, not the sentence.
 *   price   — one line via <Price>, tabular digits.
 *   add     — a real button. On phones it is the width of the card; on wider
 *             screens it collapses to a 44px square with the label for screen
 *             readers, because at four-up the row has no space for words.
 *
 * No entrance animation per card: a grid of twenty cards fading in one after
 * another is a performance, not a page. The grid's section carries the one
 * reveal.
 */
export default function ProductCard({
  product,
  className,
  priority = false,
}: {
  product: ProductList;
  className?: string;
  /** Above-the-fold cards load eagerly; the rest wait. */
  priority?: boolean;
}) {
  const addToCart = useCartStore((state) => state.addToCart);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const href = `/product/${product.slug}`;
  const inStock = product.is_in_stock ?? product.stock > 0;
  const off = product.discount_percent ?? 0;
  const photo = product.image_srcset?.fallback || product.image_url;
  const second = product.image_alt_url || undefined;

  async function add(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy || !inStock) return;
    setBusy(true);
    try {
      await addToCart(product.id, 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border border-line bg-paper',
        'transition-[border-color,box-shadow] duration-[var(--dur-state)] ease-[var(--ease-out)]',
        'hover:border-brand-300 hover:shadow-[var(--shadow-card)]',
        'dark:border-night-line dark:bg-night-soft dark:hover:border-brand-700',
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-brand-50 dark:bg-night">
        <Link to={href} aria-label={product.title} className="block h-full w-full" tabIndex={-1}>
          {failed || !photo ? (
            <span className="flex h-full w-full items-center justify-center text-ink-mute dark:text-white/40">
              <ImageOff size={26} aria-hidden="true" />
            </span>
          ) : (
            <img
              src={photo}
              alt={product.title}
              width={400}
              height={400}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
              onError={() => setFailed(true)}
              className="h-full w-full object-cover transition-transform duration-[var(--dur-image)] ease-[var(--ease-out)] group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
            />
          )}
        </Link>

        {/* Second photo: cross-fade on hover, pointer devices only. Touch never
            sees it, so it is not rendered as a hover promise on touch. */}
        {second && !failed && (
          <img
            src={second}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 ease-[var(--ease-out)] group-hover:opacity-100 [@media(hover:none)]:hidden"
          />
        )}

        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          {off > 0 ? (
            <span className="rounded-sm bg-brand-900 px-2 py-1 text-2xs font-extrabold text-white shadow-sm">
              {percent(off)}
            </span>
          ) : (
            <span />
          )}
          {!inStock && (
            <span className="rounded-sm bg-ink/85 px-2 py-1 text-2xs font-bold text-white">
              ناموجود
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="truncate text-2xs font-medium text-brand-700 dark:text-brand-300">
          {product.category}
          {product.brand ? <span className="text-ink-mute dark:text-white/45"> · {product.brand}</span> : null}
        </p>

        <h3 className="line-clamp-2 min-h-[2.6em] text-sm font-bold leading-[1.35] text-ink dark:text-white">
          <Link to={href} className="before:absolute before:inset-0 before:z-0 before:content-['']">
            {product.title}
          </Link>
        </h3>

        {typeof product.avg_rating === 'number' && product.avg_rating > 0 && (
          <p className="dateline flex items-center gap-1 text-2xs text-ink-mute dark:text-white/50">
            <span className="font-bold text-gold-700 dark:text-gold-600">
              {product.avg_rating.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span aria-hidden="true">/</span>
            <span>۵</span>
            {typeof product.reviews_count === 'number' && product.reviews_count > 0 && (
              <span>({product.reviews_count.toLocaleString('fa-IR')} نظر)</span>
            )}
          </p>
        )}

        <Price product={product} size="sm" className="mt-auto" />

        {/* Above the stretched link. */}
        <button
          type="button"
          onClick={add}
          disabled={!inStock || busy}
          aria-label={inStock ? `افزودن ${product.title} به سبد خرید` : `${product.title} موجود نیست`}
          className={cn(
            'relative z-10 mt-1 flex min-h-9 items-center justify-center gap-1.5 rounded-sm text-2xs font-bold',
            'transition-[background-color,color] duration-[var(--dur-press)] ease-[var(--ease-out)]',
            'active:scale-[0.98] motion-reduce:active:scale-100',
            inStock
              ? 'border border-brand-200 text-brand-800 hover:border-brand-700 hover:bg-brand-700 hover:text-white dark:border-brand-800 dark:text-brand-200 dark:hover:bg-brand-700 dark:hover:text-white'
              : 'cursor-not-allowed border border-line text-ink-mute dark:border-night-line dark:text-white/35',
            'lg:min-h-9',
          )}
        >
          <Plus size={14} aria-hidden="true" />
          <span>{busy ? 'در حال افزودن…' : inStock ? 'افزودن' : 'اطلاع از موجودی'}</span>
        </button>
      </div>
    </article>
  );
}
