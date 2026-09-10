// frontend/src/pages/Storefronts.tsx
//
// غرفه‌داران — the marketplace, in one page.
//
// This page and بازار کشاورزان (/marketplace) were the same catalogue seen from
// two URLs, with two heroes, two filter sets and two card grids; a buyer who
// wanted "what are the farmers selling" had to know which page they were on. The
// marketplace is merged in here and /marketplace only redirects.
//
// The order is the order a visitor actually decides in:
//
// 1. what this place is, and the one action that joins it (ساخت غرفه);
// 2. who is already here (غرفه‌های پیشنهادی, with follow);
// 3. what they have been saying this week (پست‌های غرفه‌داران, by likes);
// 4. what they are selling right now (پرفروش‌ترین، پرتخفیف‌ترین، جدیدترین);
// 5. the whole directory, searchable and filterable.
//
// The identity rules for opening a stall — a full name and a national code —
// live in the shared ساخت غرفه form, which this page opens in a dialog and the
// studio redirects to.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Search, SlidersHorizontal, Sparkles,
  Store, TrendingUp, UserPlus, X, Flame,
} from 'lucide-react';

import { agricultureApi, locationsApi, storefrontPostsApi, storefrontsApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { useAuthStore } from '../store/authStore';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useUrlFilters } from '../hooks/useUrlFilters';
import MarketplaceListingCard from '../components/MarketplaceListingCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import StorefrontCard from '../components/StorefrontCard';
import StorefrontForm from '../components/storefront/StorefrontForm';
import PostCard from '../components/social/PostCard';
import { useTranslation } from '../i18n';
import { cn } from '../utils/cn';
import type { MarketplaceListing, Storefront, StorefrontPost } from '@/types/storefront';
import type { Location } from '@/types/farming';

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
/** Each product row shows five listings, like the catalogue's curated rows. */
const SECTION_SIZE = 5;

/**
 * The sellers' product rows, stacked rather than tabbed.
 *
 * «پرتخفیف‌ترین» asks the API for the discount flag instead of filtering the
 * first page in the browser: a seller's ۳۰٪ off is not something a client-side
 * filter can find if the query that produced the page never knew about it.
 */
/**
 * Every row asks for in-stock ads only, and the home page's rails use the same
 * rule: a «پرتخفیف‌ترین» row full of sold-out bags is a row of dead links, and a
 * buyer learns to ignore the section instead of using it.
 */
const LISTING_SECTIONS: Array<{
  id: string;
  icon: typeof Store;
  title: string;
  ordering: string;
  params: Record<string, string>;
  tone: string;
}> = [
  {
    id: 'bestsellers',
    icon: TrendingUp,
    title: 'پرفروش‌ترین محصولات',
    ordering: '-sales_count',
    params: { ordering: '-sales_count', in_stock: '1' },
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
  },
  {
    id: 'discounted',
    icon: Sparkles,
    title: 'پرتخفیف‌ترین محصولات',
    ordering: '-discount_percent',
    params: { ordering: '-discount_percent', has_discount: '1', in_stock: '1' },
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
  },
  {
    id: 'newest',
    icon: Flame,
    title: 'جدیدترین‌ها',
    ordering: '-created_at',
    params: { ordering: '-created_at', in_stock: '1' },
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
  },
];

