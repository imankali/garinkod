// frontend/src/components/home/CategoryGrid.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  Beef,
  Droplets,
  FlaskConical,
  House,
  LayoutGrid,
  Package,
  Sprout,
  Tractor,
  Wheat,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { categoriesApi } from '../../api/services';
import { useDragToScroll } from '../../hooks/useDragToScroll';
import type { Category } from '@/types/shop';

/**
 * Category glyphs.
 *
 * These were emoji (🌱🧪🌾🚜). Emoji are font-dependent, differ between
 * Windows/Android/iOS, cannot inherit the brand colour, and cannot be hidden
 * from assistive tech as a set — the ui-ux-pro-max rule "no emoji as structural
 * icons" exists for exactly this tile. Each category now gets a Lucide glyph,
 * inheriting `currentColor`, with a neutral fallback for categories the map has
 * not met yet.
 */
const ICONS: Record<string, LucideIcon> = {
  fertilizer: Sprout,
  pesticide: FlaskConical,
  seed: Wheat,
  equipment: Tractor,
  irrigation: Droplets,
  greenhouse: House,
  'animal-feed': Beef,
  tools: Wrench,
};

/** Fallback tiles so the section is still useful before categories exist. */
const FALLBACK = [
  { name: 'کود', slug: 'fertilizer' },
  { name: 'سم', slug: 'pesticide' },
  { name: 'بذر', slug: 'seed' },
  { name: 'ادوات', slug: 'equipment' },
];

/**
 * Browse by category.
 *
 * The home page offered a filter bar but no visual entry point into the
 * catalogue's structure. Categories are how most buyers actually think —
 * "I need a pesticide" rather than "I need to open a dropdown and filter".
 */
export default function CategoryGrid() {
  const [categories, setCategories] = useState<Category[]>([]);
  // The taxonomy row drags with the mouse like every other rail; on desktop
  // the row usually fits, and the hook then leaves the cursor alone.
  const rail = useDragToScroll<HTMLUListElement>();

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
          خرید بر اساس دسته‌بندی
        </h2>
        <Link
          to="/products"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-fluid-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-lime-300 dark:hover:bg-emerald-900"
        >
          همه محصولات
          <ArrowLeft size={14} aria-hidden="true" />
        </Link>
      </div>

      {/*
        Digikala's "خرید بر اساس دسته‌بندی" is a horizontal row of circles,
        not a grid: one gesture sweeps the whole taxonomy on a phone, and on
        desktop everything still fits. Scroll-snap keeps each circle aligned
        to the gutter when it does overflow.
      */}
      <ul
        ref={rail.ref}
        {...rail.handlers}
        className="mt-5 grid grid-flow-col auto-cols-fr gap-1.5 overflow-x-auto pb-2 sm:flex sm:justify-between sm:gap-3 [scrollbar-width:none]"
        role="region"
        aria-label="دسته‌بندی‌های محصولات"
      >
        {tiles.map((tile) => (
          <li key={tile.slug} className="w-full min-w-0 shrink-0 snap-start text-center sm:w-24">
            <Link
              to={`/products?category=${tile.slug}`}
              className="group flex h-full min-h-11 flex-col items-center justify-start gap-1 rounded-2xl p-1.5 transition focus-visible:outline-2 focus-visible:outline-emerald-600 sm:gap-2 sm:p-2"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white text-emerald-700 shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:border-emerald-300 group-hover:shadow-md motion-reduce:group-hover:translate-y-0 dark:border-emerald-900 dark:from-emerald-950 dark:to-emerald-900/30 dark:text-lime-300 sm:h-20 sm:w-20">
                {(() => {
                  const Icon = ICONS[tile.slug] ?? Package;
                  return <Icon size={26} aria-hidden="true" strokeWidth={1.6} className="sm:h-9 sm:w-9" />;
                })()}
              </span>
              <span className="line-clamp-2 min-h-[2lh] text-[10px] font-bold leading-tight text-slate-800 dark:text-white sm:text-fluid-xs">
                {tile.name}
              </span>
              {tile.count !== undefined && (
                <span className="-mt-1 text-[10px] leading-tight text-slate-500 dark:text-emerald-300 sm:text-fluid-2xs">
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
