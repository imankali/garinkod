// frontend/src/components/home/CategorySections.tsx
//
// The home catalogue, one section per category.
//
// The old layout was a single grid with category chips above it: to see the
// سم products you had to pick "سم", and then the کود products disappeared.
// A shop window should show every department at once. Each section here has
// its own heading ("سم:"), its own results/filter/sort bar and its own
// single-row rail, and — because sorting and filtering are per section — the
// state for each lives inside the section, not in App.
//
// The rail replaced a two-row grid: four departments stacked two rows each
// meant eight rows of cards between the header and the magazine, and the second
// row of every department was below the fold on a phone. One row per department
// (the same shape as «پیشنهادهای شگفت‌انگیز») keeps the page a shop window
// instead of a wall, and the section is now unframed — a border around every
// department turned the home page into a stack of boxes.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from 'react-router';
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, SearchX } from "lucide-react";

import EmptyState from '../ui/EmptyState';

import { categoriesApi, productsApi } from "../../api/services";
import FilterSortBar, { type SortOption } from "../FilterSortBar";
import ProductCard from "../ProductCard";
import { useDragToScroll } from "../../hooks/useDragToScroll";
import { useTranslation } from "../../i18n";
import type { Category, MockProduct, ProductQueryParams } from '@/types/shop';
import { convertToMockProduct } from "../../utils/convertProduct";

/** How many products each department shows before "show more". */
const PER_SECTION = 8;

/** How many are fetched per department; beyond this, "see all" takes over. */
const PER_FETCH = 24;

/** The slider's ceiling when a section has no products yet. */
const FALLBACK_MAX_PRICE = 10_000_000;

const SORT_ORDERING: Record<SortOption, string | undefined> = {
  popular: undefined,
  // Ordered by the approved review average, which the API annotates on the
  // queryset — there is no client-side rating to sort by.
  best_rated: "-avg_rating",
  cheapest: "price",
  expensive: "-price",
};

export interface CategorySectionsProps {
  group?: "primary" | "secondary" | "all";
  /** Only show products flagged as featured (the `?featured=true` deep link). */
  featuredOnly?: boolean;
  /** A crop tag from the crop selector; filters client-side like before. */
  activeCrop?: string | null;
  wishlistIds: Set<number>;
  compareIds: Set<number>;
  compareDisabled: boolean;
  onToggleWishlist: (product: MockProduct) => void;
  onAddToCart: (product: MockProduct, event: React.MouseEvent) => void;
  onQuickView: (product: MockProduct) => void;
  onToggleCompare: (product: MockProduct) => void;
}

