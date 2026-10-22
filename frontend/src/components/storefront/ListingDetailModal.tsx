// frontend/src/components/storefront/ListingDetailModal.tsx
//
// The quick-view dialog of one marketplace آگهی. It opens in place on the
// storefront page (from `?listing=<slug>`, the deep link used by «محصول
// پیوست‌شده» in direct messages) and on the marketplace grid — so a buyer
// always lands on the exact product being discussed instead of the
// storefront's front door.
//
// The body is the shared ListingDetailBody: the full-page detail route
// (ListingDetailPage) renders the same content, so price/stock/specs can
// never disagree between the two surfaces.

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, MessageCircle, ShoppingCart } from 'lucide-react';

import { agricultureApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useCartStore } from '../../store/cartStore';
import { useDirectStore } from '../../store/directStore';
import { useTranslation } from '../../i18n';
import type { MarketplaceListing } from '@/types/storefront';
import Modal from '../ui/Modal';
import ListingDetailBody from './ListingDetailBody';
import ListingDetailState from './ListingDetailState';

export default function ListingDetailModal({
  slug,
  initial,
  onClose,
  /** Hide the "message the seller" action for the seller's own آگهی. */
  isOwner = false,
}: {
  /** The آگهی to show; null closes the dialog. */
  slug: string | null;
  /** A listing already on the page, so the dialog can render before fetching. */
  initial?: MarketplaceListing | null;
  onClose: () => void;
  isOwner?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const { t } = useTranslation();
  const addListingToCart = useCartStore((state) => state.addListingToCart);
  const openDirect = useDirectStore((state) => state.openDirect);

  const [listing, setListing] = useState<MarketplaceListing | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [busy, setBusy] = useState(false);
  const [quantityError, setQuantityError] = useState('');

  // Resolve the slug to a fresh listing (stock and price can change after
  // the message that linked here was sent).
  useEffect(() => {
    if (!slug) return undefined;
    let cancelled = false;
    setError('');
    setQuantityError('');
    if (initial && initial.slug === slug) {
      setListing(initial);
      setQuantity(String(initial.minimum_order || 1));
    } else {
      setListing(null);
    }
    setLoading(true);
    agricultureApi
      .getListing(slug)
      .then((response) => {
        if (cancelled) return;
        setListing(response.data);
        setQuantity(String(response.data.minimum_order || 1));
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(parseApiError(caught).message || 'این آگهی در دسترس نیست.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, initial]);

  async function addToCart() {
    if (!listing) return;
    const value = Number(quantity);
    const available = Number(listing.quantity_available);
    if (Number.isNaN(value) || value < listing.minimum_order) {
      setQuantityError(`حداقل سفارش ${listing.minimum_order} ${listing.unit} است.`);
      return;
    }
    if (value > available) {
      setQuantityError(`حداکثر ${available} ${listing.unit} موجود است.`);
      return;
    }
    setQuantityError('');
    setBusy(true);
    try {
      await addListingToCart(listing.id, value);
    } catch (caught) {
      const parsed = parseApiError(caught);
      setQuantityError(parsed.fields.quantity ?? parsed.message);
    } finally {
      setBusy(false);
    }
  }

  function askSeller() {
    if (!listing) return;
    onClose();
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

  return (
    <Modal
      open={Boolean(slug)}
      onClose={onClose}
      title={listing?.title ?? (loading ? t('common.loading') : 'آگهی')}
      description={listing ? `${listing.crop_name} · ${listing.storefront.name}` : undefined}
      size="lg"
      footer={
        listing && !error ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {listing.is_purchasable ? (
              <>
                <label className="flex items-center gap-2 text-fluid-xs font-bold text-slate-600 dark:text-emerald-200">
                  <span className="whitespace-nowrap">مقدار ({listing.unit})</span>
                  <input
                    type="number"
                    min={listing.minimum_order}
                    max={Number(listing.quantity_available)}
                    inputMode="numeric"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    aria-label={`تعداد ${listing.title} بر حسب ${listing.unit}`}
                    className="h-11 w-24 rounded-xl border border-slate-200 px-2 text-center text-sm dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
                  />
                </label>
                <motion.button
                  type="button"
                  onClick={() => void addToCart()}
                  whileHover={!reduceMotion && !busy ? { y: -4 } : undefined}
                  whileTap={!reduceMotion && !busy ? { scale: 0.97 } : undefined}
                  disabled={busy}
                  className="flex min-h-12 min-w-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-500 px-4 text-fluid-sm font-extrabold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-60"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />}
                  {t('shop.buy')}
                </motion.button>
              </>
            ) : (
              <p className="flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-xl bg-slate-100 text-fluid-xs font-bold text-slate-500 dark:bg-emerald-900 dark:text-emerald-200">
                موجودی این آگهی تمام شده است
              </p>
            )}
            {!isOwner && (
              <motion.button
                type="button"
                onClick={askSeller}
                whileHover={reduceMotion ? undefined : { y: -4 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                className="flex min-h-12 min-w-11 items-center justify-center gap-2 rounded-2xl border-2 border-emerald-200 bg-white/60 px-4 text-fluid-xs font-bold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-lime-300 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/70"
              >
                <MessageCircle size={15} />
                {t('storefront.message')}
              </motion.button>
            )}
          </div>
        ) : undefined
      }
    >
      {error ? (
        <ListingDetailState kind="error" message={error} />
      ) : !listing ? (
        <ListingDetailState kind="loading" />
      ) : (
        <>
          <ListingDetailBody listing={listing} />
          {quantityError && (
            <p role="alert" className="mt-3 text-fluid-xs font-semibold text-rose-600">
              {quantityError}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
