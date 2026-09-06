// frontend/src/pages/CatalogLanding.tsx
//
// One page per category, subcategory, brand and tag — /c/…, /sc/…, /brand/…, /tag/…
//
// All four share a shape (a title, an intro that explains the group, a set of
// products, and the groups below or beside it), so they share a component and one
// endpoint. The grid asks the product API with *the filters the server returned for
// this page*, which is what keeps the heading's count and the cards in agreement:
// a page can never promise 14 products and show 12.
//
// An empty group is reported as empty rather than padded. A category with no
// published product is a real state of a catalogue, and the page says so and
// offers the desk instead of inventing stock.

import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ChevronLeft, PackageSearch, Star } from 'lucide-react';

import { catalogApi, productsApi } from '../api/services';
import { formatPrice } from '../utils/formatPrice';
import { cn } from '../utils/cn';
import type { CatalogKind, MockProduct, ProductList } from '../types';
import { convertToMockProduct } from '../utils/convertProduct';
import ProductCard from '../components/ProductCard';
import { useCartStore } from '../store/cartStore';
import { useWishlistStore } from '../store/wishlistStore';

const ROUTE_FOR_KIND: Record<CatalogKind, string> = {
  category: '/c',
  subcategory: '/sc',
  brand: '/brand',
  tag: '/tag',
};

