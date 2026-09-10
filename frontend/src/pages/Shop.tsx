// frontend/src/pages/Shop.tsx
//
// The catalogue: the site's own products and the storefronts' آگهی‌ها, in two
// tabs over one filter bar.
//
// Layout: the curated collections (best sellers, most discounted, newest) are
// stacked rows, each with its own heading and its own five items, and below them
// sits the full, paginated grid. They used to be tabs, which meant seeing three
// collections took three clicks and only ever showed one at a time.
//
// The filters live in the URL, in a dropdown bar rather than a wall of chips, and
// they are the *same* filters on both tabs. Two things that used to be true here
// are fixed by that:
//
// * the ad tab ignored categories, brands and packaging — it had no columns to
//   filter on — so the page needed a second, narrower control set. Both sources
//   now carry the taxonomy, so one bar drives both;
// * every axis took exactly one value. «کود و سم» or «این برند یا آن برند» meant
//   losing a selection to make another, so a multi-select is one click each way.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import SkeletonCard from '../components/ui/SkeletonCard';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

import { agricultureApi, productsApi } from '../api/services';
import ProductCard from '../components/ProductCard';
import ProductDetailModal from '../components/ProductDetailModal';
import MarketplaceListingCard from '../components/MarketplaceListingCard';
import ShopFilterBar, {
  EMPTY_FACETS,
  readCsv,
  type ShopFacets,
  type ShopFilters,
  type SortOption,
} from './shop/ShopFilterBar';
import { useCartStore } from '../store/cartStore';
import { useWishlistStore } from '../store/wishlistStore';
import { useTranslation } from '../i18n';
import type { MockProduct, ProductList } from '@/types/shop';
import type { MarketplaceListing } from '@/types/storefront';
import { convertToMockProduct } from '../utils/convertProduct';
import { cn } from '../utils/cn';

const PAGE_SIZE = 12;
/** What the buyer can ask for per page; the API caps what it will ever return. */
const PAGE_SIZES = [12, 24, 48];
/** Each curated row shows five items, per the brief. */
const SECTION_SIZE = 5;

/**
 * Sorts offered per source, with the opposite of each directional sort named.
 *
 * ``conflictsWith`` is what makes «گران‌ترین» dim while «ارزان‌ترین» is on: two
 * directions of one axis cannot both be true, and an ORDER BY that contradicts
 * itself is not a filter, it is a bug. Everything else stacks — DRF reads
 * ``ordering=price,-sales_count`` as a real two-key sort.
 */
const SORTS: Record<'products' | 'marketplace', SortOption[]> = {
  products: [
    { value: '-sales_count', label: 'پرفروش‌ترین' },
    { value: '-avg_rating', label: 'بیشترین امتیاز' },
    { value: '-publish', label: 'جدیدترین', conflictsWith: 'publish' },
    { value: 'publish', label: 'قدیمی‌ترین', conflictsWith: '-publish' },
    { value: '-views', label: 'پربازدیدترین' },
    { value: 'price', label: 'ارزان‌ترین', conflictsWith: '-price' },
    { value: '-price', label: 'گران‌ترین', conflictsWith: 'price' },
  ],
  marketplace: [
    { value: '-sales_count', label: 'پرفروش‌ترین' },
    { value: '-discount_percent', label: 'پرتخفیف‌ترین' },
    { value: '-created_at', label: 'جدیدترین', conflictsWith: 'created_at' },
    { value: 'created_at', label: 'قدیمی‌ترین', conflictsWith: '-created_at' },
    { value: '-views', label: 'پربازدیدترین' },
    { value: 'price', label: 'ارزان‌ترین', conflictsWith: '-price' },
    { value: '-price', label: 'گران‌ترین', conflictsWith: 'price' },
  ],
};