export default function Storefronts() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { filters, setFilter, setFilters, resetFilters, activeCount } = useUrlFilters(DEFAULT_FILTERS);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);

  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [featured, setFeatured] = useState<Storefront[]>([]);
  const [posts, setPosts] = useState<StorefrontPost[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  /** The dialog opens on the hero button, or from /studio?create=1. */
  const [creating, setCreating] = useState(searchParams.get('create') === '1');

  const [provinces, setProvinces] = useState<Location[]>([]);
  const [cities, setCities] = useState<Location[]>([]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilter('search', debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // The seller's own stall decides what the hero button does: build one, or open
  // the one you already have. Only this one request needs a session — asking
  // while signed out just collects a 401.
  useEffect(() => {
    if (!isAuthenticated) {
      setStorefront(null);
      return;
    }
    agricultureApi
      .getStorefront()
      .then((response) => setStorefront(response.data || null))
      .catch(() => setStorefront(null));
  }, [isAuthenticated]);

  // Everything else on this page is public, and must load for a visitor too: the
  // suggested stalls, the posts, the province list the filters are built from.
  useEffect(() => {
    locationsApi
      .provinces()
      .then((response) => setProvinces(response.data.results))
      .catch(() => setProvinces([]));
    storefrontsApi
      .featured(8)
      .then((response) => setFeatured(response.data))
      .catch(() => setFeatured([]));
    // Top five by likes, server-side: the first page of newest is not the most
    // liked list, and a client can only rank what it was given.
    storefrontPostsApi
      .list({ post_type: 'post', ordering: '-likes_total', page_size: 5 })
      .then((response) => setPosts(response.data.results))
      .catch(() => setPosts([]));
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

  function closeCreate() {
    setCreating(false);
    if (searchParams.get('create')) {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.delete('create');
        return next;
      }, { replace: true });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-[var(--page-gutter)] py-6">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-800 via-emerald-700 to-lime-600 p-6 text-white shadow-xl shadow-emerald-900/15 sm:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="min-w-0">
            <h1 className="text-fluid-2xl font-extrabold">بازار مستقیم کشاورزی</h1>
            <p className="mt-2 max-w-xl text-fluid-sm leading-7 text-emerald-50">
              غرفه کشاورزان، تعاونی‌ها و تأمین‌کنندگان — بدون واسطه، با قیمت درب مزرعه.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {storefront ? (
              <Link
                to={`/storefronts/${storefront.slug}`}
                className="flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-4 text-fluid-sm font-extrabold text-emerald-800 transition hover:bg-lime-100"
              >
                <Store size={16} aria-hidden="true" />
                غرفه من
              </Link>
            ) : (
              <motion.button
                type="button"
                whileHover={reduceMotion ? undefined : { y: -3 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                onClick={() => setCreating(true)}
                className="flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-4 text-fluid-sm font-extrabold text-emerald-800 transition hover:bg-lime-100"
              >
                <UserPlus size={16} aria-hidden="true" />
                ساخت غرفه
              </motion.button>
            )}
            <Link
              to="/products?source=marketplace"
              className="flex min-h-11 items-center gap-1 rounded-xl border border-white/40 px-3 text-fluid-xs font-bold text-white transition hover:bg-white/10"
            >
              همه آگهی‌ها با فیلتر
              <ArrowLeft size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Suggested stalls */}
      {featured.length > 0 && (
        <section className="mt-8" aria-labelledby="featured-stores-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="featured-stores-heading" className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">
              غرفه‌های پیشنهادی
            </h2>
            {/* A plain anchor: this is a jump within the page, not a route. */}
            <a
              href="#directory"
              className="flex min-h-11 items-center gap-1 text-fluid-xs font-bold text-emerald-700 hover:underline dark:text-lime-300"
            >
              جست‌وجوی همه غرفه‌ها
              <ArrowLeft size={13} aria-hidden="true" />
            </a>
          </div>
          <ul className="mt-3 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((item) => (
              <li key={item.id}>
                <StorefrontCard storefront={item} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sellers' posts, ranked by likes, with the Explore page behind them */}
      {posts.length > 0 && (
        <section className="mt-8" aria-labelledby="store-posts-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="store-posts-heading" className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">
              پست‌های غرفه‌داران
            </h2>
            <Link
              to="/explore"
              className="flex min-h-11 items-center gap-1 text-fluid-xs font-bold text-emerald-700 hover:underline dark:text-lime-300"
            >
              مشاهده پست‌های بیشتر
              <ArrowLeft size={13} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Sellers' products */}
      <div className="mt-8 space-y-8">
        {LISTING_SECTIONS.map((item) => (
          <ListingSection
            key={item.id}
            id={item.id}
            icon={item.icon}
            title={item.title}
            tone={item.tone}
            params={item.params}
          />
        ))}
      </div>

      {/* The directory */}
      <div id="directory" className="mt-10 scroll-mt-28">
        <h2 className="mb-3 text-fluid-lg font-extrabold text-slate-800 dark:text-white">
          همه غرفه‌داران
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
                className="w-full min-h-11 rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((previous) => !previous)}
              aria-expanded={showFilters}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 dark:border-emerald-800 dark:text-emerald-100"
            >
              <SlidersHorizontal size={15} />
              فیلتر
              {activeCount > 0 && (
                <span className="rounded-full bg-emerald-600 px-1.5 text-fluid-2xs text-white">
                  {activeCount.toLocaleString('fa-IR')}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            // A named group, because the page is not the only thing on the site
            // with a «استان» select — the weather strip has one too, and a label
            // that resolves to two controls is a label nobody can rely on.
            <div
              role="group"
              aria-label="فیلترهای غرفه‌ها"
              className="mt-3 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/60 sm:grid-cols-2 lg:grid-cols-4"
            >
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
                  className="flex items-center justify-center gap-1 rounded-xl border border-rose-200 px-3 min-h-11 text-xs font-bold text-rose-600 dark:border-rose-800"
                >
                  <X size={13} /> پاک کردن فیلترها
                </button>
              )}
            </div>
          )}
        </div>

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
              className="mt-3 min-h-11 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white"
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
            <p className="mb-3 text-xs font-bold text-slate-500 dark:text-emerald-200">
              {count.toLocaleString('fa-IR')} غرفه پیدا شد
            </p>
            <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {storefronts.map((item) => (
                <li key={item.id}>
                  <StorefrontCard storefront={item} />
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <nav aria-label="صفحه‌بندی غرفه‌ها" className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setFilter('page', String(currentPage - 1))}
                  className="flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm font-bold disabled:opacity-40 dark:border-emerald-800 dark:text-emerald-100"
                >
                  <ChevronRight size={15} aria-hidden="true" />
                  قبلی
                </button>
                <span className="text-sm text-slate-500 dark:text-emerald-200">
                  صفحه {currentPage.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setFilter('page', String(currentPage + 1))}
                  className="flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm font-bold disabled:opacity-40 dark:border-emerald-800 dark:text-emerald-100"
                >
                  بعدی
                  <ChevronLeft size={15} aria-hidden="true" />
                </button>
              </nav>
            )}
          </>
        )}
      </div>

      {/* ساخت غرفه */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-emerald-950/50 p-3 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="ساخت غرفه"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeCreate();
            }}
          >
            <motion.div
              initial={reduceMotion ? false : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduceMotion ? undefined : { y: 40, opacity: 0 }}
              className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl dark:border-emerald-800 dark:bg-emerald-950 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <StorefrontForm
                  variant="dialog"
                  onCreated={(created) => {
                    closeCreate();
                    setStorefront(created);
                    void fetchStorefronts();
                    navigate(`/storefronts/${created.slug}`);
                  }}
                />
                <button
                  type="button"
                  onClick={closeCreate}
                  aria-label="بستن"
                  className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-emerald-900"
                >
                  <X size={17} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


/**
 * One curated row of seller listings: a heading plus its own five products.
 *
 * A row that comes back empty removes itself — a heading over nothing reads as a
 * broken page rather than as «نتیجه‌ای نیست».
 */
function ListingSection({
  id,
  icon: Icon,
  title,
  tone,
  params,
}: {
  id: string;
  icon: typeof Store;
  title: string;
  tone: string;
  params: Record<string, string>;
}) {
  const { t } = useTranslation();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    agricultureApi
      .listMarketplace({ page: 1, page_size: SECTION_SIZE, ...params })
      .then((response) => {
        if (cancelled) return;
        setListings(response.data.results || []);
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
  }, [params]);

  if (!loading && listings.length === 0) return null;

  return (
    <section aria-labelledby={`storefront-section-${id}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id={`storefront-section-${id}`}
          className="flex items-center gap-2 text-fluid-lg font-extrabold text-slate-800 dark:text-white"
        >
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone)}>
            <Icon size={17} aria-hidden="true" />
          </span>
          {title}
        </h2>
        <Link
          to={`/products?source=marketplace&ordering=${params.ordering}`}
          className="flex min-h-11 items-center gap-1 text-fluid-xs font-bold text-emerald-700 hover:underline dark:text-lime-300"
        >
          {t('common.viewAll')}
          <ArrowLeft size={13} aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: SECTION_SIZE }).map((_, index) => (
            <li key={index} aria-label={t('common.loading')}>
              <SkeletonCard variant="listing" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {listings.map((listing, index) => (
            <li key={listing.id}>
              <MarketplaceListingCard
                listing={listing}
                index={index}
                // پرتخفیف‌ترین‌ها gets the discount watermark and nothing else.
                variant={id === 'discounted' ? 'discount' : 'default'}
              />
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
        className="w-full min-h-11 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
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
