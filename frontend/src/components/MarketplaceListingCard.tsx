// frontend/src/components/MarketplaceListingCard.tsx
//
// A compact product card for marketplace listings, used by the storefronts
// page's "best sellers / most discounted" sections. Besides adding to cart it
// can send the listing straight to the storefront's direct messages so the
// buyer can ask for advice about that exact product.

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MessageCircle, ShoppingCart } from 'lucide-react';

import { useCartStore } from '../store/cartStore';
import { useDirectStore } from '../store/directStore';
import { useTranslation } from '../i18n';
import type { MarketplaceListing } from '../types';
import { formatPrice } from '../utils/formatPrice';

export default function MarketplaceListingCard({ listing, index = 0 }: { listing: MarketplaceListing; index?: number }) {
  const { t } = useTranslation();
  const addListingToCart = useCartStore((state) => state.addListingToCart);
  const openDirect = useDirectStore((state) => state.openDirect);

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
      className="group flex flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm transition hover:shadow-lg hover:shadow-emerald-900/5 dark:border-emerald-900 dark:bg-[#08392a]"
    >
      <Link to={`/storefronts/${listing.storefront.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-emerald-50 dark:bg-emerald-950">
        <img
          src={listing.image_url || '/images/hero-farm.jpg'}
          alt={listing.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {discount > 0 && (
          <span className="absolute start-2.5 top-2.5 rounded-full bg-brand-orange px-2.5 py-1 text-fluid-2xs font-bold text-white shadow-md">
            {discount.toLocaleString('fa-IR')}{t('shop.discount')}
          </span>
        )}
        {!listing.is_purchasable && (
          <span className="absolute end-2.5 top-2.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-fluid-2xs font-bold text-white">
            {t('common.status')}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3.5">
        <Link
          to={`/storefronts/${listing.storefront.slug}`}
          className="line-clamp-2 min-h-11 py-1 text-fluid-sm font-extrabold text-slate-800 transition-colors hover:text-emerald-700 dark:text-white dark:hover:text-lime-300"
        >
          {listing.title}
        </Link>
        <p className="mt-1 truncate text-fluid-2xs text-slate-400 dark:text-emerald-300/70">
          {listing.storefront.name} · {listing.crop_name}
        </p>

        <div className="mt-2.5 flex items-baseline gap-2">
          <strong className="text-sm font-extrabold text-emerald-700 dark:text-lime-300">
            {formatPrice(listing.discounted_price)}
          </strong>
          {discount > 0 && (
            <del className="text-fluid-2xs text-slate-400">{formatPrice(listing.price)}</del>
          )}
          <span className="text-fluid-2xs text-slate-400">/ {listing.unit}</span>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void addToCart()}
            disabled={!listing.is_purchasable}
            className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2 text-fluid-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label={t('shop.buy')}
          >
            <ShoppingCart size={14} aria-hidden="true" />
            {t('shop.buy')}
          </button>
          <button
            type="button"
            onClick={sendToDirect}
            title={t('storefront.sendToDirectHint')}
            className="flex min-h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900"
            aria-label={t('storefront.sendToDirect')}
          >
            <MessageCircle size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
