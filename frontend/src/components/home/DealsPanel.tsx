// frontend/src/components/home/DealsPanel.tsx

import { useQuery } from '@tanstack/react-query';

import { productsApi } from '../../api/services';
import type { ProductList } from '@/types/shop';
import SectionHead from './SectionHead';
import Rail from './Rail';
import ProductCard from '../shop/ProductCard';
import { RailSkeleton } from '../ui/Skeleton';
import { nums } from '../../lib/price';

/**
 * «تخفیف‌های امروز» — the deepest live discounts, sorted by the server.
 *
 * There used to be a countdown here, ticking down to local midnight under the
 * heading. It was removed rather than restyled: the catalogue has no discount
 * end date — a product is discounted or it is not — so «پایان تا ۰۹:۱۴:۲۲» was a
 * deadline the shop invented to hurry the reader. The discount is the
 * information; a clock that resets every night is theatre.
 */
export default function DealsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['home-deals'],
    queryFn: async () => (await productsApi.getAll({ has_discount: true, ordering: '-discount_percent', page_size: 10 })).data,
    staleTime: 5 * 60 * 1000,
  });

  const products = (data?.results ?? []).filter((item) => (item.discount_percent ?? 0) > 0);
  if (!isLoading && products.length === 0) return null;

  return (
    <section aria-labelledby="deals-title" className="section shell">
      <SectionHead
        id="deals-title"
        title="تخفیف‌های امروز"
        hint={`${nums(products.length)} کالا با بیشترین تخفیف؛ قیمت پیش از تخفیف هم روی هر کارت می‌ماند.`}
        action={{ to: '/offers', label: 'همهٔ تخفیف‌ها' }}
      />

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
