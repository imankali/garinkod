// frontend/src/components/SearchBar.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Search, X, Clock, SlidersHorizontal,
  PackageCheck, Mic, Sparkles, Tag, Flame, ImagePlus,
  CheckCircle2, AlertCircle, Leaf, Loader2
} from "lucide-react";
import { categories } from "../data/shopData";
import { productsApi, trustApi } from "../api/services";
import { useTranslation } from "../i18n";
import { formatPrice } from "../utils/formatPrice";
import type { ProductList, MockProduct, VisualDiagnosis } from "../types";

// ========================================
// Types
// ========================================
interface SearchBarProps {
  variant?: "desktop" | "mobile";
  onSelectProduct?: (product: MockProduct) => void;
}

// ========================================
// Helper: تبدیل محصول API به فرمت UI
// ========================================
function convertProduct(apiProduct: ProductList): MockProduct {
  return {
    id: apiProduct.id,
    slug: apiProduct.slug,
    name: apiProduct.title,
    category: typeof apiProduct.category === 'string' ? apiProduct.category : 'کود کشاورزی',
    categoryId: 'fertilizer',
    subCategoryId: '',
    brand: 'گرین کود',
    price: apiProduct.price,
    rating: 0,
    reviews: 0,
    image: apiProduct.image_url || '/images/hero-farm.jpg',
    inStock: apiProduct.is_in_stock,
    description: '',
    features: [],
    cropTags: [],
    pestTags: [],
    usage: {
      dosage: '',
      method: '',
      timing: '',
    },
    warnings: [],
    compatibleWith: [],
    brochureAvailable: false,
  };
}

// ========================================
// Debounce Hook
// ========================================
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ========================================
// Trending Searches
// ========================================
const trendingSearches = [
  "کود اوره",
  "سم علف‌کش",
  "بذر گوجه گلخانه‌ای",
  "سمپاش موتوری",
  "کود مایع هیومیک",
  "نهال پیوندی",
];

