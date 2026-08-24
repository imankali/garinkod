// frontend/src/pages/Marketplace.tsx

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Search,
  SlidersHorizontal,
  Store,
  Tractor,
  UserRoundPlus,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { agricultureApi, storefrontPostsApi, storefrontsApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useUrlFilters } from '../hooks/useUrlFilters';
import LocationPicker from '../components/LocationPicker';
import { StorefrontCard } from './Storefronts';
import type {
  MarketplaceListing,
  SellerType,
  Storefront,
  StorefrontAvailability,
  StorefrontPost,
} from '../types';
import { formatPrice } from '../utils/formatPrice';

const DEFAULT_FILTERS = {
  search: '',
  province: '',
  city: '',
  seller_type: '',
  crop: '',
  min_price: '',
  max_price: '',
  in_stock: '',
  verified: '',
  ordering: '-created_at',
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
  { value: '-created_at', label: 'جدیدترین' },
  { value: 'price', label: 'ارزان‌ترین' },
  { value: '-price', label: 'گران‌ترین' },
  { value: '-quantity_available', label: 'بیشترین موجودی' },
  { value: 'harvest_date', label: 'نزدیک‌ترین برداشت' },
];

const PAGE_SIZE = 12;

export default function Marketplace() {
  const { isAuthenticated } = useAuthStore();
  const { filters, setFilter, setFilters, resetFilters, activeCount } = useUrlFilters(DEFAULT_FILTERS);

  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [showFilters, setShowFilters] = useState(false);
  const [showStoreForm, setShowStoreForm] = useState(false);

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [stories, setStories] = useState<StorefrontPost[]>([]);
  const [featured, setFeatured] = useState<Storefront[]>([]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilter('search', debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const response = await agricultureApi.listMarketplace({
        search: filters.search || undefined,
        province: filters.province || undefined,
        city: filters.city || undefined,
        seller_type: filters.seller_type || undefined,
        crop: filters.crop || undefined,
        min_price: filters.min_price || undefined,
        max_price: filters.max_price || undefined,
        in_stock: filters.in_stock || undefined,
        verified: filters.verified || undefined,
        ordering: filters.ordering,
        page: Number(filters.page) || 1,
        page_size: PAGE_SIZE,
      });
      setListings(response.data.results);
      setCount(response.data.count);
    } catch (error) {
      setListError(parseApiError(error).message);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    storefrontPostsApi
      .list({ post_type: 'story' })
      .then((response) => setStories(response.data.results))
      .catch(() => setStories([]));
    storefrontsApi
      .featured(5)
      .then((response) => setFeatured(response.data))
      .catch(() => setFeatured([]));
  }, []);

  const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);
  const currentPage = Number(filters.page) || 1;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Hero */}
      <section className="rounded-3xl bg-gradient-to-l from-emerald-800 via-emerald-700 to-lime-600 p-6 text-white md:p-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold text-lime-200">بازار مستقیم کشاورزی</p>
            <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">
              غرفه کشاورزان، تعاونی‌ها و تأمین‌کنندگان
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50">
              هر آگهی پیش از انتشار بررسی می‌شود تا بازاری قابل اعتماد و شفاف برای خرید عمده شکل بگیرد.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowStoreForm((value) => !value)}
            aria-expanded={showStoreForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-emerald-700"
          >
            <UserRoundPlus size={18} />
            ساخت غرفه
          </button>
        </div>
      </section>

      {/* Live stories */}
      {stories.length > 0 && (
        <section className="mt-6" aria-label="استوری غرفه‌ها">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stories.map((story) => (
              <Link
                key={story.id}
                to={`/storefronts/${story.storefront_slug}`}
                className="w-40 shrink-0 overflow-hidden rounded-2xl border border-violet-200 bg-white dark:border-violet-900 dark:bg-emerald-950"
              >
                <img
                  src={story.image_url}
                  alt=""
                  loading="lazy"
                  className="h-32 w-full object-cover"
                />
                <div className="p-3">
                  <p className="truncate text-xs font-bold text-violet-700 dark:text-violet-200">
                    {story.storefront_name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-600 dark:text-emerald-100">
                    {story.caption}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {showStoreForm && (
        <StorefrontForm
          isAuthenticated={isAuthenticated}
          onCreated={() => {
            setShowStoreForm(false);
            void fetchListings();
          }}
        />
      )}

      {/* Featured storefronts */}
      {featured.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">غرفه‌های پیشنهادی</h2>
            <Link to="/storefronts" className="text-xs font-bold text-emerald-700 underline dark:text-lime-300">
              مشاهده همه غرفه‌داران
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {featured.map((storefront) => (
              <li key={storefront.id}>
                <StorefrontCard storefront={storefront} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Listings with server-side filters */}
      <section className="mt-8">
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">آگهی‌های بازار</h2>

        <div className="sticky top-0 z-10 mt-3 bg-white/95 py-2 backdrop-blur dark:bg-emerald-950/95">
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
                placeholder="جستجوی محصول، غرفه یا نوع کشت"
                aria-label="جستجوی آگهی"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 dark:border-emerald-800 dark:text-emerald-100"
            >
              <SlidersHorizontal size={15} />
              فیلتر
              {activeCount > 0 && (
                <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] text-white">{activeCount}</span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/60 sm:grid-cols-2 lg:grid-cols-4">
              <LocationPicker
                idPrefix="marketplace"
                province={filters.province}
                city={filters.city}
                onProvinceChange={(value) => setFilters({ province: value, city: '' })}
                onCityChange={(value) => setFilter('city', value)}
              />

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-emerald-200">
                  نوع فروشنده
                </span>
                <select
                  value={filters.seller_type}
                  onChange={(event) => setFilter('seller_type', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
                >
                  {SELLER_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-emerald-200">
                  مرتب‌سازی
                </span>
                <select
                  value={filters.ordering}
                  onChange={(event) => setFilter('ordering', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
                >
                  {ORDERINGS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-emerald-200">
                  حداقل قیمت (تومان)
                </span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={filters.min_price}
                  onChange={(event) => setFilter('min_price', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-emerald-200">
                  حداکثر قیمت (تومان)
                </span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={filters.max_price}
                  onChange={(event) => setFilter('max_price', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
                />
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-emerald-100">
                <input
                  type="checkbox"
                  checked={filters.in_stock === '1'}
                  onChange={(event) => setFilter('in_stock', event.target.checked ? '1' : '')}
                  className="h-4 w-4 rounded accent-emerald-600"
                />
                فقط آگهی‌های موجود
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-emerald-100">
                <input
                  type="checkbox"
                  checked={filters.verified === '1'}
                  onChange={(event) => setFilter('verified', event.target.checked ? '1' : '')}
                  className="h-4 w-4 rounded accent-emerald-600"
                />
                فقط غرفه‌های تأییدشده
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

        {loading ? (
          <p role="status" aria-live="polite" className="mt-6 text-sm text-slate-500">
            در حال دریافت آگهی‌ها…
          </p>
        ) : listError ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center dark:border-rose-800 dark:bg-rose-950/30">
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{listError}</p>
            <button
              type="button"
              onClick={() => void fetchListings()}
              className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"
            >
              تلاش دوباره
            </button>
          </div>
        ) : listings.length > 0 ? (
          <>
            <p className="mt-3 text-xs text-slate-500 dark:text-emerald-200">{count} آگهی پیدا شد</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav aria-label="صفحه‌بندی آگهی‌ها" className="mt-6 flex items-center justify-center gap-2">
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
        ) : (
          <div className="mt-5 rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/60 p-10 text-center dark:border-emerald-800 dark:bg-emerald-900/30">
            <Tractor className="mx-auto text-emerald-600" size={38} />
            <h3 className="mt-3 font-extrabold text-slate-800 dark:text-white">
              آگهی‌ای با این مشخصات پیدا نشد
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">
              فیلترها را تغییر دهید یا محصول خود را برای خرید عمده ثبت کنید.
            </p>
            <Link
              to="/farmer-sell"
              className="mt-5 inline-block text-sm font-bold text-emerald-700 underline dark:text-lime-300"
            >
              ثبت درخواست فروش محصول
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

/** A listing card that can actually be bought, respecting the minimum order. */
function ListingCard({ listing }: { listing: MarketplaceListing }) {
  const addListingToCart = useCartStore((state) => state.addListingToCart);
  const [quantity, setQuantity] = useState(String(listing.minimum_order || 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const available = Number(listing.quantity_available);

  async function handleAdd() {
    const value = Number(quantity);
    if (Number.isNaN(value) || value < listing.minimum_order) {
      setError(`حداقل سفارش ${listing.minimum_order} ${listing.unit} است.`);
      return;
    }
    if (value > available) {
      setError(`حداکثر ${available} ${listing.unit} موجود است.`);
      return;
    }
    setError('');
    setBusy(true);
    try {
      await addListingToCart(listing.id, value);
    } catch (caught) {
      setError(parseApiError(caught).fields.quantity ?? parseApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      <img
        src={listing.image_url}
        alt=""
        loading="lazy"
        className="h-40 w-full object-cover"
        onError={(event) => {
          event.currentTarget.src = '/images/hero-farm.jpg';
        }}
      />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-bold text-emerald-700 dark:text-lime-300">{listing.crop_name}</p>
          {listing.storefront.is_verified && <BadgeCheck size={17} className="text-emerald-600" />}
        </div>
        <h3 className="mt-2 font-extrabold text-slate-800 dark:text-white">{listing.title}</h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-slate-500 dark:text-emerald-200">
          {listing.description}
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm dark:border-emerald-900">
          <Link
            to={`/storefronts/${listing.storefront.slug}`}
            className="truncate font-semibold text-slate-600 underline-offset-2 hover:underline dark:text-emerald-100"
          >
            {listing.storefront.name}
          </Link>
          <strong className="whitespace-nowrap text-emerald-700 dark:text-lime-300">
            {formatPrice(listing.price)} / {listing.unit}
          </strong>
        </div>

        <p className="mt-1 text-[11px] text-slate-400">
          موجودی {listing.quantity_available} {listing.unit}
          {listing.minimum_order > 1 && ` · حداقل سفارش ${listing.minimum_order} ${listing.unit}`}
        </p>

        {listing.is_purchasable ? (
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              min={listing.minimum_order}
              max={available}
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              aria-label={`تعداد ${listing.title} بر حسب ${listing.unit}`}
              className="w-20 rounded-xl border border-slate-200 px-2 py-2 text-center text-sm dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? 'در حال افزودن…' : 'افزودن به سبد'}
            </button>
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-slate-100 py-2 text-center text-xs font-bold text-slate-500 dark:bg-emerald-900 dark:text-emerald-200">
            موجودی این آگهی تمام شده است
          </p>
        )}

        {error && (
          <p role="alert" className="mt-2 text-[11px] font-semibold text-rose-600">
            {error}
          </p>
        )}

        <Link
          to={`/support?storefront=${listing.storefront.id}&listing=${listing.id}`}
          className="mt-3 inline-block text-[11px] font-bold text-slate-400 underline hover:text-amber-700 dark:text-emerald-300"
        >
          گزارش مشکل یا شکایت از غرفه
        </Link>
      </div>
    </article>
  );
}

/**
 * Storefront creation with live name/address availability.
 *
 * The check runs as the seller types and is advisory; the server's unique
 * constraints still decide, which is why a failed submit maps the API's field
 * errors back onto the inputs.
 */
function StorefrontForm({
  isAuthenticated,
  onCreated,
}: {
  isAuthenticated: boolean;
  onCreated: () => void;
}) {
  const [store, setStore] = useState({
    name: '',
    slug: '',
    seller_type: 'farmer' as SellerType,
    bio: '',
    province: '',
    city: '',
  });
  const [creating, setCreating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<StorefrontAvailability | null>(null);
  const [checking, setChecking] = useState(false);

  const debouncedName = useDebouncedValue(store.name, 400);
  const debouncedSlug = useDebouncedValue(store.slug, 400);

  useEffect(() => {
    const name = debouncedName.trim();
    const slug = debouncedSlug.trim();
    if (name.length < 3 && !slug) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    agricultureApi
      .checkStorefrontAvailability({ name: name || undefined, slug: slug || undefined })
      .then((response) => {
        if (!cancelled) setAvailability(response.data);
      })
      .catch(() => {
        if (!cancelled) setAvailability(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedName, debouncedSlug]);

  const nameStatus = availability?.name;
  const slugStatus = availability?.slug;

  const canSubmit = useMemo(() => {
    if (!store.name.trim() || !store.province || !store.city) return false;
    if (nameStatus && !nameStatus.available) return false;
    if (store.slug && slugStatus && !slugStatus.available) return false;
    return true;
  }, [store, nameStatus, slugStatus]);

  async function createStore(event: FormEvent) {
    event.preventDefault();
    if (!isAuthenticated) {
      toast.error('برای ساخت غرفه ابتدا وارد حساب کاربری شوید.');
      return;
    }
    setCreating(true);
    setFieldErrors({});
    try {
      await agricultureApi.createStorefront(store);
      toast.success('غرفه شما ساخته شد و می‌توانید آگهی ثبت کنید.');
      onCreated();
    } catch (error) {
      const parsed = parseApiError(error);
      setFieldErrors(parsed.fields);
      if (Object.keys(parsed.fields).length === 0 && !parsed.handled) toast.error(parsed.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <form
      onSubmit={createStore}
      className="mt-6 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"
    >
      <div className="flex items-center gap-2">
        <Store className="text-emerald-600" />
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">ساخت غرفه فروشنده</h2>
      </div>
      <p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">
        پس از ساخت غرفه، آگهی‌ها در وضعیت بررسی قرار می‌گیرند و فقط پس از تأیید منتشر می‌شوند.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="store-name" className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
            نام غرفه <span className="text-rose-500">*</span>
          </label>
          <div className="relative mt-2">
            <input
              id="store-name"
              required
              value={store.name}
              onChange={(event) => setStore({ ...store, name: event.target.value })}
              aria-invalid={Boolean(fieldErrors.name) || nameStatus?.available === false}
              aria-describedby="store-name-status"
              className={`w-full rounded-xl border px-3 py-2.5 pe-9 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-900 ${
                nameStatus?.available === false || fieldErrors.name
                  ? 'border-rose-400'
                  : nameStatus?.available
                    ? 'border-emerald-500'
                    : 'border-slate-200 dark:border-emerald-700'
              }`}
            />
            <span className="absolute end-3 top-1/2 -translate-y-1/2">
              {checking ? (
                <Loader2 size={16} className="animate-spin text-slate-400" />
              ) : nameStatus?.available ? (
                <CheckCircle2 size={16} className="text-emerald-500" />
              ) : nameStatus?.available === false ? (
                <XCircle size={16} className="text-rose-500" />
              ) : null}
            </span>
          </div>
          <p
            id="store-name-status"
            role={nameStatus?.available === false || fieldErrors.name ? 'alert' : 'status'}
            className={`mt-1 text-[11px] font-semibold ${
              nameStatus?.available === false || fieldErrors.name
                ? 'text-rose-600'
                : nameStatus?.available
                  ? 'text-emerald-600'
                  : 'text-slate-400'
            }`}
          >
            {fieldErrors.name ||
              nameStatus?.reason ||
              (nameStatus?.available ? 'این نام آزاد است ✓' : 'حداقل ۳ کاراکتر بنویسید.')}
          </p>
        </div>

        <div>
          <label htmlFor="store-slug" className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
            آدرس یکتا (اختیاری)
          </label>
          <input
            id="store-slug"
            value={store.slug}
            onChange={(event) => setStore({ ...store, slug: event.target.value })}
            placeholder="در صورت خالی بودن، از روی نام ساخته می‌شود"
            aria-invalid={Boolean(fieldErrors.slug) || slugStatus?.available === false}
            aria-describedby="store-slug-status"
            className={`mt-2 w-full rounded-xl border px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-900 ${
              slugStatus?.available === false || fieldErrors.slug
                ? 'border-rose-400'
                : 'border-slate-200 dark:border-emerald-700'
            }`}
          />
          <p
            id="store-slug-status"
            role={slugStatus?.available === false ? 'alert' : 'status'}
            className="mt-1 text-[11px] font-semibold text-slate-400"
          >
            {fieldErrors.slug ||
              (slugStatus?.available === false
                ? `${slugStatus.reason} پیشنهاد: ${slugStatus.suggestion}`
                : slugStatus?.value
                  ? `آدرس غرفه: /storefronts/${slugStatus.value}`
                  : 'می‌توانید خالی بگذارید.')}
          </p>
        </div>

        <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
          نوع فروشنده
          <select
            value={store.seller_type}
            onChange={(event) => setStore({ ...store, seller_type: event.target.value as SellerType })}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal dark:border-emerald-700 dark:bg-emerald-900"
          >
            <option value="farmer">کشاورز</option>
            <option value="cooperative">تعاونی</option>
            <option value="merchant">تاجر</option>
            <option value="company">شرکت</option>
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2 md:col-span-1">
          <LocationPicker
            idPrefix="store"
            required
            province={store.province}
            city={store.city}
            onProvinceChange={(value) => setStore({ ...store, province: value, city: '' })}
            onCityChange={(value) => setStore({ ...store, city: value })}
            provinceError={fieldErrors.province}
            cityError={fieldErrors.city}
          />
        </div>

        <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50 md:col-span-2">
          معرفی کوتاه (اختیاری)
          <textarea
            value={store.bio}
            onChange={(event) => setStore({ ...store, bio: event.target.value })}
            rows={3}
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal dark:border-emerald-700 dark:bg-emerald-900"
          />
        </label>
      </div>

      <button
        disabled={creating || !canSubmit}
        className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {creating ? 'در حال ساخت…' : 'ساخت غرفه'}
      </button>
    </form>
  );
}
