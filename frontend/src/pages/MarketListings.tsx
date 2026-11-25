// frontend/src/pages/MarketListings.tsx
//
// «آگهی‌های کشاورزان» — the marketplace's own listing browser.
//
// Until now the marketplace could only be read one stall at a time: the
// directory lists storefronts, a stall page lists its own آگهی‌ها, and
// `/api/marketplace/listings/` — seven live rows with crop, harvest date,
// quantity and per-unit price — had no caller at all. A buyer who wanted
// «پسته» had to already know which stall sells it.
//
// The rows come from `agricultureApi.listMarketplace`; the chips come from
// `listingFacets`, whose `crops` tally exists precisely for this question. Both
// requests are the server's own numbers, and a crop chip is only offered when
// the facet count says it has something behind it.

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Sprout } from 'lucide-react';

import { agricultureApi } from '../api/services';
import type { MarketplaceListing } from '@/types/storefront';
import { cn } from '../lib/cn';
import { nums } from '../lib/price';
import { useTitle } from '../lib/useTitle';
import PageHead from '../components/shop/PageHead';
import ListingCard from '../components/shop/ListingCard';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';

const PAGE_SIZE = 24;

export default function MarketListings() {
  useTitle('آگهی‌های کشاورزان');
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');

  const crop = params.get('crop') ?? '';
  const subcategory = params.get('subcategory') ?? '';
  const page = Math.max(1, Number(params.get('page') || 1) || 1);

  const listings = useQuery({
    queryKey: ['market-listings', { crop, subcategory, page }],
    queryFn: async () =>
      (await agricultureApi.listMarketplace({
        ...(crop ? { crop } : {}),
        ...(subcategory ? { subcategory } : {}),
        page,
        page_size: PAGE_SIZE,
      })).data,
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // The facets are computed over the whole marketplace, not the current page —
  // the same rule the catalogue follows, or the "count" would just describe
  // what happens to be on screen.
  const facets = useQuery({
    queryKey: ['market-facets'],
    queryFn: async () => (await agricultureApi.listingFacets()).data,
    staleTime: 10 * 60 * 1000,
  });

  const crops = useMemo(() => facets.data?.crops ?? [], [facets.data]);

  const items: MarketplaceListing[] = listings.data?.results ?? [];
  const total = listings.data?.count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function patch(next: Record<string, string | null>) {
    const updated = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') updated.delete(key);
      else updated.set(key, value);
    }
    // A filter change invalidates the page number; keeping it would land the
    // buyer on page 3 of a two-page result.
    if (!('page' in next)) updated.delete('page');
    setParams(updated, { replace: true });
  }

  const activeFilters = [crop, subcategory].filter(Boolean).length;

  return (
    <div className="shell flex flex-col gap-5 py-8">
      <PageHead
        title={crop ? `آگهی‌های ${crop}` : 'آگهی‌های کشاورزان'}
        lead="محصولی که کشاورز یا تعاونی برای فروش گذاشته است — با مقدار موجود، تاریخ برداشت و قیمت هر واحد. خرید از غرفه‌دار یعنی گفتگوی مستقیم با خودش."
        actions={
          <p className="dateline text-2xs font-bold text-ink-mute dark:text-white/45">
            {nums(total)} آگهی
          </p>
        }
      />

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          patch({ crop: search.trim() || null });
        }}
      >
        <label className="flex-1">
          <span className="text-2xs font-bold text-ink-mute dark:text-white/45">محصول</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="مثلاً پسته"
            className="mt-1 h-10 w-full rounded-md border border-line bg-transparent px-3 text-sm text-ink placeholder:text-ink-mute focus:border-brand-500 focus:outline-none dark:border-night-line dark:text-white"
          />
        </label>
        <Button type="submit" size="sm">
          جست‌وجو
        </Button>
        {activeFilters > 0 && (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => {
              setSearch('');
              patch({ crop: null, subcategory: null });
            }}
          >
            پاک کردن فیلترها
          </Button>
        )}
      </form>

      {crops.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs font-bold text-ink-mute dark:text-white/45">محصول:</span>
          {crops.slice(0, 12).map((row) => (
            <button
              key={row.value}
              type="button"
              onClick={() => patch({ crop: crop === row.value ? null : row.value })}
              aria-pressed={crop === row.value}
              className={cn(
                'inline-flex min-h-7 items-center gap-1 rounded-sm border px-2 text-[11px] font-bold',
                crop === row.value
                  ? 'border-brand-600 bg-brand-700 text-white'
                  : 'border-line text-ink-soft hover:border-brand-400 dark:border-night-line dark:text-white/60',
              )}
            >
              {row.label || row.value}
              <span className={cn('dateline', crop === row.value ? 'text-white/70' : 'text-ink-mute')}>
                {nums(row.count)}
              </span>
            </button>
          ))}
        </div>
      )}

      {listings.isLoading ? (
        <CardGridSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="آگهی‌ای با این مشخصات نیست"
          description="می‌توانید فیلترها را بردارید یا از غرفه‌های فعال ببینید چه کسی چه چیزی دارد."
          action={
            <Button to="/storefronts" variant="secondary" size="sm">
              غرفه‌ها
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((listing) => (
              <li key={listing.id}>
                <ListingCard listing={listing} />
              </li>
            ))}
          </ul>

          {lastPage > 1 && (
            <nav aria-label="صفحه‌بندی" className="flex items-center justify-between gap-3 border-t border-line pt-4 dark:border-night-line">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => patch({ page: String(page - 1) })}
              >
                صفحهٔ قبل
              </Button>
              <p className="dateline text-2xs text-ink-mute dark:text-white/45">
                {nums(page)} از {nums(lastPage)}
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= lastPage}
                onClick={() => patch({ page: String(page + 1) })}
              >
                صفحهٔ بعد
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
