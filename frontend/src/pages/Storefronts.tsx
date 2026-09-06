// frontend/src/pages/Storefronts.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, MapPin, Search, SlidersHorizontal, Sparkles, Star, Store, TrendingUp, Users, X } from 'lucide-react';

import { agricultureApi, locationsApi, storefrontsApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useUrlFilters } from '../hooks/useUrlFilters';
import MarketplaceListingCard from '../components/MarketplaceListingCard';
import { useTranslation } from '../i18n';
import { cn } from '../utils/cn';
import type { Location, MarketplaceListing, Storefront } from '../types';

const DEFAULT_FILTERS = {
  search: '',
  province: '',
  city: '',
  seller_type: '',
  verified: '',
  has_listings: '',
  ordering: 'popular',
  page: '1',
};

const SELLER_TYPES = [
  { value: '', label: 'همه فروشندگان' },
  { value: 'farmer', label: 'کشاورز' },
  { value: 'cooperative', label: 'تعاونی' },
  { value: 'merchant', label: 'تاجر' },
  { value: 'company', label: 'شرکت' },
];

const ORDERINGS = [
  { value: 'popular', label: 'محبوب‌ترین' },
  { value: 'newest', label: 'جدیدترین' },
  { value: 'sales', label: 'پرفروش‌ترین' },
  { value: 'rating', label: 'بیشترین امتیاز' },
  { value: 'listings', label: 'بیشترین آگهی' },
  { value: 'name', label: 'ترتیب الفبا' },
];

const PAGE_SIZE = 12;

/**
 * The curated product rows, each rendered as its own titled section with its
 * own five listings. They were tabs before, so reaching the discounted
 * products meant hiding the best sellers; stacking them shows everything in
 * one scroll.
 */
const LISTING_SECTIONS: {
  id: string;
  icon: typeof Store;
  labelKey: string;
  ordering: string;
  onlyDiscounted?: boolean;
  tone: string;
}[] = [
  {
    id: 'bestsellers',
    icon: TrendingUp,
    labelKey: 'storefronts.tab.bestSellers',
    ordering: '-sales_count',
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
  },
  {
    id: 'discounted',
    icon: Sparkles,
    labelKey: 'storefronts.tab.discounted',
    ordering: '-discount_percent',
    onlyDiscounted: true,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
  },
];

/** Each curated row shows five listings. */
const SECTION_SIZE = 5;

/** The full, filterable directory of storefronts, plus the sellers' best-selling
 *  and most-discounted products. */
