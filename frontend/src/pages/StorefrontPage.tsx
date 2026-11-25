// frontend/src/pages/StorefrontPage.tsx

import { useParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, MapPin, MessageCircle, Store } from 'lucide-react';

import { storefrontsApi } from '../api/services';
import type { MarketplaceListing } from '@/types/storefront';
import { money, nums } from '../lib/price';
import Button from '../components/ui/Button';
import { ProseSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { useTitle } from '../lib/useTitle';

/**
 * One stall.
 *
 * The page leads with who the seller is (name, kind, place, verified badge),
 * then their live listings as a grid of price-per-unit rows. The one action
 * that matters on a marketplace page is «گفتگو با غرفه» — a buyer who is
 * unsure about a harvest date should not have to hunt for a contact form, so
 * it sits next to the name, not at the bottom.
 */
export default function StorefrontPage() {
  const { slug = '' } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['storefront', slug],
    queryFn: async () => (await storefrontsApi.profile(slug)).data,
    staleTime: 3 * 60 * 1000,
  });

  useTitle(data?.storefront.name);

  if (isLoading) {
    return (
      <div className="shell py-8">
        <ProseSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="shell py-16">
        <EmptyState
          icon={Store}
          title="این غرفه پیدا نشد"
          description="ممکن است غرفه هنوز تأیید نشده یا آدرس آن تغییر کرده باشد."
          action={<Button to="/storefronts" variant="secondary" size="sm">همهٔ غرفه‌ها</Button>}
        />
      </div>
    );
  }

  const { storefront, listings, counts } = data;

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <header className="flex flex-wrap items-start gap-4 rounded-lg border border-line bg-paper p-5 dark:border-night-line dark:bg-night-soft">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-100 text-base font-extrabold text-brand-800 dark:bg-night dark:text-brand-300">
          {storefront.avatar_url ? (
            <img src={storefront.avatar_url} alt="" width={64} height={64} className="h-full w-full object-cover" />
          ) : (
            storefront.name.slice(0, 2)
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-extrabold tracking-[-0.02em] text-ink dark:text-white">
            {storefront.name}
            {storefront.is_verified && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-brand-50 px-1.5 py-0.5 text-2xs font-bold text-brand-800 dark:bg-night dark:text-brand-300">
                <BadgeCheck size={13} aria-hidden="true" /> تأییدشده
              </span>
            )}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-mute dark:text-white/50">
            <span>{storefront.seller_type_label || 'فروشنده'}</span>
            {(storefront.city || storefront.province) && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} aria-hidden="true" />
                {[storefront.province, storefront.city].filter(Boolean).join('، ')}
              </span>
            )}
            <span className="dateline">{nums(counts.listings)} آگهی فعال</span>
            <span className="dateline">{nums(counts.followers)} دنبال‌کننده</span>
          </p>
          {storefront.bio && <p className="mt-2 max-w-[65ch] text-xs leading-7 text-ink-soft dark:text-white/65">{storefront.bio}</p>}
        </div>

        <Button to="/support" variant="secondary" icon={MessageCircle}>
          گفتگو با غرفه
        </Button>
      </header>

      <section aria-labelledby="listings-title">
        <h2 id="listings-title" className="text-base font-extrabold text-ink dark:text-white">
          محصولات این غرفه
        </h2>

        {listings.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="این غرفه الان آگهی فعالی ندارد"
              description="غرفه‌های فصلی بین دو برداشت خالی می‌شوند. می‌توانید غرفه‌های دیگر را ببینید."
              action={<Button to="/storefronts" variant="secondary" size="sm">غرفه‌های دیگر</Button>}
            />
          </div>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing: MarketplaceListing) => (
              <li key={listing.id}>
                <Link
                  to={`/listing/${listing.slug}`}
                  className="group flex h-full gap-3 rounded-lg border border-line bg-paper p-3 transition-[border-color,box-shadow] duration-[var(--dur-state)] ease-[var(--ease-out)] hover:border-brand-300 hover:shadow-[var(--shadow-card)] dark:border-night-line dark:bg-night-soft dark:hover:border-brand-700"
                >
                  <span className="h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-brand-50 dark:bg-night">
                    {listing.image_url && (
                      <img
                        src={listing.image_url}
                        alt=""
                        width={80}
                        height={80}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-[var(--dur-image)] ease-[var(--ease-out)] group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-extrabold text-ink dark:text-white">{listing.title}</span>
                    <span className="mt-0.5 block text-2xs text-ink-mute dark:text-white/45">
                      {listing.crop_name || listing.category_label} · {listing.quantity_available} {listing.unit} موجود
                    </span>
                    <span className="dateline mt-1.5 block text-xs font-extrabold text-brand-800 dark:text-brand-300">
                      {money(listing.discounted_price)}
                      <span className="font-medium text-ink-mute dark:text-white/45"> / {listing.unit}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
