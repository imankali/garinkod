// frontend/src/components/home/CategoryGrid.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LayoutGrid } from 'lucide-react';

import { categoriesApi } from '../../api/services';
import type { Category } from '../../types';

/** Fallback tiles so the section is still useful before categories exist. */
const FALLBACK = [
  { name: 'کود', slug: 'fertilizer', emoji: '🌱' },
  { name: 'سم', slug: 'pesticide', emoji: '🧪' },
  { name: 'بذر', slug: 'seed', emoji: '🌾' },
  { name: 'ادوات', slug: 'equipment', emoji: '🚜' },
];

const EMOJI: Record<string, string> = {
  fertilizer: '🌱',
  pesticide: '🧪',
  seed: '🌾',
  equipment: '🚜',
};

/**
 * Browse by category.
 *
 * The home page offered a filter bar but no visual entry point into the
 * catalogue's structure. Categories are how most buyers actually think —
 * "I need a pesticide" rather than "I need to open a dropdown and filter".
 */
export default function CategoryGrid() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let cancelled = false;
    categoriesApi
      .getAll()
      .then((response) => {
        if (!cancelled) setCategories(response.data.results ?? []);
      })
      .catch(() => setCategories([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const tiles = categories.length
    ? categories.slice(0, 8).map((category) => ({
        name: category.name,
        slug: category.slug,
        emoji: EMOJI[category.slug] ?? '🧺',
        count: category.product_count,
      }))
    : FALLBACK.map((tile) => ({ ...tile, count: undefined as number | undefined }));

  return (
    <section className="page-shell py-8" aria-labelledby="categories-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2
          id="categories-heading"
          className="flex items-center gap-2 text-fluid-xl font-extrabold text-slate-800 dark:text-white"
        >
          <LayoutGrid size={20} aria-hidden="true" className="text-emerald-600" />
          دسته‌بندی محصولات
        </h2>
        <Link
          to="/products"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-fluid-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-lime-300 dark:hover:bg-emerald-900"
        >
          همه محصولات
          <ArrowLeft size={14} aria-hidden="true" />
        </Link>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.slug}>
            <Link
              to={`/products?category=${tile.slug}`}
              className="flex min-h-11 flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-emerald-50/40 p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-emerald-900 dark:from-emerald-950 dark:to-emerald-900/30"
            >
              <span className="text-3xl" aria-hidden="true">
                {tile.emoji}
              </span>
              <span className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                {tile.name}
              </span>
              {tile.count !== undefined && (
                <span className="text-fluid-2xs text-slate-400 dark:text-emerald-300">
                  {tile.count.toLocaleString('fa-IR')} محصول
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
