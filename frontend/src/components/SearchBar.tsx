// frontend/src/components/SearchBar.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Search, X, Clock, SlidersHorizontal,
  PackageCheck, Mic, Sparkles, Tag, Flame, ImagePlus
} from "lucide-react";
import { categories } from "../data/shopData";
import { productsApi, trustApi } from "../api/services";
import { useTranslation } from "../i18n";
import type { ProductList, MockProduct } from "../types";

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
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);

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
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    setIsFocused(true);
  }

  function resetFacets() {
    setInStockOnly(false);
    setActiveCategory("all");
  }

  async function handleImageSearch(event: React.ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    if (!image) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 5 * 1024 * 1024) {
      toast.error('تصویر باید JPG، PNG یا WebP و حداکثر ۵ مگابایت باشد.');
      event.target.value = '';
      return;
    }
    try {
      const response = await trustApi.visualSearch(image, 'product');
      toast(response.data.message);
    } catch {
      // The API client displays the failure message.
    } finally {
      event.target.value = '';
    }
  }

  function toggleVoiceSearch() {
    if (isListening) {
      setIsListening(false);
      return;
    }
    setIsListening(true);
    setIsFocused(true);

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
    setIsFocused(true);
  }

  // ========================================
  // Render
  // ========================================
  return (
    <motion.div ref={containerRef} className={`relative w-full ${variant === "desktop" ? "max-w-2xl" : ""}`} layout>
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
          onFocus={() => setIsFocused(true)}
          placeholder={isListening ? "در حال شنیدن صدای شما..." : t("header.searchPlaceholder")}
          className="w-full flex-1 bg-transparent px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-emerald-400 md:py-3 md:text-base"
          aria-label="جستجوی محصولات"
        />

        <input ref={imageSearchRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageSearch} className="hidden" aria-label="انتخاب تصویر برای جستجو" />

        {/* Visual search queues the image for the verified server-side pipeline. */}
        <button
          type="button"
          onClick={() => imageSearchRef.current?.click()}
          title="جستجو با تصویر"
          className="flex items-center px-2 text-slate-400 transition-colors hover:text-[#0F8A5F] dark:text-emerald-400 dark:hover:text-lime-300"
          aria-label="جستجو با تصویر"
        >
          <ImagePlus size={18} />
        </button>

        {/* Voice Search Button */}
        <button
          type="button"
          onClick={toggleVoiceSearch}
          title="جستجوی صوتی به زبان فارسی"
          className={`relative flex items-center px-2.5 transition-colors ${
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
          <button type="button" onClick={() => setQuery("")} className="flex items-center px-1 text-slate-400 hover:text-slate-600" aria-label="پاک کردن جستجو">
            <X size={16} />
          </button>
        )}

        {/* Advanced Filters Button */}
        <button
          type="button"
          onClick={() => {
            setShowAdvanced((v) => !v);
            setIsFocused(true);
          }}
          className={`relative flex items-center gap-1 border-s border-emerald-100 px-3 text-slate-500 transition-colors hover:text-[#0F8A5F] dark:border-emerald-900 dark:text-emerald-400 ${
            showAdvanced ? "text-[#0F8A5F] dark:text-lime-300" : ""
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
      {/* Dropdown Results */}
      {/* ======================================== */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute start-0 top-[calc(100%+10px)] z-50 w-full overflow-hidden rounded-2xl border border-emerald-100 bg-white/95 p-3 shadow-2xl shadow-emerald-900/10 backdrop-blur-xl dark:border-emerald-800 dark:bg-emerald-950/95"
          >
            {/* Voice Search Listening Indicator */}
            {isListening && (
              <div className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                <span className="h-2 w-2 animate-ping rounded-full bg-rose-500" />
                لطفاً نام محصول یا آفت مورد نظر خود را به فارسی بگویید...
              </div>
            )}

            {/* Advanced Filters Panel */}
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="mb-3 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-800 dark:bg-emerald-900/30"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-600 dark:text-emerald-100">فیلتر تخصصی جستجو</p>
                  <button onClick={resetFacets} className="text-fluid-xs text-rose-500 hover:underline">
                    حذف همه فیلترها
                  </button>
                </div>

                {/* Quick Filters */}
                <div className="mb-3">
                  <p className="mb-1.5 text-fluid-xs font-semibold text-slate-500 dark:text-emerald-300">فیلترهای سریع</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => handleQuickFilter('inStock', null)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-fluid-xs font-semibold transition-colors ${
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
                        onClick={() => handleQuickFilter('category', cat.id)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-fluid-xs font-semibold transition-colors ${
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
              </motion.div>
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
                        onClick={() => {
                          setActiveCategory(cat.id);
                          setIsFocused(true);
                        }}
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
                          onSelectProduct?.(product);
                          setIsFocused(false);
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
    </motion.div>
  );
}