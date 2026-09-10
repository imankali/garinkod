// frontend/src/pages/shop/ShopFilterBar.tsx
//
// The shop's filter bar, shared by both of its sources.
//
// Three things are true at once here, and each one is a bug this page used to
// have:
//
// * **Compact.** Four dropdown buttons and a search field, instead of four rows
//   of scrolling chips. The catalogue is deep; the bar above it no longer has to be.
// * **Multi-select.** Categories, brands and package sizes take more than one
//   value, written to the URL as a comma-separated list — the same grammar the
//   API was extended to read, so «کود و سم» is one request, not two pages.
// * **One bar for both tabs.** آگهی‌های غرفه‌داران used to ignore everything except
//   price and stock, which is why the page also carried a filter *sidebar* that
//   only worked on the other tab. Both sources now speak the same parameters, so
//   the sidebar is gone and the ad tab gets the same controls.
//
// Sorting is the one axis that is *not* free to combine: «ارزان‌ترین» and
// «گران‌ترین» together is a contradiction, so picking one dims the other rather
// than silently dropping it — while the compatible sorts (ارزان‌ترین +
// پرفروش‌ترین + پربازدیدترین) stack into a real multi-key ORDER BY.

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Star } from 'lucide-react';

import { FilterShell, MultiSelectFacet, type FacetOption } from '../../components/shop/FilterPopover';
import { cn } from '../../utils/cn';

export interface SortOption {
  value: string;
  label: string;
  /** The other direction of the same axis: it cannot be selected alongside this. */
  conflictsWith?: string;
}

export interface ShopFilters {
  category: string;
  subcategory: string;
  brand: string;
  pack: string;
  ordering: string;
  search: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  features: string[];
}

export const EMPTY_FILTERS: ShopFilters = {
  category: '',
  subcategory: '',
  brand: '',
  pack: '',
  ordering: '',
  search: '',
  minPrice: '',
  maxPrice: '',
  minRating: '',
  features: [],
};

export interface ShopFacets {
  categories: FacetOption[];
  subcategories: FacetOption[];
  brands: FacetOption[];
  packages: FacetOption[];
  maxPrice: number;
}

export const EMPTY_FACETS: ShopFacets = {
  categories: [],
  subcategories: [],
  brands: [],
  packages: [],
  maxPrice: 0,
};

/** `?category=a,b` in, an array out — the URL is the single source of truth. */
export function readCsv(value: string | undefined): string[] {
  if (!value) return [];
  const seen: string[] = [];
  value.split(',').forEach((item) => {
    const trimmed = item.trim();
    if (trimmed && !seen.includes(trimmed)) seen.push(trimmed);
  });
  return seen;
}

export function writeCsv(values: string[]): string {
  return values.join(',');
}

export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Packaging is a text facet on both models, under two names. */
export const PACK_PARAM: Record<'products' | 'marketplace', string> = {
  products: 'package_weight',
  marketplace: 'package_size',
};

const RATING_FLOORS = [
  { value: '4', label: '۴ ستاره و بالاتر' },
  { value: '3', label: '۳ ستاره و بالاتر' },
];

export interface ShopFilterBarProps {
  source: 'products' | 'marketplace';
  facets: ShopFacets;
  filters: ShopFilters;
  sorts: SortOption[];
  features: Array<{ key: string; label: string }>;
  /** The page owns the query string; this writes a patch into it. */
  onChange: (patch: Record<string, string | undefined>) => void;
  onReset: () => void;
  /** Rendered at the end of the bar (page size, a link to the category page…). */
  trailing?: React.ReactNode;
}

