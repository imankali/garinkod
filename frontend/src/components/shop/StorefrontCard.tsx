// frontend/src/components/shop/StorefrontCard.tsx

import { Link } from 'react-router';
import { BadgeCheck, MapPin, Store } from 'lucide-react';

import type { Storefront } from '@/types/storefront';
import { cn } from '../../lib/cn';
import { nums } from '../../lib/price';

/**
 * One غرفه.
 *
 * The marketplace is the reason this site is not just a shop, so its card
 * carries what a buyer needs to trust a stranger's stall: who they are, what
 * kind of producer, whether the platform verified them, and how much stock
 * they actually have. No avatar ring, no follower-bait button, no gradient —
 * a stall is a shopfront, not a profile.
 */
export default function StorefrontCard({ storefront, className }: { storefront: Storefront; className?: string }) {
  const initials = storefront.name.trim().slice(0, 2);

  return (
    <article
      className={cn(
        'group flex flex-col gap-3 rounded-lg border border-line bg-paper p-4',
        'transition-[border-color,box-shadow] duration-[var(--dur-state)] ease-[var(--ease-out)]',
        'hover:border-brand-300 hover:shadow-[var(--shadow-card)]',
        'dark:border-night-line dark:bg-night-soft dark:hover:border-brand-700',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-100 text-sm font-extrabold text-brand-800 dark:bg-night dark:text-brand-300">
          {storefront.avatar_url ? (
            <img src={storefront.avatar_url} alt="" width={48} height={48} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-extrabold text-ink dark:text-white">
            <Link to={`/storefront/${storefront.slug}`} className="before:absolute before:inset-0 before:content-['']">
              {storefront.name}
            </Link>
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-ink-mute dark:text-white/55">
            {storefront.is_verified && (
              <span className="inline-flex items-center gap-1 font-bold text-brand-700 dark:text-brand-300">
                <BadgeCheck size={13} aria-hidden="true" /> تأییدشده
              </span>
            )}
            <span>{storefront.seller_type_label || 'فروشنده'}</span>
            {storefront.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} aria-hidden="true" /> {storefront.city}
              </span>
            )}
          </p>
        </div>
      </div>

      {storefront.bio && (
        <p className="line-clamp-2 text-xs leading-6 text-ink-soft dark:text-white/65">{storefront.bio}</p>
      )}

      <dl className="mt-auto flex items-center gap-4 border-t border-line pt-3 text-2xs dark:border-night-line">
        <div>
          <dt className="text-ink-mute dark:text-white/45">آگهی فعال</dt>
          <dd className="dateline font-extrabold text-ink dark:text-white">{nums(storefront.listing_count ?? 0)}</dd>
        </div>
        <div>
          <dt className="text-ink-mute dark:text-white/45">دنبال‌کننده</dt>
          <dd className="dateline font-extrabold text-ink dark:text-white">{nums(storefront.followers_count ?? 0)}</dd>
        </div>
        <span className="ms-auto inline-flex items-center gap-1 text-2xs font-bold text-brand-700 dark:text-brand-300">
          <Store size={13} aria-hidden="true" />
          دیدن غرفه
        </span>
      </dl>
    </article>
  );
}
