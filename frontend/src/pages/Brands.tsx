// frontend/src/pages/Brands.tsx

import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { CatalogCard } from '@/types/shop';

import { catalogApi } from '../api/services';
import PageHead from '../components/shop/PageHead';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import { nums } from '../lib/price';
import { brandShopPath, landingPath } from '../lib/landing';

/**
 * «برندها» — every addressable landing page in the catalogue: brands, then
 * departments, then tags. One alphabetical-ish list of rows rather than three
 * card walls, because a landing page is a place you navigate to, not a product
 * you browse.
 */
export default function Brands() {
  const { data, isLoading } = useQuery({
    queryKey: ['catalog', 'index'],
    queryFn: async () => (await catalogApi.index()).data,
    staleTime: 30 * 60 * 1000,
  });

  const groups: Array<{ title: string; kind: string; items: CatalogCard[] }> = [
    { title: 'برندها', kind: 'brand', items: data?.brands ?? [] },
    { title: 'دسته‌ها', kind: 'category', items: data?.categories ?? [] },
    { title: 'موضوع‌ها', kind: 'tag', items: data?.tags ?? [] },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <PageHead
        title="برندها و مسیرهای کاتالوگ"
        lead="هر برند و هر دسته یک صفحهٔ مستقل دارد؛ از همین‌جا مستقیم به فهرست کالاهای آن برسید."
      />

      {isLoading ? (
        <CardGridSkeleton count={4} />
      ) : (
        groups.map((group) => (
          <section key={group.kind} aria-labelledby={`group-${group.kind}`}>
            <h2 id={`group-${group.kind}`} className="text-base font-extrabold text-ink dark:text-white">
              {group.title}
            </h2>
            <ul className="mt-2 grid gap-x-6 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <li key={`${group.kind}-${item.slug}`} className="border-b border-line dark:border-night-line">
                  <Link
                    to={item.kind === 'brand' ? brandShopPath(item.slug) : landingPath(item)}
                    className="group flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-extrabold text-ink transition-colors group-hover:text-brand-800 dark:text-white dark:group-hover:text-brand-300">
                        {item.title}
                      </span>
                      {item.description && (
                        <span className="mt-0.5 block truncate text-2xs text-ink-mute dark:text-white/45">{item.description}</span>
                      )}
                    </span>
                    <span className="dateline shrink-0 text-2xs text-ink-mute dark:text-white/40">{nums(item.count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