export default function ShopFilterBar({
  source,
  facets,
  filters,
  sorts,
  features,
  onChange,
  onReset,
  trailing,
}: ShopFilterBarProps) {
  const [term, setTerm] = useState(filters.search);
  const [showPrice, setShowPrice] = useState(Boolean(filters.minPrice || filters.maxPrice));
  const [low, setLow] = useState(filters.minPrice);
  const [high, setHigh] = useState(filters.maxPrice);

  // Back, forward and «حذف همه» all change the URL, so the inputs follow it —
  // but never while the buyer is mid-typing in that very field.
  useEffect(() => {
    setTerm(filters.search);
  }, [filters.search]);
  useEffect(() => {
    if (!showPrice) {
      setLow(filters.minPrice);
      setHigh(filters.maxPrice);
    }
  }, [filters.minPrice, filters.maxPrice, showPrice]);

  /*
    The parsed filters, memoised on the query string rather than recomputed on
    every render. The lists below are handed to child memos and to `selected`
    props, and a fresh array identity each render would invalidate all of them —
    the URL changes when a filter changes, and nothing else.
  */
  const categories = useMemo(() => readCsv(filters.category), [filters.category]);
  const subcategories = useMemo(() => readCsv(filters.subcategory), [filters.subcategory]);
  const brands = useMemo(() => readCsv(filters.brand), [filters.brand]);
  const packs = useMemo(() => readCsv(filters.pack), [filters.pack]);
  const orderings = useMemo(() => readCsv(filters.ordering), [filters.ordering]);

  const setCategory = (value: string) =>
    onChange({ category: writeCsv(toggleInList(categories, value)) || undefined, page: undefined });
  const setSubcategory = (value: string) =>
    onChange({ subcategory: writeCsv(toggleInList(subcategories, value)) || undefined, page: undefined });
  const setBrand = (value: string) =>
    onChange({ brand: writeCsv(toggleInList(brands, value)) || undefined, page: undefined });
  const setPack = (value: string) =>
    onChange({ [PACK_PARAM[source]]: writeCsv(toggleInList(packs, value)) || undefined, page: undefined });
  const setOrdering = (value: string) => {
    const conflicts = sorts.find((sort) => sort.value === value)?.conflictsWith;
    onChange({
      ordering: writeCsv(toggleInList(orderings, value).filter((item) => item !== conflicts)) || undefined,
      page: undefined,
    });
  };

  // Only the sub-departments of what is already chosen: a flat list of every
  // subcategory in the site is a list nobody reads, and it can name a
  // combination the department filter would then contradict.
  const subcategoryOptions = useMemo(
    () =>
      categories.length === 0
        ? []
        : facets.subcategories.filter((option) => !option.category || categories.includes(option.category)),
    [categories, facets.subcategories],
  );

  const labelOf = (options: FacetOption[], value: string) =>
    options.find((option) => option.value === value)?.label || value;

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [
    ...categories.map((value) => ({
      key: `category:${value}`,
      label: labelOf(facets.categories, value),
      onRemove: () => setCategory(value),
    })),
    ...subcategories.map((value) => ({
      key: `subcategory:${value}`,
      label: labelOf(facets.subcategories, value),
      onRemove: () => setSubcategory(value),
    })),
    ...brands.map((value) => ({ key: `brand:${value}`, label: value, onRemove: () => setBrand(value) })),
    ...packs.map((value) => ({ key: `pack:${value}`, label: value, onRemove: () => setPack(value) })),
    ...orderings.map((value) => ({
      key: `ordering:${value}`,
      label: sorts.find((sort) => sort.value === value)?.label || value,
      onRemove: () => setOrdering(value),
    })),
    ...features
      .filter((feature) => filters.features.includes(feature.key))
      .map((feature) => ({
        key: `feature:${feature.key}`,
        label: feature.label,
        onRemove: () => onChange({ [feature.key]: undefined, page: undefined }),
      })),
    ...(filters.minRating
      ? [{
        key: 'rating',
        label: RATING_FLOORS.find((floor) => floor.value === filters.minRating)?.label || 'امتیاز',
        onRemove: () => onChange({ min_rating: undefined, page: undefined }),
      }]
      : []),
    ...(filters.minPrice || filters.maxPrice
      ? [{
        key: 'price',
        label: `قیمت ${filters.minPrice ? Number(filters.minPrice).toLocaleString('fa-IR') : '۰'} تا ${filters.maxPrice ? Number(filters.maxPrice).toLocaleString('fa-IR') : 'نامحدود'}`,
        onRemove: () => {
          setLow('');
          setHigh('');
          onChange({ min_price: undefined, max_price: undefined, page: undefined });
        },
      }]
      : []),
    ...(filters.search
      ? [{
        key: 'search',
        label: `«${filters.search}»`,
        onRemove: () => {
          setTerm('');
          onChange({ search: undefined, page: undefined });
        },
      }]
      : []),
  ];

  const activeFeatureKeys = features.map((feature) => feature.key);

  return (
    <div className="mt-5 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFacet
          label="دسته‌بندی محصولات"
          options={facets.categories}
          selected={categories}
          onToggle={setCategory}
          onClear={() => onChange({ category: undefined, subcategory: undefined, page: undefined })}
        />

        {subcategoryOptions.length > 0 && (
          <MultiSelectFacet
            label="زیردسته"
            options={subcategoryOptions}
            selected={subcategories}
            onToggle={setSubcategory}
            onClear={() => onChange({ subcategory: undefined, page: undefined })}
          />
        )}

        <SortFacet
          sorts={sorts}
          selected={orderings}
          onToggle={setOrdering}
          onClear={() => onChange({ ordering: undefined, page: undefined })}
        />

        {facets.brands.length > 1 && (
          <MultiSelectFacet
            label="برندها"
            options={facets.brands}
            selected={brands}
            onToggle={setBrand}
            onClear={() => onChange({ brand: undefined, page: undefined })}
          />
        )}

        {facets.packages.length > 1 && (
          <MultiSelectFacet
            label="بسته‌بندی"
            options={facets.packages}
            selected={packs}
            onToggle={setPack}
            onClear={() => onChange({ [PACK_PARAM[source]]: undefined, page: undefined })}
          />
        )}

        {(activeFeatureKeys.length > 0 || source === 'products') && (
          <FeatureFacet
            features={features.filter((feature) => activeFeatureKeys.includes(feature.key))}
            active={filters.features}
            onToggle={(key) => onChange({ [key]: filters.features.includes(key) ? undefined : '1', page: undefined })}
            onClear={() => onChange(Object.fromEntries(activeFeatureKeys.map((key) => [key, undefined])))}
            rating={source === 'products' ? filters.minRating : ''}
            ratingVisible={source === 'products'}
            onRating={(value) => onChange({ min_rating: value || undefined, page: undefined })}
          />
        )}

        <button
          type="button"
          aria-expanded={showPrice}
          onClick={() => setShowPrice((value) => !value)}
          className={cn(
            'flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-fluid-xs font-bold transition-colors',
            filters.minPrice || filters.maxPrice
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/60 dark:text-lime-200'
              : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100',
          )}
        >
          محدوده قیمت
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cn('transition-transform duration-200', showPrice && 'rotate-180')}
          />
        </button>

        <form
          className="flex min-w-40 flex-1 items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            onChange({ search: term.trim() || undefined, page: undefined });
          }}
        >
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={source === 'marketplace' ? 'جست‌وجو در آگهی‌ها' : 'جست‌وجو در همین فهرست'}
            aria-label={source === 'marketplace' ? 'جست‌وجو در آگهی‌ها' : 'جست‌وجو در همین فهرست'}
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-fluid-xs font-semibold outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-50"
          />
          <button
            type="submit"
            className="min-h-11 shrink-0 rounded-lg bg-emerald-600 px-3 text-fluid-xs font-bold text-white transition-colors hover:bg-emerald-700"
          >
            جست‌وجو
          </button>
        </form>

        {trailing}
      </div>

      {showPrice && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/40"
          onSubmit={(event) => {
            event.preventDefault();
            onChange({
              min_price: low.trim() || undefined,
              max_price: high.trim() || undefined,
              page: undefined,
            });
          }}
        >
          <label className="w-36 text-fluid-2xs font-bold text-slate-400">
            حداقل قیمت (تومان)
            <input
              type="number"
              min={0}
              value={low}
              onChange={(event) => setLow(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-fluid-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50"
            />
          </label>
          <label className="w-36 text-fluid-2xs font-bold text-slate-400">
            حداکثر قیمت (تومان)
            <input
              type="number"
              min={0}
              value={high}
              onChange={(event) => setHigh(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-fluid-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-emerald-600 px-4 text-fluid-xs font-bold text-white transition-colors hover:bg-emerald-700"
          >
            اعمال محدوده
          </button>
          {facets.maxPrice > 0 && (
            <span className="pb-2 text-fluid-2xs text-slate-400">
              بالاترین قیمت این فهرست: {facets.maxPrice.toLocaleString('fa-IR')} تومان
            </span>
          )}
        </form>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="فیلترهای فعال">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex min-h-8 items-center gap-1 rounded-full bg-emerald-50 px-2.5 text-fluid-2xs font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-lime-200"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`حذف ${chip.label}`}
                className="rounded-full p-0.5 transition-colors hover:bg-emerald-200/70 dark:hover:bg-emerald-800"
              >
                ✕
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-8 items-center rounded-full px-2.5 text-fluid-2xs font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            حذف همه فیلترها
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The sort dropdown, written apart from the other facets on purpose.
 *
 * Compatible sorts stack (ارزان‌ترین + پرفروش‌ترین is a real two-key ORDER BY) but
 * an opposite pair cannot, and a buyer has to be *shown* that: the conflicting
 * row is dimmed and inert rather than quietly removed, so the rule is visible
 * where it applies instead of being discovered by trial and error.
 */
function SortFacet({
  sorts,
  selected,
  onToggle,
  onClear,
}: {
  sorts: SortOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const blocked = useMemo(() => {
    const taken = new Set<string>();
    selected.forEach((value) => {
      const conflict = sorts.find((sort) => sort.value === value)?.conflictsWith;
      if (conflict) taken.add(conflict);
    });
    return taken;
  }, [selected, sorts]);

  const summary = selected.length
    ? `${sorts.find((sort) => sort.value === selected[0])?.label || 'مرتب‌سازی'}${selected.length > 1 ? ` +${(selected.length - 1).toLocaleString('fa-IR')}` : ''}`
    : undefined;

  return (
    <FilterShell label="مرتب‌سازی" active={selected.length > 0} summary={summary} width="w-64">
      <ul className="space-y-0.5">
        {sorts.map((sort) => {
          const isSelected = selected.includes(sort.value);
          const isBlocked = blocked.has(sort.value);
          return (
            <li key={sort.value}>
              <button
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                // The opposite of a chosen sort is not "off", it is unavailable —
                // and a disabled control says so to a screen reader too.
                disabled={isBlocked}
                onClick={() => onToggle(sort.value)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-start text-fluid-xs font-bold transition-colors',
                  isSelected && 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/60 dark:text-lime-200',
                  !isSelected && !isBlocked && 'text-slate-600 hover:bg-slate-50 dark:text-emerald-100 dark:hover:bg-emerald-900/40',
                  isBlocked && 'cursor-not-allowed text-slate-300 dark:text-emerald-800',
                )}
                title={isBlocked ? 'این گزینه با مرتب‌سازی انتخاب‌شده در تضاد است' : undefined}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                    isSelected
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-300 dark:border-emerald-700',
                  )}
                >
                  {isSelected ? <Check size={13} strokeWidth={3} /> : null}
                </span>
                <span className="flex-1">{sort.label}</span>
                {isBlocked && <span className="text-fluid-2xs">تضاد</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {selected.length > 0 && (
        <div className="mt-1 border-t border-slate-100 pt-2 dark:border-emerald-800/70">
          <button
            type="button"
            onClick={onClear}
            className="min-h-9 rounded-lg px-2 text-fluid-2xs font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            حذف مرتب‌سازی‌ها
          </button>
        </div>
      )}
    </FilterShell>
  );
}

/** The flags a buyer toggles, plus the star floor — one button, one panel. */
function FeatureFacet({
  features,
  active,
  onToggle,
  onClear,
  rating,
  ratingVisible,
  onRating,
}: {
  features: Array<{ key: string; label: string }>;
  active: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
  rating: string;
  ratingVisible: boolean;
  onRating: (value: string) => void;
}) {
  const count = active.length + (ratingVisible && rating ? 1 : 0);
  return (
    <FilterShell
      label="امکانات"
      active={count > 0}
      badge={count}
      summary={count === 1 ? features.find((feature) => feature.key === active[0])?.label : undefined}
      width="w-64"
    >
      <ul className="space-y-0.5">
        {features.map((feature) => {
          const isChecked = active.includes(feature.key);
          return (
            <li key={feature.key}>
              <button
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                onClick={() => onToggle(feature.key)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-start text-fluid-xs font-bold transition-colors',
                  isChecked
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/60 dark:text-lime-200'
                    : 'text-slate-600 hover:bg-slate-50 dark:text-emerald-100 dark:hover:bg-emerald-900/40',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                    isChecked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 dark:border-emerald-700',
                  )}
                >
                  {isChecked ? <Check size={13} strokeWidth={3} /> : null}
                </span>
                {feature.label}
              </button>
            </li>
          );
        })}
      </ul>

      {ratingVisible && (
        <div className="mt-1 space-y-1 border-t border-slate-100 pt-2 dark:border-emerald-800/70">
          <p className="px-2 text-fluid-2xs font-bold text-slate-400">حداقل امتیاز</p>
          {RATING_FLOORS.map((floor) => (
            <button
              key={floor.value}
              type="button"
              role="checkbox"
              aria-checked={rating === floor.value}
              onClick={() => onRating(rating === floor.value ? '' : floor.value)}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-start text-fluid-xs font-bold transition-colors',
                rating === floor.value
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-emerald-100 dark:hover:bg-emerald-900/40',
              )}
            >
              <Star
                size={14}
                aria-hidden="true"
                className={rating === floor.value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
              />
              {floor.label}
            </button>
          ))}
        </div>
      )}

      {count > 0 && (
        <div className="mt-1 border-t border-slate-100 pt-2 dark:border-emerald-800/70">
          <button
            type="button"
            onClick={onClear}
            className="min-h-9 rounded-lg px-2 text-fluid-2xs font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            برداشتن این گزینه‌ها
          </button>
        </div>
      )}
    </FilterShell>
  );
}
