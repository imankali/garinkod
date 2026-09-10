// frontend/src/components/home/StorefrontAds.tsx
//
// «آگهی‌های غرفه‌داران» on the home page.
//
// It sits directly under مجله کشاورزی by design: a visitor who has read that far
// has shown interest in the site itself, and this is the section that answers
// «پس چه چیزی می‌توانم همین امروز بخرم». The rows are curated by the API, not by
// the browser — «پرفروش‌ترین» sorted from the newest page would be a lie, and
// sorting only the first page ranks "the first 24 rows", not the best sellers.
//
// The discount row is the one place a card wears its watermark instead of a badge
// list, which is exactly the rule the marketplace page uses; the same card
// component enforces it on both pages.
//
// A row that comes back empty removes itself. A heading over nothing reads as a
// broken page rather than as "there is nothing here yet".

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Flame, Sparkles, TrendingUp } from 'lucide-react';

import { agricultureApi } from '../../api/services';
import MarketplaceListingCard from '../MarketplaceListingCard';
import SkeletonCard from '../ui/SkeletonCard';
import { useTranslation } from '../../i18n';
import { cn } from '../../utils/cn';
import type { MarketplaceListing } from '@/types/storefront';

/** Five per row, matching the storefronts page's curated sections. */
const RAIL_SIZE = 5;

interface Rail {
  key: string;
  title: string;
  icon: typeof Flame;
  tone: string;
  /** Passed straight to the listing endpoint, so sorting is the server's job. */
  params: Record<string, string>;
  variant: 'default' | 'discount';
}

const RAILS: Rail[] = [
  {
    key: 'bestsellers',
    title: 'پرفروش‌ترین محصولات غرفه‌ها',
    icon: TrendingUp,
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
    params: { ordering: '-sales_count' },
    variant: 'default',
  },
  {
    key: 'discounted',
    title: 'پرتخفیف‌ترین محصولات غرفه‌ها',
    icon: Sparkles,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
    params: { ordering: '-discount_percent', has_discount: '1' },
    variant: 'discount',
  },
  {
    key: 'newest',
    title: 'جدیدترین آگهی‌ها',
    icon: Flame,
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
    params: { ordering: '-created_at' },
    variant: 'default',
  },
];

export default function StorefrontAds() {
  return (
    <section className="page-shell space-y-6 py-8" aria-label="آگهی‌های غرفه‌داران">
      {RAILS.map((rail) => (
        <AdRail key={rail.key} rail={rail} />
      ))}
    </section>
  );
}

function AdRail({ rail }: { rail: Rail }) {
  const { t } = useTranslation();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    agricultureApi
      .listMarketplace({ page: 1, page_size: RAIL_SIZE, in_stock: '1', ...rail.params })
      .then((response) => {
        if (!cancelled) setListings(response.data.results || []);
      })
      .catch(() => {
        if (!cancelled) setListings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the ordering and the discount flag, not on the object identity:
    // a rail that re-fetched on every parent render would jitter while someone
    // is mid-swipe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rail.key, rail.params.ordering, rail.params.has_discount]);

  if (!loading && listings.length === 0) return null;

  const Icon = rail.icon;

  return (
    <div aria-label={rail.title}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-fluid-lg font-extrabold text-slate-800 dark:text-white">
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', rail.tone)}>
            <Icon size={17} aria-hidden="true" />
          </span>
          {rail.title}
        </h2>
        <Link
          to={`/products?source=marketplace&ordering=${encodeURIComponent(rail.params.ordering || '')}`}
          className="flex min-h-11 items-center gap-1 text-fluid-xs font-bold text-emerald-700 hover:underline dark:text-lime-300"
        >
          {t('common.viewAll')}
          <ArrowLeft size={13} aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: RAIL_SIZE }).map((_, index) => (
            <li key={index} aria-label={t('common.loading')}>
              <SkeletonCard variant="listing" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {listings.map((listing, index) => (
            <li key={listing.id}>
              <MarketplaceListingCard listing={listing} index={index} variant={rail.variant} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
