// frontend/src/components/storefront/ListingDetailModal.tsx
//
// The detail view of one marketplace آگهی. It opens on the storefront page
// from `?listing=<slug>` — the deep link used by "محصول پیوست‌شده" in direct
// messages — and from tapping a listing card, so a buyer always lands on the
// exact product being discussed instead of the storefront's front door.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  CalendarDays,
  Loader2,
  MessageCircle,
  Package,
  ShoppingCart,
  Store,
} from 'lucide-react';

import { agricultureApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useCartStore } from '../../store/cartStore';
import { useDirectStore } from '../../store/directStore';
import { useTranslation } from '../../i18n';
import type { MarketplaceListing } from '../../types';
import { formatPrice } from '../../utils/formatPrice';
import { cn } from '../../utils/cn';
import Modal from '../ui/Modal';
import SharePanel from '../SharePanel';
import SpecTable from '../SpecTable';

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
  const { t } = useTranslation();
  // Share links must be absolute, so the origin is taken from the deployment.
  const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
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

  const discount = listing && listing.discount_percent > 0 ? listing.discount_percent : 0;

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
                <button
                  type="button"
                  onClick={() => void addToCart()}
                  disabled={busy}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-fluid-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />}
                  {t('shop.buy')}
                </button>
              </>
            ) : (
              <p className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-100 text-fluid-xs font-bold text-slate-500 dark:bg-emerald-900 dark:text-emerald-200">
                موجودی این آگهی تمام شده است
              </p>
            )}
            {!isOwner && (
              <button
                type="button"
                onClick={askSeller}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 text-fluid-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
              >
                <MessageCircle size={15} />
                {t('storefront.message')}
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      {error ? (
        <div className="py-8 text-center">
          <Package size={36} className="mx-auto text-slate-300" />
          <p className="mt-3 text-fluid-sm font-bold text-slate-700 dark:text-white">{error}</p>
          <p className="mt-1 text-fluid-xs text-slate-500 dark:text-emerald-200">
            ممکن است آگهی حذف یا از انتشار خارج شده باشد.
          </p>
        </div>
      ) : !listing ? (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 size={24} className="animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="relative overflow-hidden rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
            <img
              src={listing.image_url || '/images/hero-farm.jpg'}
              alt={listing.title}
              className="aspect-square h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.src = '/images/hero-farm.jpg';
              }}
            />
            {discount > 0 && (
              <span className="absolute start-3 top-3 rounded-full bg-brand-orange px-2.5 py-1 text-fluid-2xs font-bold text-white shadow-md">
                {discount.toLocaleString('fa-IR')}
                {t('shop.discount')}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex items-baseline gap-2">
              <strong className="text-fluid-xl font-extrabold text-emerald-700 dark:text-lime-300">
                {formatPrice(listing.discounted_price)}
              </strong>
              {discount > 0 && (
                <del className="text-fluid-xs text-slate-400">{formatPrice(listing.price)}</del>
              )}
              <span className="text-fluid-xs text-slate-400">/ {listing.unit}</span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-fluid-xs">
              <Fact label="موجودی" value={`${listing.quantity_available} ${listing.unit}`} />
              <Fact label="حداقل سفارش" value={`${listing.minimum_order} ${listing.unit}`} />
              <Fact label="محصول" value={listing.crop_name} />
              {listing.harvest_date && (
                <Fact
                  label="برداشت"
                  value={new Date(listing.harvest_date).toLocaleDateString('fa-IR', {
                    month: 'long',
                    day: 'numeric',
                  })}
                  icon={CalendarDays}
                />
              )}
            </dl>

            {listing.description && (
              <p className="mt-4 whitespace-pre-line text-fluid-sm leading-7 text-slate-600 dark:text-emerald-100">
                {listing.description}
              </p>
            )}

            {/*
              The seller's own numbers (بسته‌بندی، درجه، گواهی) in the same table
              shape the catalogue uses, so a buyer can compare an آگهی with a
              store product instead of reading marketing prose.
            */}
            {listing.attributes && listing.attributes.length > 0 && (
              <div className="mt-4">
                <SpecTable rows={listing.attributes} title="مشخصات آگهی" />
              </div>
            )}

            <div className="mt-4">
              <SharePanel
                url={`${siteUrl}/storefronts/${listing.storefront.slug}?listing=${listing.slug}`}
                title={`${listing.title} — ${listing.storefront.name}`}
                text={`${formatPrice(listing.discounted_price)} به ازای هر ${listing.unit} · ${listing.crop_name}`}
              />
            </div>

            <Link
              to={`/storefronts/${listing.storefront.slug}`}
              onClick={onClose}
              className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-100 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-emerald-900 dark:hover:bg-emerald-900/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
                {listing.storefront.avatar_url ? (
                  <img src={listing.storefront.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Store size={18} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                  <span className="truncate">{listing.storefront.name}</span>
                  {listing.storefront.is_verified && (
                    <BadgeCheck size={15} className="shrink-0 text-emerald-600" aria-label="غرفه تأییدشده" />
                  )}
                </span>
                <span className="block truncate text-fluid-2xs text-slate-500 dark:text-emerald-200">
                  {listing.storefront.seller_type_label}
                  {(listing.storefront.city || listing.storefront.province) &&
                    ` · ${[listing.storefront.city, listing.storefront.province].filter(Boolean).join('، ')}`}
                </span>
              </span>
            </Link>

            {quantityError && (
              <p role="alert" className="mt-3 text-fluid-xs font-semibold text-rose-600">
                {quantityError}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Fact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof CalendarDays;
}) {
  return (
    <div className={cn('rounded-xl bg-slate-50 p-2.5 dark:bg-emerald-900/40')}>
      <dt className="flex items-center gap-1 text-fluid-2xs text-slate-400 dark:text-emerald-300">
        {Icon && <Icon size={11} aria-hidden="true" />}
        {label}
      </dt>
      <dd className="mt-0.5 font-bold text-slate-700 dark:text-white">{value}</dd>
    </div>
  );
}
