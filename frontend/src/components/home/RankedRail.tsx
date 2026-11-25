// frontend/src/components/home/RankedRail.tsx

import { useQuery } from '@tanstack/react-query';

import { productsApi } from '../../api/services';
import type { ProductList, ProductQueryParams } from '@/types/shop';
import OfferRail from './OfferRail';
import SectionHeading from './SectionHeading';

/**
 * The one horizontal product rail of the home page, reused by every ranked
 * list («پرفروش‌ترین کالاها», «تازه‌های انبار», «بیشترین امتیاز خریداران»).
 *
 * One component, three rankings: each instance passes its own `ordering`
 * (a real ordering field on /api/products/), so the ranking is always
 * computed by the API and can never drift from what farmers actually buy.
 * All three look and scroll identically — the round arrows come from
 * OfferRail, the same rail the flash-deal panel uses.
 *
 * The section removes itself when the API returns nothing: an empty rail on
 * a home page reads as a broken page.
 */
export default function RankedRail({
  railId,
  title,
  hint,
  params,
  moreTo,
  moreLabel = 'دیدن همه',
}: {
  railId: string;
  title: string;
  hint: string;
  params: ProductQueryParams;
  moreTo: string;
  moreLabel?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['home-ranked-rail', railId],
    queryFn: () => productsApi.getAll({ ...params, page_size: 10 }),
    staleTime: 5 * 60 * 1000,
  });

  const products = data?.data.results ?? [];

  if (isLoading) {
    return (
      <div className="page-shell py-6 sm:py-8">
        <div role="status" aria-busy="true" aria-label={`در حال بارگذاری ${title}`}>
          <div className="h-6 w-40 animate-pulse rounded bg-slate-100 dark:bg-emerald-900/50" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100 dark:bg-emerald-900/50" />
          <div className="mt-4 flex gap-3 overflow-hidden" aria-hidden="true">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="rail-card h-52 animate-pulse rounded-xl bg-slate-100 dark:bg-emerald-900/50"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (!products.length) return null;

  return (
    <section
      aria-labelledby={`ranked-rail-${railId}`}
      className="scroll-mt-[calc(var(--header-height,72px)+1rem)]"
    >
      <div className="page-shell py-6 sm:py-8">
        <SectionHeading
          id={`ranked-rail-${railId}`}
          title={title}
          hint={hint}
          href={moreTo}
          linkLabel={moreLabel}
        />
        <OfferRail products={products as ProductList[]} inset={false} />
      </div>
    </section>
  );
}