/** Toggles the buyer can insist on, per source. */
const FEATURES: Record<'products' | 'marketplace', Array<{ key: string; label: string }>> = {
  products: [
    { key: 'in_stock', label: 'فقط موجود' },
    { key: 'has_discount', label: 'فقط تخفیف‌دار' },
    { key: 'price_on_request', label: 'قیمت استعلامی (عمده)' },
    { key: 'has_reviews', label: 'فقط دارای بازخورد' },
    { key: 'expiring_soon', label: 'نزدیک تاریخ انقضا' },
  ],
  marketplace: [
    { key: 'in_stock', label: 'فقط موجود' },
    { key: 'stock', label: 'کالای استوک' },
    { key: 'has_discount', label: 'فقط تخفیف‌دار' },
    { key: 'verified', label: 'غرفه تأییدشده' },
  ],
};

interface CuratedSection {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  /** Query parameters that define this collection. */
  params: Record<string, string | boolean | number>;
  /** Accent classes for the section heading. */
  tone: string;
  /** Where "see all" leads. */
  href: string;
}

const CURATED_SECTIONS: CuratedSection[] = [
  {
    id: 'bestsellers',
    labelKey: 'shop.bestSellers',
    icon: TrendingUp,
    params: { ordering: '-sales_count' },
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
    href: '/products?collection=bestsellers',
  },
  {
    id: 'discounted',
    labelKey: 'shop.mostDiscounted',
    icon: Sparkles,
    params: { ordering: '-discount_percent', has_discount: true },
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
    href: '/products?collection=discounted',
  },
  {
    id: 'newest',
    labelKey: 'shop.newest',
    icon: Flame,
    params: { ordering: '-publish' },
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
    href: '/products?collection=newest',
  },
];

/**
 * The same three rows for the sellers' ads.
 *
 * «پرتخفیف‌ترین‌ها» asks the API for the discount flag instead of filtering the
 * first page in the browser: a seller's ۳۰٪ off is only the *fifth* cheapest
 * thing to find if the query that produced the page did not know about it.
 */
const AD_SECTIONS: Array<{ id: string; title: string; params: Record<string, string | boolean>; tone: string }> = [
  {
    id: 'ad-bestsellers',
    title: 'پرفروش‌ترین‌ها',
    params: { ordering: '-sales_count' },
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
  },
  {
    id: 'ad-discounted',
    title: 'پرتخفیف‌ترین‌ها',
    params: { ordering: '-discount_percent', has_discount: '1' },
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
  },
  {
    id: 'ad-newest',
    title: 'جدیدترین‌ها',
    params: { ordering: '-created_at' },
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
  },
];

interface ShopProps {
  compareItems: MockProduct[];
  onToggleCompare: (product: MockProduct) => void;
}

/** Every facet the page reads out of the URL, in one object. */
function readFilters(params: URLSearchParams, source: 'products' | 'marketplace'): ShopFilters {
  return {
    category: params.get('category') || '',
    subcategory: params.get('subcategory') || '',
    brand: params.get('brand') || '',
    pack: params.get(source === 'marketplace' ? 'package_size' : 'package_weight') || '',
    ordering: params.get('ordering') || '',
    search: params.get('search') || '',
    minPrice: params.get('min_price') || '',
    maxPrice: params.get('max_price') || '',
    minRating: params.get('min_rating') || '',
    features: FEATURES[source].map((item) => item.key).filter((key) => params.get(key) === '1'),
  };
}

