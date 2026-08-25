// frontend/src/pages/Shop.tsx
//
// The standalone catalogue — only the site's own products (no marketplace
// listings).
//
// Layout: the curated collections (best sellers, most discounted, newest) are
// stacked rows, each with its own heading and its own five products. They used
// to be tabs, which meant seeing three collections took three clicks and only
// ever showed one at a time. Below the rows sits the full, paginated grid with
// its category chips.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

import { categoriesApi, productsApi } from '../api/services';
import ProductCard from '../components/ProductCard';
import ProductDetailModal from '../components/ProductDetailModal';
import { useCartStore } from '../store/cartStore';
import { useWishlistStore } from '../store/wishlistStore';
import { useTranslation } from '../i18n';
import type { Category, MockProduct, ProductList } from '../types';
import { convertToMockProduct } from '../utils/convertProduct';
import { cn } from '../utils/cn';

const PAGE_SIZE = 12;
/** Each curated row shows five products, per the brief. */
const SECTION_SIZE = 5;

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

export default function Shop() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const category = searchParams.get('category') || '';
  const featured = searchParams.get('featured') === 'true';
  /** A deep link into one collection shows only that collection, expanded. */
  const collection = searchParams.get('collection') || '';
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<MockProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<MockProduct | null>(null);

  const wishlist = useWishlistStore((state) => state.wishlist);
  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const addToCart = useCartStore((state) => state.addToCart);

  const activeCollection = CURATED_SECTIONS.find((section) => section.id === collection) ?? null;

  useEffect(() => {
    categoriesApi
      .getAll()
      .then((response) => setCategories(response.data.results || []))
      .catch(() => setCategories([]));
  }, []);

  const queryKey = [category, featured, page, collection];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params: Record<string, unknown> = { page, page_size: PAGE_SIZE };
    if (category) params.category = category;
    if (featured) params.is_featured = true;
    if (activeCollection) Object.assign(params, activeCollection.params);

    productsApi
      .getAll(params as never)
      .then((response) => {
        if (cancelled) return;
        const converted = (response.data.results || []).map((item: ProductList) =>
          convertToMockProduct(item),
        );
        setProducts(converted);
        setTotal(response.data.count || 0);
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey.join('|')]);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / PAGE_SIZE), 1), [total]);

  const updateParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, value);
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

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

  const gridTitle = activeCollection
    ? t(activeCollection.labelKey)
    : category
      ? categories.find((item) => item.slug === category)?.name || t('shop.title')
      : t('shop.allProducts');

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-white pb-10 dark:from-emerald-950/40 dark:via-[#052e22] dark:to-emerald-950">
      {/* Page header */}
      <section className="border-b border-emerald-100 bg-white/70 py-6 dark:border-emerald-900/50 dark:bg-emerald-950/40 md:py-10">
        <div className="mx-auto max-w-7xl px-[var(--page-gutter)]">
          <h1 className="text-fluid-2xl font-extrabold text-slate-800 dark:text-white">
            {t('shop.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-fluid-sm leading-6 text-slate-500 dark:text-emerald-200">
            {t('shop.subtitle')}
          </p>

          {/* Category chips */}
          <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
            <CategoryChip
              active={!category}
              label={t('common.all')}
              onClick={() => updateParams({ category: undefined, page: undefined })}
            />
            {categories.map((item) => (
              <CategoryChip
                key={item.id}
                active={category === item.slug}
                label={item.name}
                count={item.product_count}
                onClick={() => updateParams({ category: item.slug, page: undefined })}
              />
            ))}
          </div>
        </div>
      </section>

      {/*
        Curated collections, one section per row. They are hidden while a
        single collection is deep-linked (that becomes the main grid) and
        while a category filter is applied, where the visitor has already
        narrowed the catalogue and expects one list, not four.
      */}
      {!activeCollection && !category && !featured && (
        <div className="mx-auto max-w-7xl space-y-8 px-[var(--page-gutter)] pt-8">
          {CURATED_SECTIONS.map((section) => (
            <CuratedRow
              key={section.id}
              section={section}
              wishlist={wishlist}
              onToggleWishlist={toggleWishlist}
              onAddToCart={handleAddToCart}
              onQuickView={setSelectedProduct}
            />
          ))}
        </div>
      )}

      {/* Full catalogue grid */}
      <section
        className="mx-auto max-w-7xl px-[var(--page-gutter)] py-8"
        aria-label={gridTitle}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">
            {gridTitle}
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
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="text-5xl">🔍</div>
            <p className="mt-4 text-fluid-lg font-bold text-slate-700 dark:text-white">
              {t('shop.noProducts')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                isWishlisted={wishlist.some((p) => p.id === product.id)}
                isComparing={false}
                compareDisabled
                onToggleWishlist={toggleWishlist}
                onAddToCart={(item) => void handleAddToCart(item)}
                onQuickView={setSelectedProduct}
                onToggleCompare={() => undefined}
              />
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
}: {
  section: CuratedSection;
  wishlist: MockProduct[];
  onToggleWishlist: (product: MockProduct) => void;
  onAddToCart: (product: MockProduct) => Promise<void>;
  onQuickView: (product: MockProduct) => void;
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
            <div
              key={index}
              className="h-64 animate-pulse rounded-2xl bg-emerald-100/60 dark:bg-emerald-900/40"
            />
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
              isComparing={false}
              compareDisabled
              onToggleWishlist={onToggleWishlist}
              onAddToCart={(item) => void onAddToCart(item)}
              onQuickView={onQuickView}
              onToggleCompare={() => undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-fluid-xs font-bold transition',
        active
          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-fluid-2xs',
            active ? 'bg-white/25' : 'bg-slate-100 dark:bg-emerald-900',
          )}
        >
          {count.toLocaleString('fa-IR')}
        </span>
      )}
    </button>
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
