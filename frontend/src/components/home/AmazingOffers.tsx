// frontend/src/components/home/AmazingOffers.tsx

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Timer } from 'lucide-react';

import { productsApi } from '../../api/services';
import { toPersianDigits } from '../../utils/normalizeDigits';
import type { ProductList } from '@/types/shop';
import OfferRail from './OfferRail';
import SectionHeading from './SectionHeading';

/**
 * «تخفیف‌های امروز» — the deepest live discounts, ordered by depth on the
 * server (`has_discount=true`, `-discount_percent`).
 *
 * What changed and why:
 *  - The panel no longer shouts. It used to be introduced by a lightning
 *    bolt, a rose countdown pill glowing against the cream, and a title set
 *    in the same weight as every other section — three emphasis devices for
 *    a heading that already says "discounts". Now the section is titled like
 *    every other section, and the countdown is a quiet line of tabular
 *    figures under it: information, not alarm. Emil: a constantly animating
 *    number on a page with autoplaying rails above it is competition, not
 *    emphasis.
 *  - The deadline is honest. It counts to local midnight because that is
 *    when the campaign window closes; the label says so.
 *  - The countdown still stops under `prefers-reduced-motion`, and the deals
 *    stay either way.
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
        className="page-shell py-8 sm:py-10"
        role="status"
        aria-busy="true"
        aria-label="در حال بارگذاری تخفیف‌های امروز"
      />
    );
  }
  if (!products.length) return null;

  return (
    <section aria-labelledby="amazing-offers-title">
      <div className="page-shell py-8 sm:py-10">
        <SectionHeading
          id="amazing-offers-title"
          title="تخفیف‌های امروز"
          hint="کالاهایی با بیشترین تخفیف؛ قیمت پیش از تخفیف هم روی هر کارت می‌ماند."
          href="/products?collection=discounted"
          linkLabel="همه تخفیف‌ها"
        />

        {/* The countdown, demoted from a glowing pill to a line of figures. */}
        <p className="mt-2 inline-flex items-center gap-1.5 text-fluid-2xs font-bold tabular-nums text-amber-700 dark:text-amber-300">
          <Timer size={13} aria-hidden="true" />
          <span>پایان تا</span>
          <span aria-label="زمان باقی‌مانده تا پایان تخفیف‌ها">
            {toPersianDigits(String(hours).padStart(2, '0'))}:
            {toPersianDigits(String(minutes).padStart(2, '0'))}:
            {toPersianDigits(String(seconds).padStart(2, '0'))}
          </span>
        </p>

        <OfferRail products={products} label="کارت‌های پیشنهادهای شگفت‌انگیز" inset={false} />
      </div>
    </section>
  );
}