// frontend/src/components/home/AmazingOffers.tsx

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Timer, Zap } from 'lucide-react';

import { productsApi } from '../../api/services';
import { toPersianDigits } from '../../utils/normalizeDigits';
import type { ProductList } from '@/types/shop';
import OfferRail from './OfferRail';

/**
 * «پیشنهادهای شگفت‌انگیز» — the Digikala flash-deal panel, rebuilt for farm
 * supplies: a dark emerald slab, a countdown to midnight, and a horizontally
 * scrollable rail of the deepest live discounts (`has_discount=true`, ordered
 * by discount depth on the server).
 *
 * The countdown is the only timer on the page; it recomputes each second from
 * the local clock (no server round-trips) and is disabled under reduced
 * motion preferences — the deals themselves stay, only the ticking stops.
 */

function secondsUntilMidnight(now: Date): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

export default function AmazingOffers() {
  const [remaining, setRemaining] = useState(() => secondsUntilMidnight(new Date()));

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    const timer = window.setInterval(
      () => setRemaining(secondsUntilMidnight(new Date())),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const { data, isLoading } = useQuery({
    queryKey: ['home-amazing-offers'],
    queryFn: () =>
      productsApi.getAll({ has_discount: true, ordering: '-discount_percent', page_size: 10 }),
    staleTime: 5 * 60 * 1000,
  });

  const products = useMemo(
    () => (data?.data.results ?? []).filter((item: ProductList) => item.discount_percent > 0),
    [data],
  );

  if (isLoading) {
    return (
      <div
        className="h-64 animate-pulse rounded-2xl bg-emerald-900/10"
        role="status"
        aria-label="در حال بارگذاری پیشنهادهای شگفت‌انگیز"
      />
    );
  }
  if (!products.length) return null;

  return (
    <section aria-labelledby="amazing-offers-title" className="overflow-hidden rounded-2xl bg-gradient-to-bl from-emerald-950 via-emerald-900 to-emerald-800 text-white">
      <div className="page-shell py-6 sm:py-8">
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6">
          <Zap size={22} className="text-rose-400" aria-hidden="true" />
          <h2 id="amazing-offers-title" className="text-fluid-xl font-extrabold">
            پیشنهادهای شگفت‌انگیز
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/90 px-3 py-1 text-fluid-xs font-bold tabular-nums">
            <Timer size={14} aria-hidden="true" />
            <span aria-label="زمان باقی‌مانده تا پایان تخفیف‌ها">
              {toPersianDigits(String(hours).padStart(2, '0'))}:{toPersianDigits(String(minutes).padStart(2, '0'))}:
              {toPersianDigits(String(seconds).padStart(2, '0'))}
            </span>
          </span>
          <Link
            to="/products?collection=discounted"
            className="ms-auto inline-flex items-center gap-1 text-fluid-sm font-bold text-lime-200 transition hover:text-white"
          >
            همه تخفیف‌ها
            <ChevronLeft size={16} aria-hidden="true" />
          </Link>
        </div>

        <OfferRail products={products} />
      </div>
    </section>
  );
}