export default function Storefronts() {
  const { t } = useTranslation();
  const { filters, setFilter, setFilters, resetFilters, activeCount } = useUrlFilters(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);

  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [provinces, setProvinces] = useState<Location[]>([]);
  const [cities, setCities] = useState<Location[]>([]);

  // Push the debounced text into the URL so the address always reflects the
  // query that produced the visible results.
  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilter('search', debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    locationsApi
      .provinces()
      .then((response) => setProvinces(response.data.results))
      .catch(() => setProvinces([]));
  }, []);

  useEffect(() => {
    if (!filters.province) {
      setCities([]);
      return;
    }
    locationsApi
      .cities(filters.province)
      .then((response) => setCities(response.data.results))
      .catch(() => setCities([]));
  }, [filters.province]);

  const fetchStorefronts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await storefrontsApi.list({
        search: filters.search || undefined,
        province: filters.province || undefined,
        city: filters.city || undefined,
        seller_type: filters.seller_type || undefined,
        verified: filters.verified || undefined,
        has_listings: filters.has_listings || undefined,
        ordering: filters.ordering,
        page: Number(filters.page) || 1,
        page_size: PAGE_SIZE,
      });
      setStorefronts(response.data.results);
      setCount(response.data.count);
    } catch (caught) {
      setError(parseApiError(caught).message);
      setStorefronts([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchStorefronts();
  }, [fetchStorefronts]);

  const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);
  const currentPage = Number(filters.page) || 1;

  const provinceOptions = useMemo(
    () => provinces.map((item) => item.name).sort((a, b) => a.localeCompare(b, 'fa')),
    [provinces],
  );

  return (
    <div className="mx-auto max-w-6xl px-[var(--page-gutter)] py-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800 dark:text-white">
          <Store size={22} className="text-emerald-600" />
          {t('storefronts.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-emerald-200">
          {t('storefronts.subtitle')}
        </p>

      </header>

      {/* Curated listing rows, one section each. */}
      <div className="mb-8 space-y-8">
        {LISTING_SECTIONS.map((item) => (
          <ListingSection
            key={item.id}
            id={item.id}
            icon={item.icon}
            title={t(item.labelKey)}
            tone={item.tone}
            ordering={item.ordering}
            onlyDiscounted={item.onlyDiscounted}
          />
        ))}
      </div>

      {/* The full storefront directory, with search and filters. */}
      <h2 className="mb-3 text-fluid-lg font-extrabold text-slate-800 dark:text-white">
        {t('storefronts.tab.stores')}
      </h2>
      {/* Sticks below the header, not under it — top-0 put this bar behind the
          sticky header on every scroll. */}
      <div
        className="sticky z-20 -mx-[var(--page-gutter)] mb-4 bg-white/95 px-[var(--page-gutter)] py-3 backdrop-blur dark:bg-emerald-950/95"
        style={{ top: 'var(--header-height)' }}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="جستجوی نام غرفه، شهر یا توضیحات…"
              aria-label="جستجوی غرفه"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((previous) => !previous)}
            aria-expanded={showFilters}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 dark:border-emerald-800 dark:text-emerald-100"
          >
            <SlidersHorizontal size={15} />
            فیلتر
            {activeCount > 0 && (
              <span className="rounded-full bg-emerald-600 px-1.5 text-fluid-2xs text-white">{activeCount}</span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/60 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="استان"
              value={filters.province}
              onChange={(value) => setFilters({ province: value, city: '' })}
              options={[{ value: '', label: 'همه استان‌ها' }, ...provinceOptions.map((name) => ({ value: name, label: name }))]}
            />
            <FilterSelect
              label="شهر"
              value={filters.city}
              disabled={!filters.province}
              onChange={(value) => setFilter('city', value)}
              options={[
                { value: '', label: filters.province ? 'همه شهرها' : 'ابتدا استان' },
                ...cities.map((item) => ({ value: item.name, label: item.name })),
              ]}
            />
            <FilterSelect
              label="نوع فروشنده"
              value={filters.seller_type}
              onChange={(value) => setFilter('seller_type', value)}
              options={SELLER_TYPES}
            />
            <FilterSelect
              label="مرتب‌سازی"
              value={filters.ordering}
              onChange={(value) => setFilter('ordering', value)}
              options={ORDERINGS}
            />

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-emerald-100">
              <input
                type="checkbox"
                checked={filters.verified === '1'}
                onChange={(event) => setFilter('verified', event.target.checked ? '1' : '')}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              فقط غرفه‌های تأییدشده
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-emerald-100">
              <input
                type="checkbox"
                checked={filters.has_listings === '1'}
                onChange={(event) => setFilter('has_listings', event.target.checked ? '1' : '')}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              فقط غرفه‌های دارای آگهی
            </label>

            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  resetFilters();
                  setSearchInput('');
                }}
                className="flex items-center justify-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 dark:border-rose-800"
              >
                <X size={13} /> پاک کردن فیلترها
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <p role="status" aria-live="polite" className="py-12 text-center text-sm text-slate-500">
          در حال بارگذاری غرفه‌ها…
        </p>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center dark:border-rose-800 dark:bg-rose-950/30">
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => void fetchStorefronts()}
            className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"
          >
            تلاش دوباره
          </button>
        </div>
      ) : storefronts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-emerald-800">
          غرفه‌ای با این مشخصات پیدا نشد.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-500 dark:text-emerald-200">{count} غرفه پیدا شد</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {storefronts.map((storefront) => (
              <li key={storefront.id}>
                <StorefrontCard storefront={storefront} />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav aria-label="صفحه‌بندی غرفه‌ها" className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setFilter('page', String(currentPage - 1))}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40 dark:border-emerald-800 dark:text-emerald-100"
              >
                قبلی
              </button>
              <span className="text-sm text-slate-500 dark:text-emerald-200">
                صفحه {currentPage} از {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setFilter('page', String(currentPage + 1))}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40 dark:border-emerald-800 dark:text-emerald-100"
              >
                بعدی
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

