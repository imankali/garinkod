// frontend/src/components/SearchBar.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";

import { Search, X, Clock, Mic, Sparkles, Tag, Flame } from "lucide-react";
import { categories } from "../data/shopData";
import { productsApi } from "../api/services";
import { useTranslation } from "../i18n";
import type { ProductList, MockProduct } from '@/types/shop';

// ========================================
// Types
// ========================================
interface SearchBarProps {
  /**
   * `desktop` — the wide field in the header's main row.
   * `mobile`  — the field in its own row under the header, on compact screens.
   * `compact` — the field inside the pinned row while the header is collapsed,
   *             where it shares the row with a menu button and a cart button, so
   *             it sheds the microphone. Every variant keeps the field itself
   *             and the button that submits it.
   */
  variant?: "desktop" | "mobile" | "compact";
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
//
// The field, and the button that runs it.
//
// Two things used to be here that are not: a scope selector («همه») and the
// funnel button that opened a panel of category and stock chips. Both were
// removed at the project owner's request — the box is now the field, the
// microphone, and search. Filtering has not gone anywhere: /products carries the
// full filter set (category, brand, price, order, availability), which is where
// a buyer narrows a result list anyway, and the suggestions dropdown still
// offers the popular categories as links into it.
//
// The submit button now sits where the funnel button used to be, so the row ends
// with one action — search — instead of two that looked alike.
// ========================================
export default function SearchBar({ variant = "desktop", onSelectProduct }: SearchBarProps) {
  const { locale, t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  /** بدون callback، کلیک روی نتیجه مستقیماً به صفحه محصول می‌رود. */
  function openProduct(product: MockProduct) {
    setShowSuggestions(false);
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
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      const response = await productsApi.getAll({ search: debouncedQuery, page: 1 });
      return response.data.results.map(convertProduct);
    },
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 30000,
  });

  // ========================================
  // بستن dropdown هنگام کلیک بیرون
  // ========================================
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const filteredProducts: MockProduct[] = useMemo(
    () => (searchResults || []).slice(0, 8),
    [searchResults]
  );

  // ========================================
  // Handlers
  // ========================================
  /**
   * Enter (or the «جستجو» button) goes to the results page.
   *
   * It used to only open the suggestions dropdown, which left the field's own
   * promise unkept: you press a button that says «جستجو» and no search happens.
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed && !recent.includes(trimmed)) {
      setRecent((prev) => [trimmed, ...prev].slice(0, 8));
    }
    setShowSuggestions(false);
    navigate(trimmed ? `/products?search=${encodeURIComponent(trimmed)}` : "/products");
  }

  function toggleVoiceSearch() {
    if (isListening) {
      setIsListening(false);
      return;
    }
    setIsListening(true);
    setShowSuggestions(true);

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
        className={`group flex items-stretch overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-colors duration-300 dark:bg-emerald-950 ${
          showSuggestions
            ? "border-brand-green shadow-lg shadow-emerald-100 ring-4 ring-emerald-100/50 dark:shadow-none dark:ring-emerald-900/50"
            : "border-emerald-100 hover:border-emerald-300 dark:border-emerald-900/60"
        }`}
      >
        {/* Search Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          placeholder={isListening ? "در حال شنیدن صدای شما..." : t("header.searchPlaceholder")}
          className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-emerald-400 md:py-3.5 md:text-base"
          aria-label="جستجوی محصولات"
        />

        {/* Voice Search Button — dropped in the pinned row on phones, where the
            field and the submit button are the two things that must fit. */}
        <button
          type="button"
          onClick={toggleVoiceSearch}
          title="جستجوی صوتی به زبان فارسی"
          className={`relative min-h-11 min-w-11 items-center justify-center transition-colors ${
            variant === "compact" ? "hidden sm:flex" : "flex"
          } ${
            isListening
              ? "text-rose-500"
              : "text-slate-400 hover:text-brand-green dark:text-emerald-400 dark:hover:text-lime-300"
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

        {/* Submit — the only action in the row. It stands where the funnel
            button used to; the label appears once there is room for it. */}
        <motion.button
          type="submit"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex min-h-11 items-center gap-1.5 overflow-hidden rounded-e-2xl bg-brand-gradient-accent px-3.5 text-white md:px-6"
          aria-label="جستجو"
        >
          <Search size={18} className="drop-shadow" />
          <span className="hidden text-sm font-medium md:inline">جستجو</span>
        </motion.button>
      </motion.form>

      {/* ======================================== */}
      {/* Dropdown Results */}
      {/* ======================================== */}
      <AnimatePresence>
        {showSuggestions && (
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

            {query.trim().length === 0 ? (
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
                        type="button"
                        onClick={() => {
                          setQuery(term);
                          if (!recent.includes(term)) {
                            setRecent((prev) => [term, ...prev].slice(0, 8));
                          }
                        }}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 transition-colors hover:bg-emerald-100 hover:shadow-sm dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-lime-300"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Popular Categories — links into the shop's own filter, which
                    is where a category narrows a result list now that the search
                    box no longer carries a scope of its own. */}
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <Tag size={13} /> دسته‌بندی‌های محبوب
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        to={`/products?category=${cat.id}`}
                        onClick={() => setShowSuggestions(false)}
                        className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-emerald-100 hover:text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200"
                      >
                        <cat.icon size={12} />
                        {cat.label}
                      </Link>
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
                          type="button"
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
                    <li>• برای محدود کردن نتایج، در صفحه محصولات فیلتر بگذارید</li>
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
                  <button
                    type="button"
                    onClick={() => navigate(`/products?search=${encodeURIComponent(query.trim())}`)}
                    className="text-fluid-2xs font-bold text-brand-green hover:underline dark:text-lime-300"
                  >
                    دیدن همه نتایج
                  </button>
                </div>

                {/* Results List */}
                <ul className="max-h-80 space-y-1 overflow-y-auto">
                  {filteredProducts.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => openProduct(product)}
                        className="flex w-full items-center gap-3 rounded-xl p-2 text-start transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/50"
                      >
                        <img
                          src={product.image}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-xs font-semibold text-slate-700 dark:text-emerald-100">
                            {product.name}
                          </p>
                          <p className="text-fluid-2xs text-slate-400">{product.category}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-brand-green dark:text-lime-300">
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
                <p className="text-xs text-slate-400">عبارت دیگری را امتحان کنید یا از دسته‌بندی‌ها شروع کنید</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
