// frontend/src/components/FilterSortBar.tsx

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownWideNarrow, Check, PackageCheck, SlidersHorizontal, X } from "lucide-react";
import { categoriesApi } from "../api/services";
import type { Category } from "../types";

// ========================================
// Types
// ========================================
export type SortOption = "popular" | "cheapest" | "expensive" | "best_rated";

interface FilterSortBarProps {
  /**
   * Category chips. Omit both to render the bar without them — the home page
   * shows one bar per category section, where a chip row would be redundant.
   */
  activeCategory?: string;
  onCategoryChange?: (id: string) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  maxPrice: number;
  priceLimit: number;
  onPriceLimitChange: (value: number) => void;
  resultsCount: number;
  inStockOnly: boolean;
  onInStockChange: (value: boolean) => void;
  /** True while the results are being (re)fetched; dims the count. */
  loading?: boolean;
  /** Extra classes on the wrapper (e.g. to drop the bottom margin). */
  className?: string;
}

// ========================================
// Sort Options Configuration
// ========================================
const sortOptions: { id: SortOption; label: string }[] = [
  { id: "popular", label: "محبوب‌ترین" },
  { id: "best_rated", label: "بیشترین امتیاز" },
  { id: "cheapest", label: "ارزان‌ترین" },
  { id: "expensive", label: "گران‌ترین" },
];