export default function CategorySections(props: CategorySectionsProps) {
  const boundaryRef = useRef<HTMLDivElement>(null);
  const isVisible = useLazyVisibility(boundaryRef);
  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await categoriesApi.getAll();
      return (response.data.results || []) as Category[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: isVisible,
  });

  // Empty categories would render as a heading with "۰ محصول یافت شد" —
  // noise, not information — so only departments with stock get a section.
  const sections = useMemo(() => {
    const group = props.group ?? "all";
    const ordered = [
      { rank: 0, test: /pesticide|سم/i, group: "primary" },
      { rank: 1, test: /fertilizer|کود/i, group: "primary" },
      { rank: 2, test: /seed|بذر/i, group: "primary" },
      { rank: 3, test: /equipment|tool|ادوات/i, group: "primary" },
      { rank: 4, test: /irrigation|آبیاری/i, group: "secondary" },
      { rank: 5, test: /greenhouse|گلخانه/i, group: "secondary" },
      { rank: 6, test: /feed|خوراک دام/i, group: "secondary" },
    ];
    return (categories ?? [])
      .filter((category) => category.product_count > 0)
      .map((category) => {
        const text = `${category.slug} ${category.name}`;
        const match = ordered.find((item) => item.test.test(text));
        return { category, rank: match?.rank ?? 99, sectionGroup: match?.group };
      })
      .filter((item) => group === "all" || item.sectionGroup === group)
      .sort((a, b) => a.rank - b.rank)
      .map((item) => item.category);
  }, [categories, props.group]);

  if (!isVisible || isLoading) {
    return (
      <div ref={boundaryRef} className="mx-auto min-h-[32rem] max-w-7xl space-y-10 px-4 py-8" aria-busy="true">
        {[0, 1].map((index) => (
          <SectionSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <section id="products" className="mx-auto max-w-7xl px-4 py-8" aria-label="فهرست محصولات">
        <EmptyGrid />
      </section>
    );
  }

  return (
    <div id="products" className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:space-y-6">
      {sections.map((category) => (
        <CategorySection key={category.slug} category={category} {...props} />
      ))}
    </div>
  );
}

// ========================================
// One department
// ========================================
function CategorySection({
  category,
  featuredOnly = false,
  activeCrop = null,
  wishlistIds,
  compareIds,
  compareDisabled,
  onToggleWishlist,
  onAddToCart,
  onQuickView,
  onToggleCompare,
}: CategorySectionsProps & { category: Category }) {
  const { dir } = useTranslation();
  const [sort, setSort] = useState<SortOption>("popular");
  const [priceLimit, setPriceLimit] = useState<number>(FALLBACK_MAX_PRICE);
  const [inStockOnly, setInStockOnly] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  // Mouse drag, momentum and keyboard scrolling, identical to every other rail.
  const railDrag = useDragToScroll<HTMLDivElement>();
  const isVisible = useLazyVisibility(sectionRef);

  const priceFilterActive = priceLimit < FALLBACK_MAX_PRICE;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "home-category-products",
      category.slug,
      sort,
      inStockOnly,
      featuredOnly,
      priceFilterActive ? priceLimit : null,
    ],
    queryFn: async () => {
      const params: ProductQueryParams = {
        category: category.slug,
        page: 1,
        page_size: PER_FETCH,
      };
      if (inStockOnly) params.in_stock = true;
      if (featuredOnly) params.is_featured = true;
      if (priceFilterActive) params.max_price = priceLimit;
      const ordering = SORT_ORDERING[sort];
      if (ordering) params.ordering = ordering;
      const response = await productsApi.getAll(params);
      return { results: response.data.results || [], count: response.data.count ?? 0 };
    },
    staleTime: 30_000,
    placeholderData: (previous) => previous,
    enabled: isVisible,
  });

  const products: MockProduct[] = useMemo(
    () => (data?.results ?? []).map(convertToMockProduct),
    [data],
  );

  const filtered = activeCrop
    ? products.filter((product) => product.cropTags.includes(activeCrop))
    : products;

  // Slider ceiling: the priciest item in this department (not site-wide), so
  // the range is meaningful for a section of cheap seeds as well as tractors.
  // It is only ever raised, and never recomputed while a price filter is on —
  // otherwise dragging the slider down would shrink its own maximum and the
  // user could never drag it back up.
  const [ceiling, setCeiling] = useState(0);
  useEffect(() => {
    if (priceFilterActive || products.length === 0) return;
    const top = products.reduce((max, product) => Math.max(max, product.price), 0);
    // Round up to the next 50k step so the current max is always selectable.
    const rounded = Math.ceil(top / 50_000) * 50_000;
    setCeiling((previous) => Math.max(previous, rounded));
  }, [products, priceFilterActive]);
  const maxPrice = ceiling || FALLBACK_MAX_PRICE;

  const visible = filtered.slice(0, PER_SECTION);
  // Total matching this section's filters: the API count when the crop filter
  // is off, otherwise what is left after filtering client-side.
  const resultsCount = activeCrop ? filtered.length : (data?.count ?? filtered.length);
  const headingId = `home-category-${category.slug}`;
  const SeeAllArrow = dir === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      className="scroll-mt-[calc(var(--header-height,72px)+1rem)]"
    >
      {/* Heading row: "سم:" + shortcut to the full catalogue of that department. */}
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id={headingId} className="flex items-center gap-2 text-fluid-lg font-extrabold text-slate-800 dark:text-white">
          {category.image ? (
            <img src={category.image} alt="" className="h-8 w-8 rounded-lg object-cover" loading="lazy" />
          ) : (
            <span className="h-6 w-1.5 rounded-full bg-brand-gradient-accent" aria-hidden="true" />
          )}
          <span>
            {category.name}
            <span className="text-emerald-600 dark:text-lime-300">:</span>
          </span>
        </h2>
        <Link
          to={`/products?category=${encodeURIComponent(category.slug)}`}
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-fluid-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-lime-300 dark:hover:bg-emerald-900/60"
        >
          مشاهده همه {category.name}
          <SeeAllArrow size={14} aria-hidden="true" />
        </Link>
      </div>

      {/* Per-section results / filters / sort. */}
      <FilterSortBar
        sort={sort}
        onSortChange={setSort}
        maxPrice={maxPrice}
        priceLimit={Math.min(priceLimit, maxPrice)}
        onPriceLimitChange={(value) => setPriceLimit(value >= maxPrice ? FALLBACK_MAX_PRICE : value)}
        resultsCount={resultsCount}
        inStockOnly={inStockOnly}
        onInStockChange={setInStockOnly}
        loading={isFetching && !isLoading}
        className="mb-4"
      />

      {isLoading ? (
        <RowSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyGrid compact />
      ) : (
        <div
          ref={railDrag.ref}
            {...railDrag.handlers}
            id={`${headingId}-grid`}
            role="group"
            aria-label={`محصولات ${category.name}`}
            className={`rail-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 transition-opacity touch-pan-x ${
              isFetching ? "opacity-70" : ""
            }`}
          >
            {visible.map((product, position) => (
              <div
                key={product.id}
                className="rail-card"
              >
                <ProductCard
                  product={product}
                  // Stagger within the section only; the page-level index would
                  // delay later sections by seconds.
                  index={Math.min(position, 7)}
                  isWishlisted={wishlistIds.has(product.id)}
                  isComparing={compareIds.has(product.id)}
                  compareDisabled={compareDisabled}
                  onToggleWishlist={onToggleWishlist}
                  onAddToCart={onAddToCart}
                  onQuickView={onQuickView}
                  onToggleCompare={onToggleCompare}
                />
              </div>
          ))}
        </div>
      )}
    </section>
  );
}

function useLazyVisibility<T extends Element>(ref: React.RefObject<T | null>): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) return undefined;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible, ref]);

  return isVisible;
}

// ========================================
// Placeholders
// ========================================
function EmptyGrid({ compact = false }: { compact?: boolean }) {
  return (
    <EmptyState
      icon={SearchX}
      compact={compact}
      title="محصولی یافت نشد"
      description="فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید"
    />
  );
}

/** Same geometry as the single-row rail, so the swap-in does not move the page. */
function RowSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rail-card animate-pulse overflow-hidden rounded-xl bg-white shadow-sm dark:bg-emerald-950"
        >
          <div className="aspect-square bg-emerald-50 dark:bg-emerald-900/50" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 rounded bg-emerald-50 dark:bg-emerald-900/50" />
            <div className="h-3 w-1/2 rounded bg-emerald-50 dark:bg-emerald-900/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-4 h-6 w-32 animate-pulse rounded bg-emerald-50 dark:bg-emerald-900/50" />
      <div className="mb-4 h-14 animate-pulse rounded-2xl bg-emerald-50 dark:bg-emerald-900/50" />
      <RowSkeleton />
    </div>
  );
}
