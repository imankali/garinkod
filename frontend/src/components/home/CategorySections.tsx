// frontend/src/components/home/CategorySections.tsx
//
// The home catalogue, one section per category.
//
// The old layout was a single grid with category chips above it: to see the
// سم products you had to pick "سم", and then the کود products disappeared.
// A shop window should show every department at once. Each section here has
// its own heading ("سم:"), its own results/filter/sort bar and its own grid,
// and — because sorting and filtering are per section — the state for each
// lives inside the section, not in App.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { categoriesApi, productsApi } from "../../api/services";
import FilterSortBar, { type SortOption } from "../FilterSortBar";
import ProductCard from "../ProductCard";
import { useTranslation } from "../../i18n";
import type { Category, MockProduct, ProductQueryParams } from "../../types";
import { convertToMockProduct } from "../../utils/convertProduct";

/** How many products each department shows before "show more". */
const PER_SECTION = 8;

/** How many are fetched per department; beyond this, "see all" takes over. */
const PER_FETCH = 24;

/** The slider's ceiling when a section has no products yet. */
const FALLBACK_MAX_PRICE = 10_000_000;

const SORT_ORDERING: Record<SortOption, string | undefined> = {
  popular: undefined,
  cheapest: "price",
  expensive: "-price",
};

export interface CategorySectionsProps {
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
  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await categoriesApi.getAll();
      return (response.data.results || []) as Category[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Empty categories would render as a heading with "۰ محصول یافت شد" —
  // noise, not information — so only departments with stock get a section.
  const sections = useMemo(
    () => (categories ?? []).filter((category) => category.product_count > 0),
    [categories],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8" aria-busy="true">
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
  const [expanded, setExpanded] = useState(false);

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

  const visible = expanded ? filtered : filtered.slice(0, PER_SECTION);
  const hasMore = filtered.length > visible.length;
  const moreOnServer = !activeCrop && (data?.count ?? 0) > products.length;
  // Total matching this section's filters: the API count when the crop filter
  // is off, otherwise what is left after filtering client-side.
  const resultsCount = activeCrop ? filtered.length : (data?.count ?? filtered.length);
  const headingId = `home-category-${category.slug}`;
  const SeeAllArrow = dir === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <section
      aria-labelledby={headingId}
      className="scroll-mt-[calc(var(--header-height,72px)+1rem)] rounded-3xl border border-emerald-100/80 bg-white/70 p-3 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40 sm:p-5"
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
        <GridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyGrid compact />
      ) : (
        <>
          <div
            id={`${headingId}-grid`}
            className={`grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 ${
              isFetching ? "opacity-70" : ""
            }`}
          >
            {visible.map((product, position) => (
              <ProductCard
                key={product.id}
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
            ))}
          </div>

          {(hasMore || expanded || moreOnServer) && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {(hasMore || expanded) && (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="min-h-11 rounded-xl border border-emerald-200 bg-white px-5 text-fluid-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950 dark:text-lime-300 dark:hover:bg-emerald-900"
                  aria-expanded={expanded}
                  aria-controls={`${headingId}-grid`}
                >
                  {expanded
                    ? "نمایش کمتر"
                    : `نمایش ${(filtered.length - visible.length).toLocaleString("fa-IR")} محصول دیگر`}
                </button>
              )}
              {/* Everything past what was fetched lives on the catalogue page. */}
              {expanded && moreOnServer && (
                <Link
                  to={`/products?category=${encodeURIComponent(category.slug)}`}
                  className="flex min-h-11 items-center gap-1 rounded-xl bg-emerald-600 px-5 text-fluid-xs font-bold text-white transition-colors hover:bg-emerald-700"
                >
                  مشاهده همه {resultsCount.toLocaleString("fa-IR")} محصول
                  <SeeAllArrow size={14} aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ========================================
// Placeholders
// ========================================
function EmptyGrid({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-12"}`}>
      <div className={`${compact ? "text-4xl" : "text-6xl"} mb-3`} aria-hidden="true">
        🔍
      </div>
      <p className="text-fluid-sm font-bold text-slate-700 dark:text-white">محصولی یافت نشد</p>
      <p className="mt-1 text-fluid-xs text-slate-500 dark:text-emerald-300">
        فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید
      </p>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-emerald-950">
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
    <div className="rounded-3xl border border-emerald-100/80 p-5 dark:border-emerald-900" aria-hidden="true">
      <div className="mb-4 h-6 w-32 animate-pulse rounded bg-emerald-50 dark:bg-emerald-900/50" />
      <div className="mb-4 h-14 animate-pulse rounded-2xl bg-emerald-50 dark:bg-emerald-900/50" />
      <GridSkeleton />
    </div>
  );
}
