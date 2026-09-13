// frontend/src/components/MarketplaceListingCard.tsx
//
// A compact product card for marketplace listings, used by the storefronts
// page's "best sellers / most discounted" sections. Besides adding to cart it
// can send the listing straight to the storefront's direct messages so the
// buyer can ask for advice about that exact product.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router';
import { Eye, MessageCircle, ShoppingCart } from 'lucide-react';

import { useCartStore } from '../store/cartStore';
import { useDirectStore } from '../store/directStore';
import { useTranslation } from '../i18n';
import type { MarketplaceListing } from '@/types/storefront';
import { formatPrice } from '../utils/formatPrice';
import { listingHref } from '../utils/listingHref';
import SkeletonCard from './ui/SkeletonCard';
import ListingDetailModal from './storefront/ListingDetailModal';

// Shared press physics with ProductCard: crisp 0.2s, soft in-out, and only
// ever on controls that are actually enabled.
const TACTILE = { duration: 0.2, ease: 'easeInOut' } as const;

/**
 * `discount` is the row variant used inside «پرتخفیف‌ترین‌ها».
 *
 * That section is already the discount list, so a «پرتخفیف‌ترین» chip on every
 * card repeats the heading five times and pushes the price down; what a buyer
 * needs there is the number. The variant keeps only a small red watermark of the
 * percentage, which is a fact about the price rather than a claim about the row.
 */
export type ListingCardVariant = 'default' | 'discount';

