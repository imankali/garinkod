// frontend/src/components/home/CategoryRail.tsx

import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Beef, Droplets, FlaskConical, House, Package, Sprout, Tractor, Wrench, Wheat, type LucideIcon } from 'lucide-react';

import { categoriesApi } from '../../api/services';
import { Skeleton } from '../ui/Skeleton';
import { nums } from '../../lib/price';

/**
 * The taxonomy, as the first thing after the hero.
 *
 * A row of links, not a grid of tiles: nine departments in a grid take two
 * rows of vertical space to say the same nine words, and the buyer's real
 * question ("where is fertiliser?") is answered in one glance either way.
 *
 * Each department carries a drawn glyph (never an emoji: emoji render
 * differently on Windows, Android and iOS and cannot take the brand colour)
 * and its real product count, so an empty department is visibly empty before
 * it is clicked.
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

const FALLBACK = [
  { name: 'کود', slug: 'fertilizer', product_count: 0 },
  { name: 'سم', slug: 'pesticide', product_count: 0 },
  { name: 'بذر', slug: 'seed', product_count: 0 },
  { name: 'ادوات', slug: 'equipment', product_count: 0 },
];

export default function CategoryRail() {
  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.getAll()).data.results ?? [],
    staleTime: 10 * 60 * 1000,
  });

  const list = data && data.length > 0 ? data.slice(0, 8) : FALLBACK;

  return (
    <section aria-label="دسته‌بندی کالاها" className="shell">
      <ul className="rail gap-2 pb-1">
        {isLoading
          ? Array.from({ length: 6 }, (_, index) => (
              <li key={index} className="rail-item">
                <Skeleton className="h-[4.75rem] w-[9.5rem] rounded-md" />
              </li>
            ))
          : list.map((category) => {
              const Icon = ICONS[category.slug] ?? Package;
              return (
                <li key={category.slug} className="rail-item">
                  <Link
                    to={`/products?category=${category.slug}`}
                    className="group flex h-[4.75rem] w-[9.5rem] items-center gap-3 rounded-md border border-line bg-paper px-3 transition-[border-color,background-color] duration-[var(--dur-state)] ease-[var(--ease-out)] hover:border-brand-300 hover:bg-brand-50 active:scale-[0.99] motion-reduce:active:scale-100 dark:border-night-line dark:bg-night-soft dark:hover:border-brand-700 dark:hover:bg-night"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-brand-50 text-brand-700 transition-colors duration-150 group-hover:bg-white dark:bg-night dark:text-brand-300 dark:group-hover:bg-night-soft">
                      <Icon size={18} aria-hidden="true" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-extrabold text-ink dark:text-white">{category.name}</span>
                      <span className="dateline block text-2xs text-ink-mute dark:text-white/45">
                        {category.product_count > 0 ? `${nums(category.product_count)} کالا` : 'به‌زودی'}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
        <li className="rail-item">
          <Link
            to="/products"
            className="flex h-[4.75rem] w-[7.5rem] items-center justify-center gap-1.5 rounded-md border border-dashed border-line text-xs font-bold text-brand-700 transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50 dark:border-night-line dark:text-brand-300 dark:hover:border-brand-700 dark:hover:bg-night-soft"
          >
            همهٔ کالاها
            <ArrowLeft size={14} aria-hidden="true" />
          </Link>
        </li>
      </ul>
    </section>
  );
}