export default function Shop({ compareItems, onToggleCompare }: ShopProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const source = searchParams.get('source') === 'marketplace' ? 'marketplace' : 'products';
  const featured = searchParams.get('featured') === 'true';
  /** A deep link into one collection shows only that collection, expanded. */
  const collection = searchParams.get('collection') || '';
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const requestedSize = Number(searchParams.get('page_size'));
  const pageSize = PAGE_SIZES.includes(requestedSize) ? requestedSize : PAGE_SIZE;

  const filters = useMemo(
    () => readFilters(searchParams, source),
    // The URL object is recreated by react-router on every navigation, so this
    // memo keys off the string it came from rather than the instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams.toString(), source],
  );

  const [products, setProducts] = useState<MockProduct[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<MockProduct | null>(null);

  const wishlist = useWishlistStore((state) => state.wishlist);
  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const addToCart = useCartStore((state) => state.addToCart);

  const activeCollection = CURATED_SECTIONS.find((section) => section.id === collection) ?? null;

  /** The query the current filters produce, for whichever source is showing. */
  const queryParams = useMemo(() => {
    const base: Record<string, string | number | boolean> = { page, page_size: pageSize };
    if (filters.category) base.category = filters.category;
    if (filters.subcategory) base.subcategory = filters.subcategory;
    if (filters.brand) base.brand = filters.brand;
    if (filters.pack) base[source === 'marketplace' ? 'package_size' : 'package_weight'] = filters.pack;
    if (filters.ordering) base.ordering = filters.ordering;
    if (filters.search) base.search = filters.search;
    if (filters.minPrice) base.min_price = filters.minPrice;
    if (filters.maxPrice) base.max_price = filters.maxPrice;
    if (filters.minRating && source === 'products') base.min_rating = filters.minRating;
    if (featured) base.is_featured = true;
    filters.features.forEach((key) => {
      base[key] = source === 'products' ? true : '1';
    });
    if (source === 'products' && activeCollection) Object.assign(base, activeCollection.params);
    return base;
  }, [filters, page, pageSize, source, featured, activeCollection]);

  // Facets are fetched with the *current* selection, so the brand list contains
  // the brands of the chosen departments; each axis is exempted from its own
  // narrowing server-side, which is why a picked chip never disappears.
  const { data: facetData } = useQuery({
    queryKey: ['shop-facets', source, queryParams],
    queryFn: async () => {
      const response =
        source === 'marketplace'
          ? await agricultureApi.listingFacets(queryParams)
          : await productsApi.getFacets(queryParams);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const facets: ShopFacets = useMemo(() => {
    if (!facetData) return EMPTY_FACETS;
    return {
      categories: (facetData.categories || []).map((row) => ({
        value: row.value,
        label: row.label || row.value,
        count: row.count,
      })),
      subcategories: (facetData.subcategories || []).map((row) => ({
        value: row.value,
        label: row.label || row.value,
        count: row.count,
        category: row.category,
      })),
      // Brands and packages come back as bare values — the catalogue stores them
      // as text, so the value *is* the label.
      brands: (facetData.brands || []).map((row) => ({
        value: row.value,
        label: row.value,
        count: row.count,
      })),
      // Both sources publish packaging as free text under their own parameter
      // name; the bar only ever sees one list.
      packages: (facetData.package_weights || []).map((row) => ({
        value: row.value,
        label: row.label || row.value,
        count: row.count,
      })),
      maxPrice: facetData.max_price || 0,
    };
  }, [facetData]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const request = source === 'marketplace'
      ? agricultureApi.listMarketplace(queryParams as never).then((response) => {
        if (cancelled) return;
        setListings(response.data.results || []);
        setTotal(response.data.count || 0);
      })
      : productsApi.getAll(queryParams as never).then((response) => {
        if (cancelled) return;
        setProducts((response.data.results || []).map((item: ProductList) => convertToMockProduct(item)));
        setTotal(response.data.count || 0);
      });

    request
      .catch(() => {
        if (cancelled) return;
        if (source === 'marketplace') setListings([]);
        else setProducts([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryParams, source]);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / pageSize), 1), [total, pageSize]);

  const updateParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        Object.entries(patch).forEach(([key, value]) => {
          if (value === undefined || value === '') next.delete(key);
          else next.set(key, value);
        });
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    updateParams({
      category: undefined, subcategory: undefined, brand: undefined,
      package_weight: undefined, package_size: undefined, ordering: undefined,
      search: undefined, min_price: undefined, max_price: undefined, min_rating: undefined,
      page_size: undefined, collection: undefined, featured: undefined, page: undefined,
      ...Object.fromEntries([...FEATURES.products, ...FEATURES.marketplace].map((item) => [item.key, undefined])),
    });
  }, [updateParams]);

  const handleAddToCart = useCallback(
    async (product: MockProduct) => {
      try {
        await addToCart(product.id, 1);
      } catch {
        // The cart store reports failures itself.
      }
    },
    [addToCart],
  );

  const activeCount =
    readCsv(filters.category).length + readCsv(filters.subcategory).length +
    readCsv(filters.brand).length + readCsv(filters.pack).length +
    readCsv(filters.ordering).length + filters.features.length +
    (filters.search ? 1 : 0) + (filters.minPrice || filters.maxPrice ? 1 : 0) +
    (filters.minRating ? 1 : 0);
  const filtersActive = activeCount > 0;

  const selectedCategories = readCsv(filters.category);
  const gridTitle = activeCollection
    ? t(activeCollection.labelKey)
    : selectedCategories.length === 1
      ? facets.categories.find((row) => row.value === selectedCategories[0])?.label || t('shop.title')
      : source === 'marketplace'
        ? 'آگهی‌های غرفه‌داران'
        : t('shop.allProducts');

  return (
    <main className="min-h-dvh bg-gradient-to-b from-emerald-50/60 via-white to-white pb-10 dark:from-emerald-950/40 dark:via-[#052e22] dark:to-emerald-950">
      {/* Page header + the one filter bar both tabs share */}
      <section className="border-b border-emerald-100 bg-white/70 py-6 dark:border-emerald-900/50 dark:bg-emerald-950/40 md:py-8">
        <div className="mx-auto max-w-7xl px-[var(--page-gutter)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-fluid-2xl font-extrabold text-slate-800 dark:text-white">
                {t('shop.title')}
              </h1>
              <p className="mt-2 max-w-2xl text-fluid-sm leading-6 text-slate-500 dark:text-emerald-200">
                {t('shop.subtitle')}
              </p>
            </div>

            <div className="inline-flex rounded-2xl bg-emerald-50 p-1 dark:bg-emerald-900/50" role="tablist" aria-label="منبع کاتالوگ">
              <button
                type="button"
                role="tab"
                aria-selected={source === 'products'}
                onClick={() => updateParams({ source: undefined, page: undefined })}
                className={cn(
                  'min-h-11 rounded-xl px-4 text-sm font-bold transition',
                  source === 'products'
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-lime-300'
                    : 'text-slate-500 dark:text-emerald-200',
                )}
              >
                محصولات گرین‌کود
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={source === 'marketplace'}
                onClick={() => updateParams({ source: 'marketplace', page: undefined })}
                className={cn(
                  'min-h-11 rounded-xl px-4 text-sm font-bold transition',
                  source === 'marketplace'
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-lime-300'
                    : 'text-slate-500 dark:text-emerald-200',
                )}
              >
                آگهی‌های غرفه‌داران
              </button>
            </div>
          </div>

          <ShopFilterBar
            source={source}
            facets={facets}
            filters={filters}
            sorts={SORTS[source]}
            features={FEATURES[source]}
            onChange={updateParams}
            onReset={resetFilters}
            trailing={
              <div className="flex items-center gap-1.5">
                {selectedCategories.length === 1 && (
                  <Link
                    to={`/c/${selectedCategories[0]}`}
                    className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-fluid-2xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-lime-300 dark:hover:bg-emerald-900/50"
                  >
                    صفحه کامل دسته
                    <ArrowLeft size={13} aria-hidden="true" />
                  </Link>
                )}
                {PAGE_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={pageSize === size}
                    onClick={() =>
                      updateParams({ page_size: size === PAGE_SIZE ? undefined : String(size), page: undefined })
                    }
                    className={cn(
                      'min-h-11 rounded-lg border px-2.5 text-fluid-2xs font-bold transition-colors',
                      pageSize === size
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/60 dark:text-lime-200'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
                    )}
                  >
                    {size.toLocaleString('fa-IR')} کالا
                  </button>
                ))}
              </div>
            }
          />
        </div>
      </section>

      {/*
        Curated collections, one section per row. They are hidden while a
        single collection is deep-linked (that becomes the main grid) and while
        any filter is applied, where the visitor has already narrowed the
        catalogue and expects one list, not four.
      */}
      {!activeCollection && !filtersActive && !featured && (
        <div className="mx-auto max-w-7xl space-y-8 px-[var(--page-gutter)] pt-8">
          {source === 'products'
            ? CURATED_SECTIONS.map((section) => (
              <CuratedRow
                key={section.id}
                section={section}
                wishlist={wishlist}
                onToggleWishlist={toggleWishlist}
                onAddToCart={handleAddToCart}
                onQuickView={setSelectedProduct}
                compareItems={compareItems}
                onToggleCompare={onToggleCompare}
              />
            ))
            : AD_SECTIONS.map((section) => (
              <AdRow key={section.id} section={section} />
            ))}
        </div>
      )}

      {/* The full, filterable grid. No sidebar: the dropdowns above replaced it,
          and a second filter control set on the same page is how a shop ends up
          with two answers to one question. */}
      <div className="mx-auto max-w-7xl px-[var(--page-gutter)] py-8">
        <section aria-label={gridTitle}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">
              {gridTitle}
              {total > 0 && (
                <span className="ms-2 text-fluid-xs font-bold text-slate-400">
                  {total.toLocaleString('fa-IR')} مورد
                </span>
              )}
            </h2>
            {activeCollection && (
              <button
                type="button"
                onClick={() => updateParams({ collection: undefined, page: undefined })}
                className="min-h-11 rounded-xl border border-emerald-200 px-4 text-fluid-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
              >
                {t('shop.backToAll')}
              </button>
            )}
          </div>

          {loading ? (
            // Geometry-exact shimmers instead of a centered spinner: the grid
            // takes its final shape immediately and nothing jumps on swap-in.
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonCard key={index} variant={source === 'marketplace' ? 'listing' : 'product'} />
              ))}
            </div>
          ) : (source === 'products' ? products.length === 0 : listings.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="text-5xl">🔍</div>
              <p className="mt-4 text-fluid-lg font-bold text-slate-700 dark:text-white">
                {t('shop.noProducts')}
              </p>
              {filtersActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 min-h-11 rounded-xl border border-emerald-200 px-4 text-fluid-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300"
                >
                  حذف فیلترها و دیدن همه
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {source === 'products'
                ? products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={index}
                    isWishlisted={wishlist.some((item) => item.id === product.id)}
                    isComparing={compareItems.some((item) => item.id === product.id)}
                    compareDisabled={compareItems.length >= 3}
                    onToggleWishlist={toggleWishlist}
                    onAddToCart={(item) => void handleAddToCart(item)}
                    onQuickView={setSelectedProduct}
                    // ARCHITECT CHECK: Compare toggle wired
                    onToggleCompare={onToggleCompare}
                  />
                ))
                : listings.map((listing, index) => (
                  <MarketplaceListingCard key={listing.id} listing={listing} index={index} />
                ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <nav
              className="mt-10 flex flex-wrap items-center justify-center gap-1.5"
              aria-label={t('shop.page')}
            >
              <PageButton
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(Math.max(page - 1, 1)) })}
                label={t('shop.previous')}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </PageButton>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | 'gap')[]>((acc, p, index, arr) => {
                  if (index > 0 && p - (arr[index - 1] as number) > 1) acc.push('gap');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, index) =>
                  p === 'gap' ? (
                    <span key={`gap-${index}`} className="px-1 text-slate-400">
                      …
                    </span>
                  ) : (
                    <motion.button
                      key={p}
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      onClick={() => updateParams({ page: String(p) })}
                      className={cn(
                        'flex h-11 min-w-11 items-center justify-center rounded-xl border text-fluid-sm font-bold transition',
                        p === page
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-md'
                          : 'border-emerald-100 bg-white text-slate-600 hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
                      )}
                      aria-current={p === page ? 'page' : undefined}
                    >
                      {p.toLocaleString('fa-IR')}
                    </motion.button>
                  ),
                )}

              <PageButton
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: String(Math.min(page + 1, totalPages)) })}
                label={t('shop.next')}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </PageButton>
            </nav>
          )}
        </section>
      </div>

      {/* Quick view */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(product) => void handleAddToCart(product)}
        isWishlisted={selectedProduct ? wishlist.some((p) => p.id === selectedProduct.id) : false}
        onToggleWishlist={toggleWishlist}
      />
    </main>
  );
}