// ========================================
// FilterSortBar Component
// ========================================
export default function FilterSortBar({
  activeCategory,
  onCategoryChange,
  sort,
  onSortChange,
  maxPrice,
  priceLimit,
  onPriceLimitChange,
  resultsCount,
  inStockOnly,
  onInStockChange,
  loading = false,
  className,
}: FilterSortBarProps) {
  const showCategories = typeof onCategoryChange === 'function';
  /**
   * Only one of the two panels is ever open.
   *
   * They were independent booleans, so the floating sort dropdown could open
   * on top of the expanded filter panel and the two sets of options visually
   * merged. A single value makes them mutually exclusive, and tapping the
   * same button twice closes it.
   */
  const [panel, setPanel] = useState<"none" | "filters" | "sort">("none");
  const showFilters = panel === "filters";
  const showSortDropdown = panel === "sort";
  const togglePanel = (next: "filters" | "sort") =>
    setPanel((current) => (current === next ? "none" : next));

  // محاسبه تعداد فیلترهای فعال
  const activeFacets = [inStockOnly, priceLimit < maxPrice].filter(Boolean).length;

  // ========================================
  // دریافت دسته‌بندی‌ها از API
  // ========================================
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoriesApi.getAll();
      return response.data.results || [];
    },
    staleTime: 5 * 60 * 1000, // 5 دقیقه cache
    enabled: showCategories,
  });

  // اطمینان از اینکه categories همیشه آرایه است
  const categories: Category[] = Array.isArray(categoriesData) ? categoriesData : [];

  // ========================================
  // Handle Sort Selection
  // ========================================
  /**
   * Reset only the facets — it must not close or open any panel, otherwise
   * clearing filters visibly re-opens other menus.
   */
  function clearFacets() {
    onInStockChange(false);
    onPriceLimitChange(maxPrice);
  }

  function handleSortSelect(sortId: SortOption) {
    onSortChange(sortId);
    setPanel("none");
  }

  // ========================================
  // Get Current Sort Label
  // ========================================
  const currentSortLabel = sortOptions.find(opt => opt.id === sort)?.label || "محبوب‌ترین";

  // ========================================
  // Render
  // ========================================
  return (
    <div className={className ?? "mb-6"}>
      {/* ======================================== */}
      {/* Category Chips */}
      {/* ======================================== */}
      {showCategories && (
      <div className="no-scrollbar mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onCategoryChange("all")}
          className={`flex min-h-11 shrink-0 items-center rounded-full px-4 text-xs font-semibold transition-all ${
            activeCategory === "all"
              ? "bg-brand-gradient-accent text-white shadow-md"
              : "bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-emerald-300"
          }`}
        >
          همه محصولات
        </motion.button>

        {categoriesLoading ? (
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"></div>
            <span className="text-xs text-slate-400">در حال بارگذاری...</span>
          </div>
        ) : (
          categories.map((cat) => (
            <motion.button
              key={cat.slug}
              whileTap={{ scale: 0.95 }}
              onClick={() => onCategoryChange(cat.slug)}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-all ${
                activeCategory === cat.slug
                  ? "bg-brand-gradient-accent text-white shadow-md"
                  : "bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-emerald-300"
              }`}
            >
              {cat.name}
              {cat.product_count > 0 && (
                <span className="rounded-full bg-white/30 px-1.5 py-0.5 text-fluid-2xs">
                  {cat.product_count.toLocaleString("fa-IR")}
                </span>
              )}
            </motion.button>
          ))
        )}
      </div>
      )}

      {/* ======================================== */}
      {/* Sort + Filter Row */}
      {/* ======================================== */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800 dark:bg-emerald-950">
        {/* Results Count */}
        <p
          className={`text-xs text-slate-400 transition-opacity dark:text-emerald-300 ${loading ? "opacity-50" : ""}`}
          aria-live="polite"
        >
          <span className="font-bold text-[#0F8A5F] dark:text-lime-300">
            {resultsCount.toLocaleString("fa-IR")}
          </span>{" "}
          محصول یافت شد
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          {/* Filters Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => togglePanel("filters")}
            className={`relative flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-colors ${
              showFilters
                ? "bg-[#0F8A5F] text-white"
                : "bg-emerald-50 text-[#0F8A5F] hover:bg-emerald-100 dark:bg-emerald-900 dark:text-lime-300"
            }`}
            aria-label="فیلترها"
          >
            <SlidersHorizontal size={14} />
            فیلترها
            {activeFacets > 0 && (
              <span className="absolute -end-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-orange text-fluid-2xs font-bold text-white">
                {activeFacets}
              </span>
            )}
          </motion.button>

          {/* ======================================== */}
          {/* Sort Options - با Dropdown برای موبایل */}
          {/* ======================================== */}
          <div className="relative">
            {/* Sort Trigger Button (با آیکون فلش) */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => togglePanel("sort")}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:bg-emerald-900 dark:text-emerald-100 dark:hover:bg-emerald-800 sm:w-auto sm:justify-start"
              aria-label="مرتب‌سازی"
              aria-expanded={showSortDropdown}
            >
              <ArrowDownWideNarrow size={14} className="text-slate-400 dark:text-emerald-400" />
              <span className="whitespace-nowrap">{currentSortLabel}</span>
              <motion.span
                animate={{ rotate: showSortDropdown ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </motion.span>
            </motion.button>

            {/* Sort Dropdown Menu */}
            <AnimatePresence>
              {showSortDropdown && (
                <>
                  {/* Overlay */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setPanel("none")}
                    className="fixed inset-0 z-40"
                  />

                  {/* Dropdown */}
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute end-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-emerald-700 dark:bg-emerald-900"
                  >
                    <div className="p-1">
                      {sortOptions.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleSortSelect(opt.id)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-start text-sm font-semibold transition-colors ${
                            sort === opt.id
                              ? "bg-emerald-50 text-[#0F8A5F] dark:bg-emerald-800 dark:text-lime-300"
                              : "text-slate-700 hover:bg-slate-50 dark:text-emerald-100 dark:hover:bg-emerald-800"
                          }`}
                        >
                          <span>{opt.label}</span>
                          {sort === opt.id && (
                            <Check size={16} className="text-[#0F8A5F] dark:text-lime-300" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ======================================== */}
      {/* Filter Panel */}
      {/* ======================================== */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-900/30">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-600 dark:text-emerald-200">
                <span>فیلتر پیشرفته محصولات</span>
                <div className="flex items-center gap-1">
                  {activeFacets > 0 && (
                    <button
                      type="button"
                      onClick={clearFacets}
                      className="flex min-h-9 items-center rounded-lg px-2 text-fluid-xs font-bold text-rose-500 hover:bg-white hover:underline dark:hover:bg-emerald-950"
                    >
                      حذف همه فیلترها
                    </button>
                  )}
                <button
                  onClick={() => setPanel("none")}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 hover:text-rose-500 dark:bg-emerald-950"
                  aria-label="بستن فیلترها"
                >
                  <X size={14} />
                </button>
                </div>
              </div>

              {/* Price Range */}
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-emerald-200">
                  <span>حداکثر قیمت</span>
                  <span className="text-[#0F8A5F] dark:text-lime-300">
                    {priceLimit.toLocaleString("fa-IR")} تومان
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxPrice}
                  step={50000}
                  value={priceLimit}
                  aria-label="حداکثر قیمت"
                  aria-valuetext={`${priceLimit.toLocaleString('fa-IR')} تومان`}
                  onChange={(e) => onPriceLimitChange(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-emerald-200 accent-[#0F8A5F] dark:bg-emerald-800"
                />
              </div>

              {/* In Stock Only */}
              <button
                onClick={() => onInStockChange(!inStockOnly)}
                className={`flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                  inStockOnly
                    ? "bg-[#0F8A5F] text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-emerald-900 dark:text-emerald-300 dark:ring-emerald-700"
                }`}
                aria-label="فقط کالای موجود"
              >
                <PackageCheck size={14} />
                فقط کالای موجود
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}