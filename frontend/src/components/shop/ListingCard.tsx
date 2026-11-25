// frontend/src/components/shop/ListingCard.tsx
//
// One آگهی in a grid: the farmer's own listing, not a catalogue product.
//
// The two are different things and the card says so. A catalogue product has a
// stock count; a listing has a *quantity available* of a crop, a harvest date
// and a minimum order — numbers that come from the row, not from a guess. The
// seller's name and verification come with the nested storefront, so the buyer
// knows who is behind it before opening anything.

import { Link } from 'react-router';
import { BadgeCheck, CalendarDays, MapPin } from 'lucide-react';

import type { MarketplaceListing } from '@/types/storefront';
import { money, nums } from '../../lib/price';
import { date } from '../../lib/date';

export default function ListingCard({ listing }: { listing: MarketplaceListing }) {
  // `discounted_price` is the server's figure; the struck-through price only
  // appears when it is actually different.
  const discounted = Number(listing.discounted_price);
  const base = Number(listing.price);
  const hasDiscount = listing.discount_percent > 0 && discounted < base;

  return (
    <Link
      to={`/listing/${listing.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-paper transition-[border-color,box-shadow] duration-[var(--dur-state)] ease-[var(--ease-out)] hover:border-brand-300 hover:shadow-[var(--shadow-card)] dark:border-night-line dark:bg-night-soft dark:hover:border-brand-700"
    >
      <span className="relative block aspect-[4/3] overflow-hidden bg-brand-50 dark:bg-night">
        {listing.image_url && (
          <img
            src={listing.image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[var(--dur-image)] ease-[var(--ease-out)] group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
          />
        )}
        {hasDiscount && (
          <span className="absolute start-2 top-2 rounded-sm bg-danger-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {nums(listing.discount_percent)}٪
          </span>
        )}
      </span>

      <span className="flex flex-1 flex-col gap-1 p-3">
        <span className="line-clamp-2 text-xs font-extrabold text-ink dark:text-white">{listing.title}</span>

        <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-mute dark:text-white/45">
          {listing.storefront && (
            <>
              <span className="truncate">{listing.storefront.name}</span>
              {listing.storefront.is_verified && (
                <BadgeCheck size={11} aria-hidden="true" className="shrink-0 text-brand-700 dark:text-brand-300" />
              )}
            </>
          )}
          {listing.storefront?.province && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin size={10} aria-hidden="true" />
              {listing.storefront.province}
            </span>
          )}
        </span>

        <span className="mt-auto flex items-baseline gap-1.5 pt-1">
          <span className="dateline text-xs font-extrabold text-brand-800 dark:text-brand-300">
            {money(discounted)}
          </span>
          <span className="text-[11px] text-ink-mute dark:text-white/45">/ {listing.unit}</span>
          {hasDiscount && (
            <span className="dateline text-[11px] text-ink-mute line-through dark:text-white/35">
              {money(base)}
            </span>
          )}
        </span>

        <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-mute dark:text-white/40">
          <span>
            {nums(Number(listing.quantity_available))} {listing.unit} موجود
          </span>
          {listing.harvest_date && (
            <span className="inline-flex items-center gap-0.5">
              <CalendarDays size={10} aria-hidden="true" />
              برداشت {date(listing.harvest_date)}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