/**
 * One curated row of seller listings: a heading plus its own five products.
 *
 * A row that comes back empty removes itself — a heading over nothing reads
 * as a broken page rather than as "no results".
 */
function ListingSection({
  id,
  icon: Icon,
  title,
  tone,
  ordering,
  onlyDiscounted,
}: {
  id: string;
  icon: typeof Store;
  title: string;
  tone: string;
  ordering: string;
  onlyDiscounted?: boolean;
}) {
  const { t } = useTranslation();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    agricultureApi
      .listMarketplace({ ordering, page: 1, page_size: 24, in_stock: '1' })
      .then((response) => {
        if (cancelled) return;
        const rows = (response.data.results || [])
          .filter((listing) => !onlyDiscounted || listing.discount_percent > 0)
          .slice(0, SECTION_SIZE);
        setListings(rows);
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
  }, [ordering, onlyDiscounted]);

  if (!loading && listings.length === 0) return null;

  return (
    <section aria-labelledby={`storefront-section-${id}`}>
      <h2
        id={`storefront-section-${id}`}
        className="mb-3 flex items-center gap-2 text-fluid-lg font-extrabold text-slate-800 dark:text-white"
      >
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone)}>
          <Icon size={17} aria-hidden="true" />
        </span>
        {title}
      </h2>

      {loading ? (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: SECTION_SIZE }).map((_, index) => (
            <li
              key={index}
              className="h-64 animate-pulse rounded-2xl bg-emerald-100/60 dark:bg-emerald-900/40"
              aria-label={t('common.loading')}
            />
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {listings.map((listing, index) => (
            <li key={listing.id}>
              <MarketplaceListingCard listing={listing} index={index} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-fluid-xs font-bold text-slate-500 dark:text-emerald-200">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A storefront summary card, reused by the directory and the home page. */
export function StorefrontCard({ storefront }: { storefront: Storefront }) {
  return (
    <Link
      to={`/storefronts/${storefront.slug}`}
      className="block h-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950/40"
    >
      <div className="flex items-center gap-3">
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900">
          {storefront.avatar_url ? (
            <img src={storefront.avatar_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-extrabold text-emerald-700 dark:text-lime-300">
              {storefront.name.slice(0, 2)}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex min-w-0 items-center gap-1 text-sm font-extrabold text-slate-800 dark:text-white">
            <span className="truncate">{storefront.name}</span>
            {storefront.is_verified && <BadgeCheck size={14} className="shrink-0 text-emerald-500" />}
          </h3>
          <p className="mt-0.5 truncate text-fluid-xs text-slate-500 dark:text-emerald-200">
            {storefront.seller_type_label}
            {storefront.city && (
              <>
                {' · '}
                <MapPin size={10} className="inline" /> {storefront.city}
              </>
            )}
          </p>
        </div>
      </div>

      <dl className="mt-3 flex items-center gap-3 text-fluid-xs text-slate-500 dark:text-emerald-200">
        <span className="flex items-center gap-1">
          <Store size={12} /> {storefront.listing_count} آگهی
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} /> {storefront.followers_count}
        </span>
        {Number(storefront.rating) > 0 && (
          <span className="flex items-center gap-1">
            <Star size={12} className="text-amber-400" /> {storefront.rating}
          </span>
        )}
      </dl>
    </Link>
  );
}
