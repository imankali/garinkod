// frontend/src/pages/Landing.tsx

import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, Compass } from 'lucide-react';

import { catalogApi, productsApi } from '../api/services';
import type { CatalogKind, ProductList, ProductQueryParams } from '@/types/shop';
import ProductCard from '../components/shop/ProductCard';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { filtersToQuery, landingPath } from '../lib/landing';
import { nums } from '../lib/price';
import { useTitle } from '../lib/useTitle';

const KINDS: ReadonlyArray<CatalogKind> = ['category', 'subcategory', 'brand', 'tag'];

/**
 * A catalogue landing page: a department, a sub-department, a brand or a tag.
 *
 * All four are the same page with one different filter, so they share one
 * component. What the API gives us that a plain filtered grid would not:
 * the intro text (which is where a department page earns its existence), the
 * children to drill into, and the exact `filters` object the grid must send —
 * so the header count and the grid can never disagree.
 */
export default function Landing() {
  const { kind: rawKind = '', slug = '' } = useParams();
  const kind = (KINDS as ReadonlyArray<string>).includes(rawKind) ? (rawKind as CatalogKind) : 'category';

  const landing = useQuery({
    queryKey: ['catalog', 'landing', kind, slug],
    queryFn: async () => (await catalogApi.landing(kind, slug)).data,
    staleTime: 10 * 60 * 1000,
  });

  const filters = landing.data?.filters ?? {};

  const products = useQuery({
    queryKey: ['products', 'landing', kind, slug],
    queryFn: async () =>
      (
        await productsApi.getAll({
          ...(filters as unknown as ProductQueryParams),
          page_size: 24,
        })
      ).data,
    staleTime: 2 * 60 * 1000,
    enabled: Boolean(landing.data),
  });

  useTitle(landing.data?.title);

  if (landing.isLoading) {
    return (
      <div className="shell flex flex-col gap-4 py-8">
        <CardGridSkeleton count={8} />
      </div>
    );
  }

  if (landing.isError || !landing.data) {
    return (
      <div className="shell py-16">
        <EmptyState
          icon={Compass}
          title="این صفحه پیدا نشد"
          description="ممکن است نام آدرس تغییر کرده باشد. از فهرست برندها و دسته‌ها شروع کنید."
          action={<Button to="/brands" variant="secondary" size="sm">همهٔ مسیرها</Button>}
        />
      </div>
    );
  }

  const data = landing.data;
  const items: ProductList[] = products.data?.results ?? [];
  const total = products.data?.count ?? data.count;

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <nav aria-label="مسیر" className="flex flex-wrap items-center gap-1 text-2xs text-ink-mute dark:text-white/45">
        {data.breadcrumb.map((crumb) => (
          <span key={crumb.url} className="inline-flex items-center gap-1">
            <Link to={crumb.url} className="transition-colors hover:text-brand-700 dark:hover:text-brand-300">
              {crumb.title}
            </Link>
            <ChevronLeft size={11} aria-hidden="true" />
          </span>
        ))}
        <span className="text-ink dark:text-white/80">{data.title}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5 dark:border-night-line">
        <div className="max-w-[65ch]">
          <h1 className="text-2xl font-extrabold leading-9 tracking-[-0.03em] text-ink dark:text-white">{data.title}</h1>
          {data.description && (
            <p className="mt-2 text-sm leading-7 text-ink-soft dark:text-white/65">{data.description}</p>
          )}
          <p className="dateline mt-2 text-2xs text-ink-mute dark:text-white/45">
            {nums(total)} کالا · میانگین امتیاز {data.avg_rating.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} از ۵
          </p>
        </div>
        <Link
          to={`/products?${filtersToQuery(filters)}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-2xs font-bold text-ink transition-colors duration-[var(--dur-state)] hover:border-brand-300 hover:bg-brand-50 dark:border-night-line dark:text-white dark:hover:border-brand-700"
        >
          دیدن در فروشگاه با فیلترها
          <ArrowLeft size={13} aria-hidden="true" />
        </Link>
      </header>

      {data.children.length > 0 && (
        <section aria-label="زیرشاخه‌ها">
          <ul className="flex flex-wrap gap-1.5">
            {data.children.map((child) => (
              <li key={`${child.kind}-${child.slug}`}>
                <Link
                  to={landingPath(child)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-line bg-paper px-3 text-2xs font-bold text-ink-soft transition-colors duration-[var(--dur-state)] hover:border-brand-300 hover:text-brand-800 dark:border-night-line dark:bg-night-soft dark:text-white/70 dark:hover:border-brand-700"
                >
                  {child.title}
                  <span className="dateline text-ink-mute dark:text-white/35">{nums(child.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {products.isLoading ? (
        <CardGridSkeleton count={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="در این صفحه کالایی موجود نیست"
          description="این مسیر ممکن است به‌زودی پر شود. فهرست کامل کالاها همیشه در دسترس است."
          action={<Button to="/products" size="sm" variant="secondary">همهٔ کالاها</Button>}
        />
      ) : (
        <section aria-label="کالاها" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      )}

      {data.articles.length > 0 && (
        <section className="mt-4 border-t border-line pt-5 dark:border-night-line" aria-labelledby="landing-articles">
          <h2 id="landing-articles" className="text-base font-extrabold text-ink dark:text-white">نوشته‌های مرتبط</h2>
          <ul className="mt-2 divide-y divide-line dark:divide-night-line">
            {data.articles.map((article) => (
              <li key={article.slug}>
                <Link to={`/magazine/${article.slug}`} className="group block py-3">
                  <span className="text-xs font-extrabold text-ink transition-colors group-hover:text-brand-800 dark:text-white dark:group-hover:text-brand-300">
                    {article.title}
                  </span>
                  <span className="mt-0.5 block text-2xs leading-6 text-ink-mute dark:text-white/45">{article.excerpt}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
