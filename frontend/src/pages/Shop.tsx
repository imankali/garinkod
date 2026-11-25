// frontend/src/pages/Shop.tsx

import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PackageSearch, SlidersHorizontal } from 'lucide-react';

import { categoriesApi, productsApi } from '../api/services';
import type { ProductList } from '@/types/shop';
import PageHead from '../components/shop/PageHead';
import ProductCard from '../components/shop/ProductCard';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { cn } from '../lib/cn';
import { nums } from '../lib/price';

/**
 * The catalogue.
 *
 * Filters live in the URL (`?category=&ordering=&search=`), which is what makes
 * a filtered view shareable and the back button behave. The controls are a
 * row of plain selects and links on desktop and a horizontally scrollable row
 * of chips on a phone — not a slide-over panel with twelve checkbox groups.
 *
 * Pagination is a real `page` parameter: the previous page stays on screen
 * while the next one loads (`keepPreviousData`), so «بعدی» appends nothing and
 * loses nothing — the visitor moves one screenful at a time and the scroll
 * position is theirs to keep. Re-requesting the whole list with a bigger
 * `page_size` looked the same and was not: it re-fetched everything already on
 * screen, and it meant the catalogue had to cap itself at 96 products.
 */
const ORDERINGS = [
  { value: '-created', label: 'تازه‌ترین' },
  { value: '-sales_count', label: 'پرفروش‌ترین' },
  { value: '-discount_percent', label: 'پرتخفیف‌ترین' },
  { value: 'price', label: 'ارزان‌ترین' },
  { value: '-price', label: 'گران‌ترین' },
] as const;

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const ordering = params.get('ordering') ?? '-created';
  const search = params.get('search') ?? '';
  const page = Math.max(1, Number(params.get('page') || 1) || 1);
  const PAGE_SIZE = 24;

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.getAll()).data.results ?? [],
    staleTime: 10 * 60 * 1000,
  });

  const products = useQuery({
    queryKey: ['products', { category, ordering, search, page }],
    queryFn: async () =>
      (await productsApi.getAll({
        ...(category ? { category } : {}),
        ...(search ? { search } : {}),
        ordering,
        page,
        page_size: PAGE_SIZE,
      })).data,
    staleTime: 2 * 60 * 1000,
    // Paging does not blank the grid: the previous page is what the visitor is
    // still looking at while the next one arrives.
    placeholderData: keepPreviousData,
  });

  const activeCategory = useMemo(
    () => categories.data?.find((item) => item.slug === category),
    [categories.data, category],
  );

  function patch(next: Record<string, string | null>) {
    const updated = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') updated.delete(key);
      else updated.set(key, value);
    }
    setParams(updated, { replace: true });
  }

  // Paging keeps the same pathname, so the app's scroll reset does not fire.
  // Without this the visitor lands at the bottom of page 2 looking at the
  // pagination row they just pressed.
  const resultsRef = useRef<HTMLDivElement>(null);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    resultsRef.current?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [page, category, ordering, search]);

  const items: ProductList[] = products.data?.results ?? [];
  const total = products.data?.count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="shell flex flex-col gap-5 py-8">
      <PageHead
        title={activeCategory ? activeCategory.name : search ? `نتیجهٔ جستجو: «${search}»` : 'فروشگاه گرین‌کود'}
        lead={
          activeCategory?.description ||
          'کود، سم، بذر، ادوات و آبیاری — موجودی و قیمت هر کالا پیش از پرداخت بررسی می‌شود.'
        }
        actions={
          <p className="dateline text-2xs font-bold text-ink-mute dark:text-white/45">
            {nums(total)} کالا
          </p>
        }
      />

      {/* Filters: one row, wrapped, each control labelled by its own text. */}
      <div className="flex flex-wrap items-center gap-2 border-y border-line py-3 dark:border-night-line">
        <span className="inline-flex items-center gap-1.5 text-2xs font-bold text-ink-mute dark:text-white/45">
          <SlidersHorizontal size={14} aria-hidden="true" />
          دسته
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => patch({ category: null })}
            aria-pressed={!category}
            className={cn(
              'min-h-9 rounded-pill border px-3 text-2xs font-bold transition-colors duration-150',
              !category
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-line bg-paper text-ink-soft hover:border-brand-300 dark:border-night-line dark:bg-night-soft dark:text-white/70',
            )}
          >
            همه
          </button>
          {(categories.data ?? []).map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => patch({ category: item.slug })}
              aria-pressed={category === item.slug}
              className={cn(
                'min-h-9 rounded-pill border px-3 text-2xs font-bold transition-colors duration-150',
                category === item.slug
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-line bg-paper text-ink-soft hover:border-brand-300 dark:border-night-line dark:bg-night-soft dark:text-white/70',
              )}
            >
              {item.name}
            </button>
          ))}
        </div>

        <label className="ms-auto inline-flex items-center gap-2 text-2xs font-bold text-ink-mute dark:text-white/45">
          ترتیب
          <select
            value={ordering}
            onChange={(event) => patch({ ordering: event.target.value })}
            className="h-9 min-w-32 rounded-sm border border-line bg-paper px-2 text-2xs font-bold text-ink transition-colors duration-150 hover:border-brand-300 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/15 dark:border-night-line dark:bg-night-soft dark:text-white"
          >
            {ORDERINGS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {products.isLoading ? (
        <CardGridSkeleton count={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="کالایی با این فیلترها پیدا نشد"
          description="دسته را عوض کنید یا جستجو را ساده‌تر بنویسید؛ اگر کالایی را انتظار داشتید و نبود، به پشتیبانی بگویید تا موجود کنیم."
          action={<Button to="/products" variant="secondary" size="sm">پاک کردن فیلترها</Button>}
        />
      ) : (
        <>
          <div ref={resultsRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>

          {lastPage > 1 && (
            <nav
              aria-label="صفحه‌بندی کالاها"
              className="flex items-center justify-between gap-3 border-t border-line pt-4 dark:border-night-line"
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => patch({ page: page > 2 ? String(page - 1) : null })}
              >
                صفحهٔ قبل
              </Button>
              <p className="dateline text-2xs font-bold text-ink-mute dark:text-white/45" aria-live="polite">
                صفحهٔ {nums(page)} از {nums(lastPage)}
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
