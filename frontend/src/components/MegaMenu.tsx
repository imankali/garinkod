// frontend/src/components/MegaMenu.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { categoriesApi } from "../api/services";
import type { Category } from "../types";

// ========================================
// Types
// ========================================
interface CategoryIcons {
  [key: string]: string;
}

interface CategoryColors {
  [key: string]: string;
}

// ========================================
// Category Icons & Colors Mapping
// ✅ نگاشت slug به آیکون و رنگ (بر اساس دسته‌بندی‌های UI)
// ========================================
const categoryIcons: CategoryIcons = {
  'pesticide': '',
  'fertilizer': '',
  'seed': '🌾',
  'equipment': '🚜',
  'irrigation': '💧',
  'tools': '🔧',
};

const categoryColors: CategoryColors = {
  'pesticide': 'from-[#0F8A5F] to-[#0c6b49]',
  'fertilizer': 'from-emerald-500 to-[#0F8A5F]',
  'seed': 'from-amber-500 to-orange-500',
  'equipment': 'from-lime-600 to-[#0F8A5F]',
  'irrigation': 'from-sky-500 to-cyan-600',
  'tools': 'from-teal-500 to-emerald-600',
};

// ========================================
// MegaMenu Component
// ========================================
export default function MegaMenu() {
  const [open, setOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);

  // ========================================
  // دریافت دسته‌بندی‌ها از API
  // ========================================
  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoriesApi.getAll();
      return response.data.results || [];
    },
    staleTime: 5 * 60 * 1000, // 5 دقیقه cache
  });

  // اطمینان از اینکه categories همیشه آرایه است
  const categories: Category[] = useMemo(
    () => (Array.isArray(categoriesData) ? categoriesData : []),
    [categoriesData]
  );

  // ========================================
  // تنظیم اولین دسته‌بندی به عنوان پیش‌فرض
  // ========================================
  useEffect(() => {
    const firstCategory = categories[0];
    if (firstCategory && !activeSlug) {
      setActiveSlug(firstCategory.slug);
    }
  }, [categories, activeSlug]);

  // ========================================
  // بستن منو هنگام کلیک بیرون
  // ========================================
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ========================================
  // پیدا کردن دسته‌بندی فعال
  // ========================================
  const activeCategory = categories.find((category) => category.slug === activeSlug) ?? categories[0] ?? null;

  // ========================================
  // Loading State
  // ========================================
  if (isLoading) {
    return (
      <div className="hidden lg:block">
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"></div>
          در حال بارگذاری...
        </div>
      </div>
    );
  }

  // ========================================
  // Empty State
  // ========================================
  if (categories.length === 0) {
    return null;
  }

  // ========================================
  // Render
  // ========================================
  return (
    <div ref={ref} className="relative hidden lg:block">
      {/* ======================================== */}
      {/* Toggle Button */}
      {/* ======================================== */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
          open
            ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        }`}
        aria-label="منوی دسته‌بندی‌ها"
      >
        <LayoutGrid size={17} />
        همه دسته‌بندی‌ها
      </button>

      {/* ======================================== */}
      {/* Mega Menu Panel */}
      {/* ======================================== */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute start-0 top-[calc(100%+12px)] z-50 flex w-[640px] overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-900/10 dark:border-emerald-800 dark:bg-emerald-950"
          >
            {/* ======================================== */}
            {/* Sidebar - لیست دسته‌بندی‌ها */}
            {/* ======================================== */}
            <ul className="w-56 border-e border-slate-100 bg-slate-50/60 p-2 dark:border-emerald-800 dark:bg-emerald-900/30">
              {categories.map((cat) => (
                <li key={cat.slug}>
                  <button
                    onMouseEnter={() => setActiveSlug(cat.slug)}
                    onClick={() => setActiveSlug(cat.slug)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-medium transition-colors ${
                      activeSlug === cat.slug
                        ? "bg-white text-emerald-700 shadow-sm dark:bg-emerald-800 dark:text-lime-300"
                        : "text-slate-600 hover:bg-white/70 dark:text-emerald-200 dark:hover:bg-emerald-800/50"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${
                        categoryColors[cat.slug] || 'from-emerald-500 to-lime-500'
                      } text-white`}
                    >
                      {categoryIcons[cat.slug] || '📦'}
                    </span>
                    <span className="flex-1 text-start">{cat.name}</span>
                    {cat.product_count > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-700 dark:text-lime-300">
                        {cat.product_count.toLocaleString("fa-IR")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {/* ======================================== */}
            {/* Content - زیردسته‌بندی‌ها */}
            {/* ======================================== */}
            {activeCategory && (
              <motion.div
                key={activeCategory.slug}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 p-5"
              >
                {/* Header */}
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${
                      categoryColors[activeCategory.slug] || 'from-emerald-500 to-lime-500'
                    } text-white shadow-lg`}
                  >
                    {categoryIcons[activeCategory.slug] || '📦'}
                  </span>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{activeCategory.name}</p>
                    <p className="text-xs text-slate-400 dark:text-emerald-300">
                      {activeCategory.product_count} محصول
                    </p>
                  </div>
                </div>

                {/* Subcategories Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {activeCategory.subcategories && activeCategory.subcategories.length > 0 ? (
                    activeCategory.subcategories.map((sub) => (
                      <a
                        key={sub.slug}
                        href={`/products?category=${activeCategory.slug}&subcategory=${sub.slug}`}
                        className="group flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600 transition-all hover:bg-emerald-50 hover:text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900 dark:hover:text-lime-300"
                      >
                        {sub.name}
                        <ArrowLeft
                          size={14}
                          className="opacity-0 transition-all group-hover:-translate-x-1 group-hover:opacity-100"
                        />
                      </a>
                    ))
                  ) : (
                    <p className="col-span-2 text-center text-sm text-slate-400 py-4 dark:text-emerald-400">
                      زیردسته‌بندی موجود نیست
                    </p>
                  )}
                </div>

                {/* View All Link */}
                <a
                  href={`/products?category=${activeCategory.slug}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-lime-300 dark:hover:text-lime-400"
                >
                  مشاهده همه محصولات {activeCategory.name}
                  <ArrowLeft size={15} />
                </a>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}