export default function CatalogLanding({ kind }: { kind: CatalogKind }) {
  const { slug = '' } = useParams();
  const landingQuery = useQuery({
    queryKey: ['catalog-landing', kind, slug],
    queryFn: async () => (await catalogApi.landing(kind, slug)).data,
    retry: false,
  });

  const landing = landingQuery.data;
  const productsQuery = useQuery({
    queryKey: ['catalog-landing-products', kind, slug, landing?.filters],
    queryFn: async () => {
      const response = await productsApi.getAll({ ...(landing?.filters ?? {}), page_size: 24 } as never);
      return response.data;
    },
    enabled: Boolean(landing),
  });

  if (landingQuery.isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-[var(--page-gutter)] py-10">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100 dark:bg-emerald-950" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-72 animate-pulse rounded-3xl bg-slate-100 dark:bg-emerald-950" />
          ))}
        </div>
      </main>
    );
  }

  if (!landing) {
    return (
      <main className="mx-auto max-w-3xl px-[var(--page-gutter)] py-16 text-center">
        <PackageSearch size={38} className="mx-auto text-slate-300 dark:text-emerald-800" />
        <h1 className="mt-4 text-xl font-extrabold text-slate-800 dark:text-white">چنین صفحه‌ای در فهرست نداریم</h1>
        <p className="mt-2 text-fluid-sm leading-7 text-slate-500 dark:text-emerald-200">
          ممکن است دسته یا برندی تغییر کرده باشد. از فهرست کامل محصولات ادامه بدهید.
        </p>
        <Link to="/products" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white">
          همه محصولات
          <ArrowLeft size={16} />
        </Link>
      </main>
    );
  }

  const products: MockProduct[] = (productsQuery.data?.results ?? []).map((item: ProductList) =>
    convertToMockProduct(item),
  );
  const empty = !productsQuery.isLoading && products.length === 0;

  return (
    <>
      <Helmet>
        <title>{landing.seo_title || landing.title}</title>
        <meta name="description" content={landing.seo_description || landing.description.slice(0, 160)} />
        <link rel="canonical" href={`${ROUTE_FOR_KIND[kind]}/${slug}`} />
      </Helmet>

      <main className="mx-auto max-w-7xl px-[var(--page-gutter)] py-8 md:py-10">
        <nav aria-label="مسیر دسترسی" className="flex flex-wrap items-center gap-1.5 text-fluid-2xs font-bold text-slate-400">
          {landing.breadcrumb.map((crumb, index) => (
            <span key={`${crumb.url}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && <ChevronLeft size={12} aria-hidden="true" />}
              {index === landing.breadcrumb.length - 1 ? (
                <span className="text-emerald-700 dark:text-lime-300">{crumb.title}</span>
              ) : (
                <Link to={crumb.url} className="hover:text-emerald-700 hover:underline dark:hover:text-lime-300">
                  {crumb.title}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <header className="mt-4 grid gap-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_240px] md:p-7 dark:border-emerald-900 dark:bg-emerald-950">
          <div>
            <p className="text-fluid-2xs font-bold text-emerald-700 dark:text-lime-300">
              {kind === 'brand' ? 'برند' : kind === 'tag' ? 'برچسب' : 'دسته محصولات'}
            </p>
            <h1 className="mt-1.5 text-2xl font-extrabold leading-10 text-slate-800 md:text-3xl dark:text-white">
              {landing.title}
            </h1>
            {landing.description && (
              <p className="mt-3 whitespace-pre-line text-fluid-sm leading-8 text-slate-600 dark:text-emerald-100">
                {landing.description}
              </p>
            )}
            <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-fluid-2xs font-bold text-slate-500 dark:text-emerald-200">
              <li>
                {landing.count.toLocaleString('fa-IR')} کالای منتشرشده در این {kind === 'brand' ? 'برند' : 'گروه'}
              </li>
              {landing.avg_rating > 0 && (
                <li className="inline-flex items-center gap-1">
                  <Star size={13} className="text-amber-500" aria-hidden="true" />
                  میانگین امتیاز {landing.avg_rating.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} از ۵
                </li>
              )}
              {landing.facets.price.max > 0 && (
                <li>
                  بازه قیمت فعلی: {formatPrice(landing.facets.price.min)} تا {formatPrice(landing.facets.price.max)} تومان
                </li>
              )}
            </ul>
          </div>
          {landing.image_url && (
            <img
              src={landing.image_url}
              alt={landing.title}
              className="h-40 w-full rounded-2xl object-cover md:h-full"
              loading="lazy"
            />
          )}
        </header>

        {landing.children.length > 0 && (
          <section className="mt-6" aria-label="زیرمجموعه‌ها">
            <h2 className="text-fluid-sm font-extrabold text-slate-700 dark:text-emerald-50">این گروه چه چیزهایی دارد؟</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {landing.children.map((child) => (
                <GroupCard key={`${child.kind}-${child.slug}`} card={child} />
              ))}
            </div>
          </section>
        )}

        {(landing.facets.brands.length > 1 || landing.facets.packages.length > 1) && (
          <section className="mt-6 flex flex-wrap gap-x-6 gap-y-3 rounded-2xl border border-slate-100 bg-white p-4 dark:border-emerald-900 dark:bg-emerald-950">
            {landing.facets.brands.length > 1 && (
              <div className="no-scrollbar flex flex-wrap items-center gap-2">
                <span className="text-fluid-2xs font-bold text-slate-400">برندهای این گروه:</span>
                {landing.facets.brands.slice(0, 10).map((brand) => (
                  <Link
                    key={brand.slug}
                    to={`/brand/${encodeURIComponent(brand.slug)}`}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-fluid-2xs font-bold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-800 dark:text-emerald-100"
                  >
                    {brand.name} ({brand.count.toLocaleString('fa-IR')})
                  </Link>
                ))}
              </div>
            )}
            {landing.facets.packages.length > 1 && (
              <div className="no-scrollbar flex flex-wrap items-center gap-2">
                <span className="text-fluid-2xs font-bold text-slate-400">بسته‌بندی‌ها:</span>
                {landing.facets.packages.map((pack) => (
                  <Link
                    key={pack.label}
                    to={`/products?package_weight=${encodeURIComponent(pack.label)}${queryTail(landing.filters)}`}
                    className="rounded-full bg-slate-50 px-2.5 py-1 text-fluid-2xs font-bold text-slate-600 hover:text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100"
                  >
                    {pack.label} ({pack.count.toLocaleString('fa-IR')})
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="mt-8" aria-label="محصولات">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">محصولات این صفحه</h2>
            <Link
              to={`/products${queryTail(landing.filters)}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-200 px-4 text-fluid-2xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:text-lime-300 dark:hover:bg-emerald-900/50"
            >
              همان گروه، با همه فیلترهای فروشگاه
              <ArrowLeft size={14} />
            </Link>
          </div>

          {empty ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-fluid-sm leading-8 text-slate-500 dark:border-emerald-800 dark:text-emerald-200">
              فعلاً کالای منتشرشده‌ای در این {kind === 'brand' ? 'برند' : 'گروه'} نیست. اگر دنبال کالای خاصی هستید، در
              میز مشاوره بپرسید؛ تأمین‌کننده‌ها هر هفته فهرست را به‌روز می‌کنند.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product, index) => (
                <LandingCard key={product.id} product={product} index={index} />
              ))}
            </div>
          )}
        </section>

        {landing.siblings.length > 0 && (
          <section className="mt-8" aria-label="گروه‌های هم‌سطح">
            <h2 className="text-fluid-sm font-extrabold text-slate-700 dark:text-emerald-50">گروه‌های هم‌سطح</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {landing.siblings.map((sibling) => (
                <GroupCard key={`${sibling.kind}-${sibling.slug}`} card={sibling} compact />
              ))}
            </div>
          </section>
        )}

        {landing.articles.length > 0 && (
          <section className="mt-8" aria-label="راهنماها">
            <h2 className="text-fluid-sm font-extrabold text-slate-700 dark:text-emerald-50">خواندنی‌های مرتبط</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {landing.articles.map((article) => (
                <li key={article.slug}>
                  <Link
                    to={`/blog/${article.slug}`}
                    className="block rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-emerald-200 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950"
                  >
                    <span className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">{article.title}</span>
                    <span className="mt-1.5 block text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-200">
                      {article.excerpt}
                    </span>
                    <span className="mt-2 block text-fluid-2xs font-bold text-emerald-700 dark:text-lime-300">
                      {article.reading_minutes.toLocaleString('fa-IR')} دقیقه مطالعه
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

/** `/products?category=x&is_featured=true` → `&category=x&is_featured=true`. */
function queryTail(filters: Record<string, string>) {
  const entries = Object.entries(filters || {});
  if (!entries.length) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

function GroupCard({ card, compact = false }: { card: { kind: CatalogKind; title: string; slug: string; image_url: string; description: string; count: number; url: string }; compact?: boolean }) {
  return (
    <Link
      to={card.url}
      className={cn(
        'flex gap-3 rounded-2xl border border-slate-100 bg-white p-3 transition hover:border-emerald-300 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950',
        compact && 'p-2.5',
      )}
    >
      {card.image_url ? (
        <img src={card.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" loading="lazy" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/50 dark:text-lime-300">
          <PackageSearch size={20} aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-fluid-sm font-extrabold text-slate-800 dark:text-white">{card.title}</span>
        {!compact && card.description && (
          <span className="mt-1 line-clamp-2 block text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-200">
            {card.description}
          </span>
        )}
        <span className="mt-1 block text-fluid-2xs font-bold text-emerald-700 dark:text-lime-300">
          {card.count.toLocaleString('fa-IR')} کالا
        </span>
      </span>
    </Link>
  );
}

/**
 * The same card the shop uses, so a filtered page and the catalogue never look
 * like two different shops.
 *
 * Adding from here buys the packaging the server marks as default — the choice
 * between bags is made on the product page, where each one's price and stock are
 * spelled out.
 */
function LandingCard({ product, index }: { product: MockProduct; index: number }) {
  const navigate = useNavigate();
  const wishlist = useWishlistStore((state) => state.wishlist);
  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const addToCart = useCartStore((state) => state.addToCart);

  return (
    <ProductCard
      product={product}
      index={index}
      isWishlisted={wishlist.some((item) => item.id === product.id)}
      isComparing={false}
      compareDisabled
      onToggleWishlist={toggleWishlist}
      onAddToCart={(item) => void addToCart(item.id)}
      onQuickView={(item) => navigate(`/products/${item.slug}`)}
      onToggleCompare={() => undefined}
    />
  );
}