/**
 * One curated collection: a heading and its own five products.
 *
 * Each row fetches independently so a slow or empty collection never blocks
 * the others, and a collection with no products removes itself rather than
 * leaving an empty heading behind.
 */
function CuratedRow({
  section,
  wishlist,
  onToggleWishlist,
  onAddToCart,
  onQuickView,
  compareItems,
  onToggleCompare,
}: {
  section: CuratedSection;
  wishlist: MockProduct[];
  onToggleWishlist: (product: MockProduct) => void;
  onAddToCart: (product: MockProduct) => Promise<void>;
  onQuickView: (product: MockProduct) => void;
  compareItems: MockProduct[];
  onToggleCompare: (product: MockProduct) => void;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<MockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const Icon = section.icon;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    productsApi
      .getAll({ page: 1, page_size: SECTION_SIZE, ...section.params } as never)
      .then((response) => {
        if (cancelled) return;
        setItems((response.data.results || []).slice(0, SECTION_SIZE).map(convertToMockProduct));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  // An empty collection is dropped entirely — a heading over nothing reads as
  // a broken page.
  if (!loading && items.length === 0) return null;

  return (
    <section aria-labelledby={`section-${section.id}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id={`section-${section.id}`}
          className="flex items-center gap-2 text-fluid-lg font-extrabold text-slate-800 dark:text-white"
        >
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              section.tone,
            )}
          >
            <Icon size={17} aria-hidden="true" />
          </span>
          {t(section.labelKey)}
        </h2>
        <Link
          to={section.href}
          className="flex min-h-11 items-center gap-1 text-fluid-xs font-bold text-emerald-700 transition hover:text-emerald-800 dark:text-lime-300"
        >
          {t('common.viewAll')}
          <ArrowLeft size={14} aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: SECTION_SIZE }).map((_, index) => (
            <SkeletonCard key={index} variant="product" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {items.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              isWishlisted={wishlist.some((p) => p.id === product.id)}
              isComparing={compareItems.some((item) => item.id === product.id)}
              compareDisabled={compareItems.length >= 3}
              onToggleWishlist={onToggleWishlist}
              onAddToCart={(item) => void onAddToCart(item)}
              onQuickView={onQuickView}
              // ARCHITECT CHECK: Compare toggle wired
              onToggleCompare={onToggleCompare}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** One curated row of sellers' ads — the same shape, the listing card instead. */
function AdRow({
  section,
}: {
  section: { id: string; title: string; params: Record<string, string | boolean>; tone: string };
}) {
  const [items, setItems] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    agricultureApi
      .listMarketplace({ page: 1, page_size: SECTION_SIZE, ...section.params } as never)
      .then((response) => {
        if (cancelled) return;
        setItems(response.data.results || []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  if (!loading && items.length === 0) return null;

  return (
    <section aria-labelledby={`section-${section.id}`}>
      <h2
        id={`section-${section.id}`}
        className="mb-3 flex items-center gap-2 text-fluid-lg font-extrabold text-slate-800 dark:text-white"
      >
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', section.tone)}>
          {section.id === 'ad-discounted' ? <Sparkles size={17} aria-hidden="true" /> : <TrendingUp size={17} aria-hidden="true" />}
        </span>
        {section.title}
      </h2>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: SECTION_SIZE }).map((_, index) => (
            <SkeletonCard key={index} variant="listing" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {items.map((listing, index) => (
            <MarketplaceListingCard
              key={listing.id}
              listing={listing}
              index={index}
              // In پرتخفیف‌ترین‌ها the only badge is the discount itself: the row
              // is already the discount list, so a «پرتخفیف‌ترین» chip says nothing
              // and steals space from the price.
              variant={section.id === 'ad-discounted' ? 'discount' : 'default'}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl border border-emerald-100 bg-white px-3 text-fluid-sm font-bold text-slate-600 transition hover:border-emerald-300 disabled:opacity-40 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
    >
      {children}
    </button>
  );
}
