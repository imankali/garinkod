// frontend/src/components/storefront/ListingDetailBody.tsx
//
// The detail content of one آگهی — image, price, facts, specs, share, seller
// chip — shared verbatim by the quick-view dialog and the full-page detail
// route. One body, two surfaces: price/stock can never disagree between them.

import { Link } from 'react-router';
import { BadgeCheck, CalendarDays, Store, TrendingDown } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { formatShamsi } from '../../utils/shamsiDate';
import type { MarketplaceListing } from '@/types/storefront';
import { formatPrice } from '../../utils/formatPrice';
import { cn } from '../../utils/cn';
import SpecTable from '../SpecTable';
import SharePanel from '../SharePanel';

export default function ListingDetailBody({ listing }: { listing: MarketplaceListing }) {
  const { t } = useTranslation();
  const discount = listing.discount_percent > 0 ? listing.discount_percent : 0;
  const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
  const hasDiscount = discount > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:gap-5">
      {/* Hero image — on phones a contained 4:3 (a full-bleed square ate the
          whole first screen); on desktop the rounded gallery tile. The price
          floats on the image's bottom edge like a shop tag. */}
      <div className="relative overflow-hidden rounded-2xl bg-emerald-50 ring-1 ring-emerald-100/80 dark:bg-emerald-900/30 dark:ring-emerald-800/60">
        <img
          src={listing.image_url || '/images/hero-farm.jpg'}
          alt={listing.title}
          className="aspect-[4/3] w-full object-cover sm:aspect-square sm:h-full"
          onError={(event) => {
            event.currentTarget.src = '/images/hero-farm.jpg';
          }}
        />
        {hasDiscount && (
          <span className="absolute start-3 top-3 flex items-center gap-1 rounded-full bg-gradient-to-l from-rose-600 to-brand-orange px-2.5 py-1 text-fluid-2xs font-extrabold text-white shadow-lg shadow-rose-900/20">
            <TrendingDown size={12} aria-hidden="true" />
            {discount.toLocaleString('fa-IR')}
            {t('shop.discount')}
          </span>
        )}
        {/* Price tag pinned to the image — the first thing the eye lands on,
            on every screen size, without reading past the fold. */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 rounded-2xl bg-gradient-to-t from-emerald-950/85 via-emerald-950/45 to-transparent p-3 pt-8 sm:hidden">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <strong className="text-fluid-lg font-extrabold text-lime-300 drop-shadow">
                {formatPrice(listing.discounted_price)}
              </strong>
              <span className="text-fluid-2xs text-emerald-100/80">/ {listing.unit}</span>
            </div>
            {hasDiscount && (
              <del className="text-fluid-2xs text-emerald-100/60">{formatPrice(listing.price)}</del>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        {/* Price block — a tinted slab on desktop (the phone carries the
            on-image tag above), so the number reads as THE fact of the page. */}
        <div className="hidden items-baseline gap-2 rounded-2xl bg-gradient-to-l from-emerald-50 to-transparent p-3 sm:flex dark:from-emerald-900/50">
          <strong className="text-fluid-xl font-extrabold text-emerald-700 dark:text-lime-300">
            {formatPrice(listing.discounted_price)}
          </strong>
          {hasDiscount && (
            <del className="text-fluid-xs text-slate-400">{formatPrice(listing.price)}</del>
          )}
          <span className="text-fluid-xs text-slate-400">/ {listing.unit}</span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-fluid-xs sm:mt-4">
          <Fact label="موجودی" value={`${listing.quantity_available} ${listing.unit}`} tone={listing.is_purchasable ? 'ok' : 'low'} />
          <Fact label="حداقل سفارش" value={`${listing.minimum_order} ${listing.unit}`} />
          <Fact label="محصول" value={listing.crop_name} />
          {listing.harvest_date && (
            <Fact
              label="برداشت"
              value={formatShamsi(listing.harvest_date, 'medium')}
              icon={CalendarDays}
            />
          )}
          {listing.production_date && (
            <Fact
              label="تولید"
              value={formatShamsi(listing.production_date)}
              icon={CalendarDays}
            />
          )}
          {listing.expiry_date && (
            <Fact
              label="انقضا"
              value={formatShamsi(listing.expiry_date)}
              icon={CalendarDays}
            />
          )}
        </dl>

        {listing.description && (
          <p className="mt-4 whitespace-pre-line text-fluid-sm leading-7 text-slate-600 dark:text-emerald-100">
            {listing.description}
          </p>
        )}

        {listing.attributes && listing.attributes.length > 0 && (
          <div className="mt-4">
            <SpecTable rows={listing.attributes} title="مشخصات آگهی" />
          </div>
        )}

        <div className="mt-4">
          <SharePanel
            url={`${siteUrl}/storefronts/${encodeURIComponent(listing.storefront.slug)}?listing=${encodeURIComponent(listing.slug)}`}
            title={`${listing.title} — ${listing.storefront.name}`}
            text={`${formatPrice(listing.discounted_price)} به ازای هر ${listing.unit} · ${listing.crop_name}`}
          />
        </div>

        <Link
          to={`/storefronts/${encodeURIComponent(listing.storefront.slug)}`}
          className="group mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-l from-emerald-50/80 to-transparent p-3 transition hover:border-emerald-300 hover:shadow-sm dark:border-emerald-800/70 dark:from-emerald-900/40 dark:hover:border-emerald-600"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 ring-2 ring-white shadow-sm transition group-hover:ring-emerald-200 dark:bg-emerald-900 dark:text-lime-300 dark:ring-emerald-950">
            {listing.storefront.avatar_url ? (
              <img src={listing.storefront.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Store size={18} />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-fluid-sm font-extrabold text-slate-800 dark:text-white">
              <span className="min-w-0 truncate">{listing.storefront.name}</span>
              {listing.storefront.is_verified && (
                <BadgeCheck size={15} className="shrink-0 text-emerald-600" aria-label="غرفه تأییدشده" />
              )}
            </span>
            <span className="block min-w-0 truncate text-fluid-2xs text-slate-500 dark:text-emerald-200">
              {listing.storefront.seller_type_label}
              {(listing.storefront.city || listing.storefront.province) &&
                ` · ${[listing.storefront.city, listing.storefront.province].filter(Boolean).join('، ')}`}
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon?: typeof CalendarDays;
  /** `ok` = in stock (emerald), `low` = unavailable (amber). */
  tone?: 'default' | 'ok' | 'low';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-2.5 transition-colors',
        tone === 'ok' &&
          'border-emerald-200 bg-emerald-50/80 dark:border-emerald-700/60 dark:bg-emerald-900/40',
        tone === 'low' && 'border-amber-200 bg-amber-50/80 dark:border-amber-700/50 dark:bg-amber-900/30',
        tone === 'default' && 'border-slate-100 bg-slate-50 dark:border-emerald-800/50 dark:bg-emerald-900/40',
      )}
    >
      <dt className="flex items-center gap-1 text-fluid-2xs text-slate-500 dark:text-emerald-300">
        {Icon && <Icon size={11} aria-hidden="true" />}
        {label}
      </dt>
      <dd className="mt-0.5 font-bold text-slate-700 dark:text-white">{value}</dd>
    </div>
  );
}

