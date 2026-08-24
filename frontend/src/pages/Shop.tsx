// frontend/src/pages/Shop.tsx
//
// The standalone catalogue — only the site's own products (no marketplace
// listings), with category chips, full pagination and three curated sections:
// best sellers, most discounted and newest.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Flame, LayoutGrid, Sparkles, TrendingUp } from 'lucide-react';

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

type Tab = 'all' | 'bestsellers' | 'discounted' | 'newest';

const TABS: { key: Tab; icon: typeof LayoutGrid; labelKey: string }[] = [
  { key: 'all', icon: LayoutGrid, labelKey: 'shop.all' },
  { key: 'bestsellers', icon: TrendingUp, labelKey: 'shop.bestSellers' },
  { key: 'discounted', icon: Sparkles, labelKey: 'shop.mostDiscounted' },
  { key: 'newest', icon: Flame, labelKey: 'shop.newest' },
];

export default function Shop() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = (searchParams.get('tab') as Tab) || 'all';
  const category = searchParams.get('category') || '';
  const featured = searchParams.get('featured') === 'true';
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<MockProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<MockProduct | null>(null);

  const wishlist = useWishlistStore((state) => state.wishlist);
  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const addToCart = useCartStore((state) => state.addToCart);

  useEffect(() => {
    categoriesApi
      .getAll()
      .then((response) => setCategories(response.data.results || []))
      .catch(() => setCategories([]));
  }, []);

  const queryKey = [tab, category, featured, page];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params: Record<string, unknown> = { page, page_size: PAGE_SIZE };
    if (category) params.category = category;
    if (featured) params.is_featured = true;
    if (tab === 'bestsellers') params.ordering = '-sales_count';
    else if (tab === 'discounted') {
      params.ordering = '-discount_percent';
      params.has_discount = true;
    } else if (tab === 'newest') params.ordering = '-publish';

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

  function selectTab(next: Tab) {
    updateParams({ tab: next === 'all' ? undefined : next, page: undefined });
  }

  async function handleAddToCart(product: MockProduct) {
    try {
      await addToCart(product.id, 1);
    } catch {
      // The cart store reports failures itself.
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-white pb-10 dark:from-emerald-950/40 dark:via-[#052e22] dark:to-emerald-950">
      {/* Page header */}
      <section className="border-b border-emerald-100 bg-white/70 py-8 dark:border-emerald-900/50 dark:bg-emerald-950/40 md:py-12">
        <div className="mx-auto max-w-7xl px-[var(--page-gutter)]">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white md:text-3xl">
            {t('shop.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-emerald-200">
            {t('shop.subtitle')}
          </p>

          {/* Sections */}
          <div
            role="tablist"
            aria-label={t('shop.title')}
            className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1"
          >
            {TABS.map(({ key, icon: Icon, labelKey }) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => selectTab(key)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition',
                  tab === key
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'border-emerald-100 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:border-emerald-600',
                )}
              >
                <Icon size={16} aria-hidden="true" />
                {t(labelKey)}
              </button>
            ))}
          </div>

          {/* Category chips */}
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => updateParams({ category: undefined, page: undefined })}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition',
                !category
                  ? 'border-lime-500 bg-lime-500/10 text-lime-700 dark:text-lime-300'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
              )}
            >
              {t('common.all')}
            </button>
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => updateParams({ category: item.slug, page: undefined })}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition',
                  category === item.slug
                    ? 'border-lime-500 bg-lime-500/10 text-lime-700 dark:text-lime-300'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
                )}
              >
                {item.name}
                <span className="ms-1.5 text-fluid-2xs text-slate-300">{item.product_count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-7xl px-[var(--page-gutter)] py-6" aria-label={t('shop.title')}>
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="text-5xl">🔍</div>
            <p className="mt-4 text-lg font-bold text-slate-700 dark:text-white">
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
            className="mt-10 flex items-center justify-center gap-1.5"
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
                      'flex h-10 min-w-10 items-center justify-center rounded-xl border text-sm font-bold transition',
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
      className="flex h-10 items-center gap-1 rounded-xl border border-emerald-100 bg-white px-3 text-sm font-bold text-slate-600 transition hover:border-emerald-300 disabled:opacity-40 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
    >
      {children}
    </button>
  );
}
