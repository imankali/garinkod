// frontend/src/components/home/CategoryGrid.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  Beef,
  Droplets,
  FlaskConical,
  House,
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
import SectionHeading from './SectionHeading';

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
    <section className="page-shell py-8 sm:py-10" aria-labelledby="categories-heading">
      <SectionHeading
        id="categories-heading"
        title="خرید بر اساس دسته‌بندی"
        href="/products"
        linkLabel="همه محصولات"
      />

      {/*
        Digikala's "خرید بر اساس دسته‌بندی" is a horizontal row of circles,
        not a grid: one gesture sweeps the whole taxonomy on a phone, and on
        desktop everything still fits. Scroll-snap keeps each circle aligned
        to the gutter when it does overflow.
      */}
      {/*
        Tiles, not circles. A circle is a mask that says nothing about the
        category under it; a rounded tile holds the glyph, the name and the
        count as one object, which is also the object a thumb can hit. The
        old disc had a vertical gradient, a border AND a shadow (three
        elevations for a 56px control) and jumped 4px on hover — it is now a
        tinted surface that deepens on hover and presses in on tap.
      */}
      <ul
        ref={rail.ref}
        {...rail.handlers}
        className="mt-4 grid grid-flow-col auto-cols-fr gap-2 overflow-x-auto pb-2 sm:flex sm:justify-between sm:gap-3 [scrollbar-width:none]"
        role="region"
        aria-label="دسته‌بندی‌های محصولات"
      >
        {tiles.map((tile) => (
          <li key={tile.slug} className="w-full min-w-0 shrink-0 snap-start sm:w-[7.5rem]">
            <Link
              to={`/products?category=${tile.slug}`}
              className="group flex h-full min-h-11 flex-col justify-start gap-1.5 rounded-xl border border-emerald-100/80 bg-white p-2.5 transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-emerald-300 hover:bg-emerald-50/60 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:active:scale-100 dark:border-emerald-900 dark:bg-ink dark:hover:border-emerald-700 dark:hover:bg-emerald-900/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/60 dark:text-lime-300">
                {(() => {
                  const Icon = ICONS[tile.slug] ?? Package;
                  return <Icon size={18} aria-hidden="true" strokeWidth={1.75} />;
                })()}
              </span>
              <span className="line-clamp-2 min-h-[2lh] text-fluid-2xs font-bold leading-tight text-ink-deep dark:text-white">
                {tile.name}
              </span>
              {tile.count !== undefined && (
                <span className="-mt-1 text-fluid-2xs leading-tight text-slate-500 dark:text-emerald-300/80">
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
