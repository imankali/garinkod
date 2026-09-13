// frontend/src/components/home/BestSellers.tsx

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';

import { productsApi } from '../../api/services';
import type { ProductList } from '@/types/shop';
import OfferRail from './OfferRail';

/**
 * «پرفروش‌ترین کالاها» — the Digikala best-seller slider.
 *
 * The ranking is computed by the API (`ordering=-sales_count`, a real
 * ordering field on /api/products/), never by a hand-picked list, so the rail
 * cannot drift out of sync with what farmers actually buy. Reuses the
 * scroll-snap rail from the flash-deal panel for one consistent gesture.
 */
export default function BestSellers() {
  const { data, isLoading } = useQuery({
    queryKey: ['home-best-sellers'],
    queryFn: () => productsApi.getAll({ ordering: '-sales_count', page_size: 10 }),
    staleTime: 5 * 60 * 1000,
  });

  const products = data?.data.results ?? [];

  if (isLoading) {
    return (
      <div
        className="h-64 animate-pulse rounded-2xl bg-slate-100"
        role="status"
        aria-label="در حال بارگذاری پرفروش‌ترین‌ها"
      />
    );
  }
  if (!products.length) return null;

  return (
    <section
      aria-labelledby="best-sellers-title"
      className="rounded-2xl border border-slate-200 bg-white"
    >
      <div className="page-shell py-6 sm:py-8">
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6">
          <TrendingUp size={22} className="text-emerald-700" aria-hidden="true" />
          <h2 id="best-sellers-title" className="text-fluid-xl font-extrabold text-slate-900">
            پرفروش‌ترین کالاها
          </h2>
          <span className="text-fluid-xs text-slate-500">
            بر اساس تعداد سفارش ثبت‌شده در گرین کود
          </span>
          <Link
            to="/products?ordering=-sales_count"
            className="ms-auto inline-flex items-center gap-1 text-fluid-sm font-bold text-emerald-700 transition hover:text-emerald-900"
          >
            دیدن همه
            <ChevronLeft size={16} aria-hidden="true" />
          </Link>
        </div>
        <OfferRail products={products as ProductList[]} />
      </div>
    </section>
  );
}