export default function MarketplaceListingCard({
  listing,
  index = 0,
  isLoading = false,
  variant = 'default',
}: {
  listing: MarketplaceListing;
  index?: number;
  /** Swaps the card for its geometry-exact shimmer (see SkeletonCard). */
  isLoading?: boolean;
  variant?: ListingCardVariant;
}) {
  const { t } = useTranslation();
  const addListingToCart = useCartStore((state) => state.addListingToCart);
  const openDirect = useDirectStore((state) => state.openDirect);
  // Quick view parity with the catalogue card: the آگهی is inspected in place,
  // without leaving the shelf it was found on.
  const [quickView, setQuickView] = useState(false);

  // Hooks above stay unconditional; the skeleton short-circuit lives after
  // them, keeping the call order identical on every render.
  if (isLoading) {
    return <SkeletonCard variant="listing" />;
  }

  async function addToCart() {
    try {
      await addListingToCart(listing.id, listing.minimum_order || 1);
    } catch {
      // The cart store surfaces errors itself.
    }
  }

  function sendToDirect() {
    openDirect({
      storefrontSlug: listing.storefront.slug,
      listing: {
        id: listing.id,
        title: listing.title,
        slug: listing.slug,
        price: listing.price,
        discounted_price: listing.discounted_price,
        unit: listing.unit,
        image_url: listing.image_url,
        storefront_name: listing.storefront.name,
        storefront_slug: listing.storefront.slug,
      },
    });
  }

  const discount = listing.discount_percent > 0 ? listing.discount_percent : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: (index % 4) * 0.05, duration: 0.35 }}
      whileHover={{ y: -4 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm transition-shadow duration-300 hover:shadow-lg hover:shadow-emerald-900/5 dark:border-emerald-900 dark:bg-[#08392a]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-emerald-50 dark:bg-emerald-950">
        <Link
          to={listingHref(listing)}
          className="block h-full w-full"
          aria-label={`مشاهدهٔ ${listing.title}`}
        >
        {/* Same <picture> contract as ProductCard: API-provided AVIF/WebP
            variants when the listing image went through the backend pipeline. */}
        <picture>
          {listing.image_srcset?.avif ? (
            <source
              type="image/avif"
              srcSet={listing.image_srcset.avif}
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 320px"
            />
          ) : null}
          {listing.image_srcset?.webp ? (
            <source
              type="image/webp"
              srcSet={listing.image_srcset.webp}
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 320px"
            />
          ) : null}
          <img
            src={listing.image_srcset?.fallback || listing.image_url || '/images/hero-farm.jpg'}
            alt={listing.title}
            width={320}
            height={240}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </picture>
        </Link>
        {/*
          Badges that state something checkable, and nothing else:
          «نو» was printed on every card forever, which is how a badge stops
          being read at all. Stock is the seller's own declaration, the
          best-seller mark is a real count, and the discount pill mirrors the
          catalogue card's — a price fact the default row used to hide in a
          struck-through number.
        */}
        {variant === 'default' ? (
          <div className="absolute start-2.5 top-2.5 flex max-w-[75%] flex-col items-start gap-1">
            {discount > 0 && (
              <span className="rounded-full bg-slate-900/85 px-2.5 py-1 text-fluid-2xs font-bold text-lime-300 backdrop-blur">
                {discount.toLocaleString('fa-IR')}٪ تخفیف
              </span>
            )}
            {listing.sales_count > 0 && (
              <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-fluid-2xs font-bold text-white shadow-md">
                پرفروش‌ترین
              </span>
            )}
            {listing.is_stock && (
              <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-fluid-2xs font-bold text-white shadow-md">
                استوک
              </span>
            )}
          </div>
        ) : discount > 0 ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="-rotate-12 rounded-lg border-2 border-rose-500/80 bg-rose-500/15 px-2.5 py-1 text-center text-fluid-sm font-extrabold text-rose-600 backdrop-blur-[1px] dark:text-rose-300">
              ٪{discount.toLocaleString('fa-IR')}
              <span className="block text-fluid-2xs leading-4">تخفیف</span>
            </span>
          </span>
        ) : null}
        {/*
          A card whose seller has nothing to sell says so in the same words the
          rest of the site uses («ناموجود» — the listing is unpublished or its
          quantity has run out); «وضعیت», the label that used to sit here, only
          pointed at the idea of a status without naming it.
        */}
        {!listing.is_purchasable && (
          <span className="absolute end-2.5 top-2.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-fluid-2xs font-bold text-white">
            ناموجود
          </span>
        )}

        {/* Quick view overlay — pointer/hover devices only, the same contract
            as ProductCard; touch devices keep the deep link, which opens this
            very dialog on the storefront page. */}
        <motion.button
          type="button"
          onClick={() => setQuickView(true)}
          tabIndex={-1}
          className="pointer-events-none absolute inset-x-3 bottom-3 z-[2] hidden translate-y-2 items-center justify-center gap-1.5 rounded-xl bg-white/95 py-2.5 text-xs font-bold text-slate-700 opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 [@media(hover:hover)]:flex"
          aria-label={`نمای سریع ${listing.title}`}
        >
          <Eye size={14} aria-hidden="true" /> نمای سریع
        </motion.button>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <Link
          to={listingHref(listing)}
          className="line-clamp-2 min-h-11 py-1 text-fluid-sm font-extrabold text-slate-800 transition-colors hover:text-emerald-700 dark:text-white dark:hover:text-lime-300"
        >
          {listing.title}
        </Link>
        <p className="mt-1 min-w-0 truncate text-fluid-2xs text-slate-500 dark:text-emerald-300/70">
          {listing.storefront.name}
          {' · '}
          {listing.category_label || listing.crop_name}
        </p>

        <div className="mt-2.5 flex items-baseline gap-2">
          <strong className="text-sm font-extrabold text-emerald-700 dark:text-lime-300">
            {formatPrice(listing.discounted_price)}
          </strong>
          {discount > 0 && variant === 'default' && (
            <del className="text-fluid-2xs text-slate-400">{formatPrice(listing.price)}</del>
          )}
          <span className="text-fluid-2xs text-slate-400">/ {listing.unit}</span>
        </div>

        <div className="mt-3 flex gap-2">
          {/* Buy — the primary CTA. The 0.97 press sells the click; it is
              gated off when the listing cannot be purchased. */}
          <motion.button
            type="button"
            onClick={() => void addToCart()}
            disabled={!listing.is_purchasable}
            whileHover={listing.is_purchasable ? { scale: 1.03 } : {}}
            whileTap={listing.is_purchasable ? { scale: 0.97 } : {}}
            transition={TACTILE}
            className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2 text-fluid-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label={t('shop.buy')}
          >
            <ShoppingCart size={14} aria-hidden="true" />
            {t('shop.buy')}
          </motion.button>
          {/* Direct message — always enabled, always tactile. */}
          <motion.button
            type="button"
            onClick={sendToDirect}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={TACTILE}
            title={t('storefront.sendToDirectHint')}
            className="flex min-h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900"
            aria-label={t('storefront.sendToDirect')}
          >
            <MessageCircle size={15} aria-hidden="true" />
          </motion.button>
        </div>
      </div>

      {/* The detail view, in place: «نمای سریع» opens it without leaving the
          shelf; the title/image deep link opens the same dialog on the
          storefront page for touch devices. */}
      <ListingDetailModal
        slug={quickView ? listing.slug : null}
        initial={listing}
        onClose={() => setQuickView(false)}
      />
    </motion.article>
  );
}
