// frontend/src/components/home/DealsPanel.tsx

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { productsApi } from '../../api/services';
import type { ProductList } from '@/types/shop';
import SectionHead from './SectionHead';
import Rail from './Rail';
import ProductCard from '../shop/ProductCard';
import { RailSkeleton } from '../ui/Skeleton';
import { nums } from '../../lib/price';

/** Seconds until the local midnight, where a deal window closes. */
function untilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

/**
 * «تخفیف‌های امروز» — the deepest live discounts, sorted by the server.
 *
 * The only timed element on the site, and it is deliberately small: a line of
 * tabular figures under the heading. Not a glowing pill, not a red slab, not
 * a flipping-card timer. A deadline is information; a countdown that shouts is
 * a manipulation, and it would also be the second thing on the page moving on
 * its own.
 *
 * It still stops under `prefers-reduced-motion` — the deals remain, the
 * ticking does not.
 */
export default function DealsPanel() {
  const [left, setLeft] = useState(untilMidnight);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setLeft(untilMidnight()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['home-deals'],
    queryFn: async () => (await productsApi.getAll({ has_discount: true, ordering: '-discount_percent', page_size: 10 })).data,
    staleTime: 5 * 60 * 1000,
  });

  const products = (data?.results ?? []).filter((item) => (item.discount_percent ?? 0) > 0);
  if (!isLoading && products.length === 0) return null;

  const hours = Math.floor(left / 3600);
  const minutes = Math.floor((left % 3600) / 60);
  const seconds = left % 60;
  const pad = (value: number) => value.toLocaleString('fa-IR', { minimumIntegerDigits: 2, useGrouping: false });

  return (
    <section aria-labelledby="deals-title" className="section shell">
      <SectionHead
        id="deals-title"
        title="تخفیف‌های امروز"
        hint={`${nums(products.length)} کالا با بیشترین تخفیف؛ قیمت پیش از تخفیف هم روی هر کارت می‌ماند.`}
        action={{ to: '/offers', label: 'همهٔ تخفیف‌ها' }}
      />

      <p className="dateline mt-2 flex items-center gap-1.5 text-2xs font-bold text-gold-700 dark:text-gold-600">
        <span className="inline-block h-1.5 w-1.5 rounded-pill bg-gold-600" aria-hidden="true" />
        <span>پایان تا</span>
        <span dir="ltr">
          {pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
        <span className="font-medium text-ink-mute dark:text-white/45">(وقت محلی)</span>
      </p>

      <div className="mt-4">
        {isLoading ? (
          <RailSkeleton count={5} label="در حال بارگذاری تخفیف‌ها" />
        ) : (
          <Rail label="کارت‌های تخفیف امروز">
            {products.map((product: ProductList) => (
              <div key={product.id} className="rail-item w-[10.5rem] sm:w-[11.5rem]">
                <ProductCard product={product} />
              </div>
            ))}
          </Rail>
        )}
      </div>

    </section>
  );
}
