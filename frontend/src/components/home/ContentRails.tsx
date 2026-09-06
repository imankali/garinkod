// frontend/src/components/home/ContentRails.tsx
//
// The three catalogue carousels and the magazine block on the home page.
//
// A farm-supply home page used to show only departments, which answers "where
// is the pesticide page" but not the two questions a returning buyer actually
// has: what changed since last season (new stock, live discounts, what other
// farmers rated) and what should I read before I buy. Each rail is one request
// to the existing product API; nothing here is a hard-coded promotion.

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Newspaper, Sparkles } from 'lucide-react';

import ProductCard from '../ProductCard';
import ArticleCard from '../article/ArticleCard';
import { articlesApi, productsApi } from '../../api/services';
import { convertToMockProduct } from '../../utils/convertProduct';
import type { MockProduct, ProductList } from '../../types';

interface RailProps {
  wishlistIds: Set<number>;
  compareIds: Set<number>;
  compareDisabled: boolean;
  onToggleWishlist: (product: MockProduct) => void;
  onAddToCart: (product: MockProduct, event: React.MouseEvent) => void;
  onQuickView: (product: MockProduct) => void;
  onToggleCompare: (product: MockProduct) => void;
}

const RAIL_SIZE = 8;

/** `ordering` values here are all real `ordering_fields` on /api/products/. */
const RAILS = [
  {
    id: 'newest',
    title: 'تازه‌های انبار',
    hint: 'نهادهایی که در هفته‌های اخیر به گرین کود اضافه شده‌اند.',
    to: '/products?ordering=-publish',
    params: { ordering: '-publish' },
  },
  {
    id: 'discounted',
    title: 'تخفیف‌های فعال',
    hint: 'کود و سمی که تا پایان بازه تخفیف، ارزان‌تر از قیمت کارخانه است.',
    to: '/products?collection=discounted',
    params: { ordering: '-discount_percent', has_discount: true },
  },
  {
    id: 'best_rated',
    title: 'بیشترین امتیاز خریداران',
    hint: 'میانگین ستاره‌ها فقط از دیدگاه تأییدشده کشاورزان محاسبه می‌شود.',
    to: '/products?ordering=-avg_rating',
    params: { ordering: '-avg_rating' },
  },
] as const;

export default function ContentRails({
  wishlistIds,
  compareIds,
  compareDisabled,
  onToggleWishlist,
  onAddToCart,
  onQuickView,
  onToggleCompare,
}: RailProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['home-rails', RAILS.map((rail) => rail.id).join(',')],
    queryFn: async () => {
      const responses = await Promise.all(
        RAILS.map((rail) =>
          productsApi.getAll({ ...rail.params, page_size: RAIL_SIZE }),
        ),
      );
      const map: Record<string, MockProduct[]> = {};
      responses.forEach((response, index) => {
        map[RAILS[index]!.id] = (response.data.results || []).map((item: ProductList) =>
          convertToMockProduct(item),
        );
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: articles = [] } = useQuery({
    queryKey: ['home-magazine'],
    queryFn: async () => (await articlesApi.getAll({ limit: 4 })).data,
    staleTime: 10 * 60 * 1000,
  });

  // Three empty rails plus no published article would make the home page look
  // broken, so the whole block disappears until there is something to show.
  const hasProducts = RAILS.some((rail) => (data?.[rail.id]?.length || 0) > 0);
  if (isLoading ? false : !hasProducts && articles.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl space-y-10 px-[var(--page-gutter)] pt-10" aria-label="پیشنهادهای گرین کود">
      {RAILS.map((rail) => {
        const products = data?.[rail.id] || [];
        if (!products.length) return null;
        return (
          <div key={rail.id}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-fluid-lg font-extrabold text-slate-800 dark:text-white">
                  <Sparkles size={17} className="text-emerald-600 dark:text-lime-300" />
                  {rail.title}
                </h2>
                <p className="mt-1 max-w-2xl text-fluid-xs text-slate-500 dark:text-emerald-200">{rail.hint}</p>
              </div>
              <Link
                to={rail.to}
                className="inline-flex min-h-11 items-center gap-1 text-fluid-xs font-bold text-emerald-700 hover:underline dark:text-lime-300"
              >
                مشاهده همه
                <ArrowLeft size={14} />
              </Link>
            </div>

            {/* A swipeable row on touch, a grid from lg up. */}
            <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-4 lg:gap-4">
              {products.slice(0, RAIL_SIZE).map((product, index) => (
                <div
                  key={product.id}
                  className="w-[62vw] max-w-[260px] shrink-0 snap-start sm:w-[38vw] lg:w-auto lg:max-w-none"
                >
                  <ProductCard
                    product={product}
                    index={index}
                    isWishlisted={wishlistIds.has(product.id)}
                    isComparing={compareIds.has(product.id)}
                    compareDisabled={compareDisabled}
                    onToggleWishlist={onToggleWishlist}
                    onAddToCart={onAddToCart}
                    onQuickView={onQuickView}
                    onToggleCompare={onToggleCompare}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {articles.length > 0 && (
        <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6 dark:border-emerald-900 dark:bg-emerald-950">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-fluid-lg font-extrabold text-slate-800 dark:text-white">
                <Newspaper size={17} className="text-emerald-600 dark:text-lime-300" />
                مجله کشاورزی گرین کود
              </h2>
              <p className="mt-1 max-w-2xl text-fluid-xs text-slate-500 dark:text-emerald-200">
                قبل از خرید، راهنمای کشت همان گیاه را بخوانید؛ نسخه چاپ‌شدنی هر مقاله در دسترس است.
              </p>
            </div>
            <Link
              to="/blog"
              className="inline-flex min-h-11 items-center gap-1 text-fluid-xs font-bold text-emerald-700 hover:underline dark:text-lime-300"
            >
              همه مقاله‌ها
              <ArrowLeft size={14} />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ArticleCard article={articles[0]!} />
            <div className="space-y-3">
              {articles.slice(1).map((article) => (
                <ArticleCard key={article.id} article={article} variant="row" />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