// ========================================
// SearchBar Component
// ========================================
export default function SearchBar({ variant = "desktop", onSelectProduct }: SearchBarProps) {
  const { locale, t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [isListening, setIsListening] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);

  /**
   * Only one panel is ever open.
   *
   * The suggestions dropdown and the advanced-filter panel used to be two
   * independent booleans, so both could be open at once and the floating
   * dropdown rendered straight on top of the filter chips — the "options
   * stacked into each other" problem. A single value makes them mutually
   * exclusive by construction: opening one closes the other.
   */
  const [panel, setPanel] = useState<"none" | "suggestions" | "filters">("none");
  const isFocused = panel === "suggestions";
  const showAdvanced = panel === "filters";
  const openSuggestions = () => setPanel("suggestions");
  /** دکمه فیلتر: بار اول باز، بار دوم بسته. */
  const toggleFilters = () => setPanel((current) => (current === "filters" ? "none" : "filters"));

  /** بدون callback، کلیک روی نتیجه مستقیماً به صفحه محصول می‌رود. */
  function openProduct(product: MockProduct) {
    if (onSelectProduct) {
      onSelectProduct(product);
      return;
    }
    if (product.slug) {
      navigate(`/products/${product.slug}`);
    }
  }

  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('recentSearches');
      return stored ? JSON.parse(stored) : ["کود اوره", "بذر خیار گلخانه‌ای"];
    } catch {
      return ["کود اوره", "بذر خیار گلخانه‌ای"];
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageSearchRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // ========================================
  // ذخیره جستجوهای اخیر در localStorage
  // ========================================
  useEffect(() => {
    localStorage.setItem('recentSearches', JSON.stringify(recent));
  }, [recent]);

  // ========================================
  // دریافت محصولات از API
  // ========================================
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, activeCategory, inStockOnly],
    queryFn: async () => {
      const params: any = {};

      if (debouncedQuery.trim()) {
        params.search = debouncedQuery;
      }

      if (activeCategory !== 'all') {
        params.category = activeCategory;
      }

      if (inStockOnly) {
        params.in_stock = true;
      }

      const response = await productsApi.getAll({ ...params, page: 1 });
      return response.data.results.map(convertProduct);
    },
    enabled: debouncedQuery.trim().length > 0 || activeCategory !== 'all' || inStockOnly,
    staleTime: 30000,
  });

  // ========================================
  // بستن dropdown هنگام کلیک بیرون
  // ========================================
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPanel("none");
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPanel("none");
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  // ========================================
  // محاسبات
  // ========================================
  const activeFacetCount = [inStockOnly].filter(Boolean).length;

  const filteredProducts: MockProduct[] = useMemo(
    () => (searchResults || []).slice(0, 8),
    [searchResults]
  );

  // ========================================
  // Handlers
  // ========================================
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim() && !recent.includes(query.trim())) {
      setRecent((prev) => [query.trim(), ...prev].slice(0, 8));
    }
    openSuggestions();
  }

  /**
   * Clear the facets without changing which panel is on screen.
   *
   * Previously this also re-opened the suggestions dropdown, so "clear all
   * filters" popped other panels open — the behaviour reported as filters
   * re-opening themselves. Clearing now only clears.
   */
  function resetFacets() {
    setInStockOnly(false);
    setActiveCategory("all");
  }

  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<VisualDiagnosis | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);

  async function handleImageSearch(event: React.ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    if (!image) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 5 * 1024 * 1024) {
      toast.error('تصویر باید JPG، PNG یا WebP و حداکثر ۵ مگابایت باشد.');
      event.target.value = '';
      return;
    }
    setAnalyzingImage(true);
    const previewUrl = URL.createObjectURL(image);
    setUploadedPreview(previewUrl);
    try {
      const response = await trustApi.visualSearch(image, 'pest');
      if (response.data.diagnosis) {
        setDiagnosisResult(response.data.diagnosis);
        toast.success(response.data.message);
      } else {
        toast(response.data.message);
      }
    } catch {
      // The API client displays the failure message.
    } finally {
      setAnalyzingImage(false);
      event.target.value = '';
    }
  }

  function toggleVoiceSearch() {
    if (isListening) {
      setIsListening(false);
      return;
    }
    setIsListening(true);
    openSuggestions();

    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = locale === 'fa' ? 'fa-IR' : locale === 'ar' ? 'ar-SA' : 'en-US';
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setQuery(transcript);
          setIsListening(false);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
        return;
      } catch {
        setIsListening(false);
        toast.error("شروع جستجوی صوتی ممکن نشد؛ لطفاً عبارت خود را تایپ کنید.");
        return;
      }
    }

    setIsListening(false);
    toast("جستجوی صوتی در این مرورگر پشتیبانی نمی‌شود.");
  }

  function handleQuickFilter(filterType: string, value: any) {
    switch (filterType) {
      case 'inStock':
        setInStockOnly(!inStockOnly);
        break;
      case 'category':
        setActiveCategory(value);
        break;
    }
    // Stay in whichever panel the tap came from instead of forcing the
    // suggestions dropdown open on top of the filter chips.
  }

  // ========================================
  // Render
  // ========================================
  return (
    <motion.div
      ref={containerRef}
      // فیلد جستجو روی دسکتاپ عمداً بدون سقف عرض است تا تمام فضای آزاد
      // ردیف هدر را بگیرد؛ قبلاً max-w-2xl آن را نصف عرض ممکن نگه می‌داشت.
      className={`relative w-full ${variant === "desktop" ? "max-w-none" : ""}`}
      layout
    >
      <motion.form
        onSubmit={handleSubmit}
        className={`group flex items-stretch rounded-2xl border-2 bg-white shadow-sm transition-colors duration-300 dark:bg-emerald-950 ${
          isFocused
            ? "border-[#0F8A5F] shadow-lg shadow-emerald-100 ring-4 ring-emerald-100/50 dark:shadow-none dark:ring-emerald-900/50"
            : "border-emerald-100 hover:border-emerald-300 dark:border-emerald-900/60"
        }`}
      >
        {/* Search Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={openSuggestions}
          placeholder={isListening ? "در حال شنیدن صدای شما..." : t("header.searchPlaceholder")}
          className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-emerald-400 md:py-3.5 md:text-base"
          aria-label="جستجوی محصولات"
        />

        <input ref={imageSearchRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageSearch} className="hidden" aria-label="انتخاب تصویر برای جستجو" />

        {/* Visual search queues the image for the verified server-side pipeline. */}
        <button
          type="button"
          onClick={() => imageSearchRef.current?.click()}
          disabled={analyzingImage}
          title="تشخیص هوشمند آفت، بیماری و محصول با تصویر"
          className="flex min-h-11 min-w-11 items-center justify-center text-slate-400 transition-colors hover:text-[#0F8A5F] dark:text-emerald-400 dark:hover:text-lime-300 disabled:opacity-50"
          aria-label="تشخیص هوشمند آفت، بیماری و محصول با تصویر"
        >
          {analyzingImage ? <Loader2 size={18} className="animate-spin text-emerald-600" /> : <ImagePlus size={18} />}
        </button>

        {/* Voice Search Button */}
        <button
          type="button"
          onClick={toggleVoiceSearch}
          title="جستجوی صوتی به زبان فارسی"
          className={`relative flex min-h-11 min-w-11 items-center justify-center transition-colors ${
            isListening
              ? "text-rose-500"
              : "text-slate-400 hover:text-[#0F8A5F] dark:text-emerald-400 dark:hover:text-lime-300"
          }`}
          aria-label="جستجوی صوتی"
        >
          {isListening && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-6 w-6 animate-ping rounded-full bg-rose-400 opacity-60" />
            </span>
          )}
          <Mic size={18} className="relative z-10" />
        </button>

        {/* Clear Button */}
        {query && (
          <button type="button" onClick={() => setQuery("")} className="flex min-h-11 min-w-9 items-center justify-center text-slate-400 hover:text-slate-600" aria-label="پاک کردن جستجو">
            <X size={16} />
          </button>
        )}

        {/* Advanced Filters Button — toggles an inline panel below the bar so it
            works reliably on touch screens where the floating dropdown can be
            clipped or hard to reach. */}
        <button
          type="button"
          onClick={toggleFilters}
          aria-expanded={showAdvanced}
          className={`relative flex min-h-11 items-center gap-1 border-s border-emerald-100 px-3 text-slate-500 transition-colors hover:text-[#0F8A5F] dark:border-emerald-900 dark:text-emerald-400 ${
            showAdvanced ? "bg-emerald-50 text-[#0F8A5F] dark:bg-emerald-900/60 dark:text-lime-300" : ""
          }`}
          aria-label="فیلترهای پیشرفته"
        >
          <SlidersHorizontal size={16} />
          {activeFacetCount > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-orange text-fluid-2xs font-bold text-white">
              {activeFacetCount}
            </span>
          )}
        </button>

        {/* Submit Button */}
        <motion.button
          type="submit"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="relative flex items-center gap-1.5 overflow-hidden rounded-2xl bg-brand-gradient-accent px-4 text-white md:px-6"
        >
          <Search size={18} className="drop-shadow" />
          <span className="hidden text-sm font-medium md:inline">جستجو</span>
        </motion.button>
      </motion.form>

      {/* ======================================== */}
      {/* Advanced Filters Panel
          یک پنل شناور دقیقاً زیر نوار جستجو — چون هدر sticky است، پنل درون
          جریان صفحه ارتفاع هدر را تغییر می‌داد و کل صفحه می‌پرید. */}
      {/* ======================================== */}
      <AnimatePresence initial={false}>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute start-0 top-[calc(100%+10px)] z-50 max-h-[70dvh] w-full overflow-y-auto overscroll-contain rounded-2xl shadow-2xl shadow-emerald-900/10"
          >
            <div className="rounded-2xl border border-emerald-100 bg-white/95 p-3 backdrop-blur-xl dark:border-emerald-800 dark:bg-emerald-950/95">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-600 dark:text-emerald-100">فیلتر تخصصی جستجو</p>
                <button
                  type="button"
                  onClick={resetFacets}
                  className="text-fluid-xs font-bold text-rose-500 hover:underline"
                >
                  حذف همه فیلترها
                </button>
              </div>

              {/* Quick Filters */}
              <div className="mb-3">
                <p className="mb-1.5 text-fluid-xs font-semibold text-slate-500 dark:text-emerald-300">فیلترهای سریع</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickFilter('inStock', null)}
                    className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-fluid-xs font-semibold transition-colors ${
                      inStockOnly
                        ? "bg-[#0F8A5F] text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-emerald-900 dark:text-emerald-100 dark:ring-emerald-800"
                    }`}
                  >
                    <PackageCheck size={13} /> فقط کالای موجود
                  </button>
                </div>
              </div>

              {/* Categories */}
              <div>
                <p className="mb-1.5 text-fluid-xs font-semibold text-slate-500 dark:text-emerald-300">دسته‌بندی‌ها</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.slice(0, 6).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleQuickFilter('category', cat.id)}
                      className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-fluid-xs font-semibold transition-colors ${
                        activeCategory === cat.id
                          ? "bg-[#0F8A5F] text-white"
                          : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-emerald-900 dark:text-emerald-100 dark:ring-emerald-800"
                      }`}
                    >
                      <cat.icon size={12} />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* نتایج زنده فیلترها */}
              {activeFacetCount > 0 && searchResults && searchResults.length > 0 && (
                <div className="mt-3 border-t border-emerald-100 pt-3 dark:border-emerald-800">
                  <p className="mb-2 text-fluid-xs font-semibold text-slate-500 dark:text-emerald-300">
                    نتایج فیلتر ({filteredProducts.length})
                  </p>
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {filteredProducts.map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => openProduct(product)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs text-slate-600 transition hover:bg-white dark:text-emerald-100 dark:hover:bg-emerald-900"
                        >
                          <img src={product.image} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                          <span className="line-clamp-1 flex-1">{product.name}</span>
                          <span className="shrink-0 font-bold text-emerald-700 dark:text-lime-300">
                            {product.price.toLocaleString('fa-IR')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================== */}
      {/* Dropdown Results */}
      {/* ======================================== */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute start-0 top-[calc(100%+10px)] z-50 max-h-[70dvh] w-full overflow-y-auto rounded-2xl border border-emerald-100 bg-white/95 p-3 shadow-2xl shadow-emerald-900/10 backdrop-blur-xl dark:border-emerald-800 dark:bg-emerald-950/95"
          >
            {/* Voice Search Listening Indicator */}
            {isListening && (
              <div className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                <span className="h-2 w-2 animate-ping rounded-full bg-rose-500" />
                لطفاً نام محصول یا آفت مورد نظر خود را به فارسی بگویید...
              </div>
            )}

            {/* ======================================== */}
            {/* Dropdown Content */}
            {/* ======================================== */}
            {query.trim().length === 0 && activeFacetCount === 0 ? (
              <div className="space-y-4">
                {/* Trending Searches */}
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <Flame size={13} className="text-orange-500" /> پرطرفدارترین جستجوها
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {trendingSearches.map((term) => (
                      <button
                        key={term}
                        onClick={() => {
                          setQuery(term);
                          if (!recent.includes(term)) {
                            setRecent((prev) => [term, ...prev].slice(0, 8));
                          }
                        }}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 transition-all hover:bg-emerald-100 hover:shadow-sm dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-lime-300"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Popular Categories */}
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <Tag size={13} /> دسته‌بندی‌های محبوب
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-emerald-100 hover:text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200"
                      >
                        <cat.icon size={12} />
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recent Searches */}
                {recent.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                      <Clock size={13} /> جستجوهای اخیر
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recent.map((term) => (
                        <button
                          key={term}
                          onClick={() => setQuery(term)}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 transition-colors hover:bg-emerald-100 hover:text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Guide */}
                <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-lime-50 p-3 dark:from-emerald-900/30 dark:to-lime-900/30">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-lime-300">
                    <Sparkles size={12} /> راهنمای جستجو
                  </p>
                  <ul className="space-y-1 text-fluid-xs text-slate-600 dark:text-emerald-200">
                    <li>• برای جستجوی دقیق، نام کامل محصول را وارد کنید</li>
                    <li>• از فیلترهای پیشرفته برای محدود کردن نتایج استفاده کنید</li>
                    <li>• با کلیک روی 🎤 جستجوی صوتی انجام دهید</li>
                  </ul>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div>
                {/* Results Header */}
                <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-emerald-800">
                  <p className="text-xs font-semibold text-slate-500 dark:text-emerald-300">
                    {filteredProducts.length} نتیجه یافت شد
                  </p>
                  {activeFacetCount > 0 && (
                    <button onClick={resetFacets} className="text-fluid-2xs text-rose-500 hover:underline">
                      حذف فیلترها
                    </button>
                  )}
                </div>

                {/* Results List */}
                <ul className="max-h-80 space-y-1 overflow-y-auto">
                  {filteredProducts.map((product) => (
                    <li key={product.id}>
                      <button
                        onClick={() => {
                          openProduct(product);
                          setPanel("none");
                        }}
                        className="flex w-full items-center gap-3 rounded-xl p-2 text-start transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/50"
                      >
                        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-emerald-50">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/hero-farm.jpg';
                            }}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-700 dark:text-white">{product.name}</span>
                          <span className="block text-xs text-slate-400">
                            {product.brand} · {product.category}
                          </span>
                        </span>
                        {!product.inStock && (
                          <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-fluid-2xs font-bold text-rose-500">
                            ناموجود
                          </span>
                        )}
                        <span className="shrink-0 text-xs font-semibold text-[#0F8A5F] dark:text-lime-300">
                          {product.price.toLocaleString("fa-IR")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="text-3xl">🔍</span>
                <p className="text-sm text-slate-500">نتیجه‌ای یافت نشد.</p>
                <p className="text-xs text-slate-400">فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید</p>
                {activeFacetCount > 0 && (
                  <button
                    onClick={resetFacets}
                    className="mt-2 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-lime-300"
                  >
                    حذف فیلترها
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Diagnosis Result Modal */}
      <AnimatePresence>
        {diagnosisResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="نتیجه تشخیص هوشمند آفت و بیماری"
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl dark:border-emerald-900 dark:bg-emerald-950 sm:p-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-emerald-900">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
                    <Leaf size={18} />
                  </span>
                  <div>
                    <h3 className="text-fluid-base font-extrabold text-slate-800 dark:text-white">
                      تشخیص هوشمند گیاه‌پزشکی
                    </h3>
                    <p className="text-fluid-2xs text-slate-500 dark:text-emerald-300">
                      تحلیل تصویر مزرعه و برگ
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDiagnosisResult(null);
                    setUploadedPreview(null);
                  }}
                  className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 dark:bg-emerald-900 dark:text-white"
                  aria-label="بستن"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Uploaded Preview & Diagnosis Heading */}
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                {uploadedPreview && (
                  <img
                    src={uploadedPreview}
                    alt="تصویر ارسالی"
                    width={100}
                    height={100}
                    className="h-24 w-24 shrink-0 rounded-2xl object-cover ring-2 ring-emerald-500/30"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-fluid-2xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-lime-200">
                      {diagnosisResult.category === 'healthy' ? 'گیاه سالم' : 'عارضه / آفت'}
                    </span>
                    <span className="text-fluid-2xs font-semibold text-slate-400">
                      دقت ارزیابی: {diagnosisResult.confidence_percent.toLocaleString('fa-IR')}٪
                    </span>
                  </div>
                  <h4 className="mt-1 text-fluid-lg font-extrabold text-slate-800 dark:text-white">
                    {diagnosisResult.title}
                  </h4>
                </div>
              </div>

              {/* Symptoms */}
              {diagnosisResult.symptoms.length > 0 && (
                <div className="mt-4 rounded-2xl bg-amber-50/70 p-3.5 dark:bg-amber-950/30">
                  <p className="flex items-center gap-1.5 text-fluid-xs font-bold text-amber-900 dark:text-amber-200">
                    <AlertCircle size={14} />
                    نشانه‌ها و علائم شناسایی‌شده:
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pe-4 text-fluid-2xs leading-5 text-amber-800 dark:text-amber-300">
                    {diagnosisResult.symptoms.map((symptom, idx) => (
                      <li key={idx}>{symptom}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              <div className="mt-3 rounded-2xl bg-emerald-50/70 p-3.5 dark:bg-emerald-900/40">
                <p className="flex items-center gap-1.5 text-fluid-xs font-bold text-emerald-900 dark:text-lime-200">
                  <CheckCircle2 size={14} />
                  توصیه کارشناسی و درمان:
                </p>
                <p className="mt-1 text-fluid-2xs leading-6 text-emerald-800 dark:text-emerald-100">
                  {diagnosisResult.treatment_advice}
                </p>
              </div>

              {/* Matched Products in Catalogue */}
              {diagnosisResult.suggested_products && diagnosisResult.suggested_products.length > 0 && (
                <div className="mt-4">
                  <p className="text-fluid-xs font-bold text-slate-700 dark:text-emerald-100">
                    نهاده‌ها و محصولات پیشنهادی در فروشگاه:
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {diagnosisResult.suggested_products.map((p) => (
                      <a
                        key={p.id}
                        href={`/products/${p.slug}`}
                        onClick={() => {
                          setDiagnosisResult(null);
                          setUploadedPreview(null);
                        }}
                        className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm transition hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-900/60"
                      >
                        <img
                          src={p.image_url || '/images/hero-farm.jpg'}
                          alt={p.title}
                          width={48}
                          height={48}
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-fluid-xs font-bold text-slate-800 dark:text-white">
                            {p.title}
                          </p>
                          <p className="text-fluid-2xs font-extrabold text-emerald-700 dark:text-lime-300">
                            {formatPrice(p.price)}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <p className="mt-4 text-center text-fluid-2xs text-slate-400 dark:text-emerald-300/70">
                {diagnosisResult.disclaimer}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}