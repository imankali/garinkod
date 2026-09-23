// frontend/src/components/home/RankedRail.tsx

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

import { productsApi } from '../../api/services';
import AutoRotateToggle from '../ui/AutoRotateToggle';
import type { ProductList, ProductQueryParams } from '@/types/shop';
import OfferRail from './OfferRail';

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
  icon: Icon,
  params,
  moreTo,
  moreLabel = 'دیدن همه',
}: {
  railId: string;
  title: string;
  hint: string;
  icon: LucideIcon;
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
      <div
        className="h-64 animate-pulse rounded-2xl bg-slate-100"
        role="status"
        aria-label={`در حال بارگذاری ${title}`}
      />
    );
  }
  if (!products.length) return null;

  return (
    <section
      aria-labelledby={`ranked-rail-${railId}`}
      className="rounded-2xl border border-slate-200 bg-white dark:border-emerald-900 dark:bg-emerald-950"
    >
      <div className="page-shell py-6 sm:py-8">
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6">
          <Icon size={22} className="shrink-0 text-emerald-700 dark:text-lime-300" aria-hidden="true" />
          <h2
            id={`ranked-rail-${railId}`}
            className="text-fluid-xl font-extrabold text-slate-900 dark:text-white"
          >
            {title}
          </h2>
          <span className="text-fluid-xs text-slate-500 dark:text-emerald-200">{hint}</span>
          {/* The rail below moves on its own every 2s; this is the control that
              stops it (and, through the shared preference, every other rail). */}
          {products.length > 1 && <AutoRotateToggle tone="surface" className="ms-auto" />}
          <Link
            to={moreTo}
            className="inline-flex items-center gap-1 text-fluid-sm font-bold text-emerald-700 transition hover:text-emerald-900 dark:text-lime-300"
          >
            {moreLabel}
            <ChevronLeft size={16} aria-hidden="true" />
          </Link>
        </div>
        <OfferRail products={products as ProductList[]} label={`${title}، قابل پیمایش افقی`} />
      </div>
    </section>
  );
}
