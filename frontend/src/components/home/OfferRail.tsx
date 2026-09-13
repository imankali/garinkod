// frontend/src/components/home/OfferRail.tsx

import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';

import { formatPrice } from '../../utils/formatPrice';
import { toPersianDigits } from '../../utils/normalizeDigits';
import type { ProductList } from '@/types/shop';

/**
 * The horizontal card rail shared by the flash-deal and best-seller panels.
 *
 * Native CSS scroll-snap instead of a JS carousel library: momentum scrolling,
 * free keyboard scrolling inside the region, and no observer code to keep in
 * sync with RTL. Cards show the discount badge, the struck-through original
 * price and the final price — the same trio Digikala shows, because hiding the
 * original price makes a "discount" unverifiable.
 */
export default function OfferRail({ products }: { products: ProductList[] }) {
  // The rail lives on the home page; prefetching the target product page the
  // moment a card gains pointer focus removes most of the navigation latency.
  const queryClient = useQueryClient();

  return (
    <div
      className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:px-6 [scrollbar-width:thin]"
      role="region"
      aria-label="کارت‌های قابل پیمایش افقی"
    >
      {products.map((product) => (
        <Link
          key={product.id}
          to={`/products/${product.slug}`}
          onMouseEnter={() => {
            void queryClient.prefetchQuery({
              queryKey: ['product', product.slug],
              queryFn: () => Promise.resolve(undefined),
              staleTime: 30 * 1000,
            });
          }}
          className="group w-40 shrink-0 snap-start rounded-xl bg-white p-3 text-slate-900 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:-translate-y-1 focus-visible:outline-2 focus-visible:outline-emerald-600 motion-reduce:hover:translate-y-0 sm:w-44"
        >
          <div className="relative">
            <img
              src={product.image_url}
              alt=""
              width={160}
              height={160}
              loading="lazy"
              decoding="async"
              className="h-28 w-full rounded-lg object-cover"
            />
            {product.discount_percent > 0 && (
              <span className="absolute right-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-fluid-2xs font-extrabold text-white">
                {toPersianDigits(product.discount_percent)}٪
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-fluid-xs leading-6 group-hover:text-emerald-800">
            {product.title}
          </p>
          <div className="mt-2">
            {product.discount_percent > 0 ? (
              <>
                <p className="text-fluid-2xs text-slate-400 line-through">
                  {formatPrice(product.price)}
                </p>
                <p className="text-fluid-sm font-extrabold text-emerald-800">
                  {formatPrice(product.discounted_price)}
                </p>
              </>
            ) : (
              <p className="text-fluid-sm font-extrabold text-emerald-800">
                {formatPrice(product.price)}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
