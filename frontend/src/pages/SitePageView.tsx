// frontend/src/pages/SitePageView.tsx
//
// Renders an admin-built page: `/page/<slug>` for information pages (bank
// accounts, environment, guarantees) and `/offer/<slug>` for a product landing
// page. The block vocabulary mirrors what a marketing page actually needs —
// tables of prices and specs, a video, and product/article grids that pull live
// catalogue rows — so a manager can rebuild a campaign page without a deploy.

import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import {
  ArrowLeft,
  BadgePercent,
  CheckCircle2,
  MessageCircle,
  PhoneCall,
  Quote,
  ShoppingCart,
} from 'lucide-react';
import toast from 'react-hot-toast';

import ArticleCard from '../components/article/ArticleCard';
import ArticleBody from '../components/article/ArticleBody';
import ConsultCard from '../components/product/ConsultCard';
import ProductCard from '../components/ProductCard';
import { articlesApi, productsApi, sitePagesApi } from '../api/services';
import { useCartStore } from '../store/cartStore';
import { convertToMockProduct } from '../utils/convertProduct';
import { formatPrice } from '../utils/formatPrice';
import type { MockProduct, SitePageBlock } from '../types';
import { cn } from '../utils/cn';
import FaqList, { faqPairsOfBlock } from '../components/FaqList';

export default function SitePageView({ kind }: { kind: 'page' | 'landing' }) {
  const { slug = '' } = useParams();
  const prefix = kind === 'landing' ? '/offer' : '/page';
  const { data: page, isLoading, isError } = useQuery({
    queryKey: ['site-page', slug],
    queryFn: async () => (await sitePagesApi.getBySlug(slug)).data,
    enabled: Boolean(slug),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (isError || !page) {
    return (
      <>
        <Helmet>
          <title>صفحه پیدا نشد | گرین کود</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <div className="mx-auto flex min-h-[50dvh] max-w-3xl flex-col items-center justify-center px-4 text-center">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">این صفحه در دسترس نیست</h1>
          <p className="mt-3 text-fluid-sm text-slate-500 dark:text-emerald-200">
            ممکن است منتشر نشده یا جابه‌جا شده باشد.
          </p>
          <Link to="/" className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">
            بازگشت به صفحه اصلی
          </Link>
        </div>
      </>
    );
  }

  const isLanding = kind === 'landing';
  const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
  const pageUrl = `${siteUrl}${prefix}/${page.slug}`;
  const seoTitle = page.seo_title || `${page.title} | گرین کود`;
  const seoDescription = page.seo_description || page.hero_text || page.title;

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content={isLanding ? 'product' : 'article'} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={pageUrl} />
        {page.hero_image_url && <meta property="og:image" content={new URL(page.hero_image_url, `${siteUrl}/`).href} />}
      </Helmet>

      <main className="page-shell py-8 md:py-10">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 text-fluid-sm font-bold text-emerald-700 dark:text-lime-300"
        >
          <ArrowLeft size={18} />
          بازگشت
        </Link>

        <header
          className={cn(
            'mt-4 overflow-hidden rounded-3xl border',
            isLanding
              ? 'border-transparent bg-[linear-gradient(120deg,#065f46_0%,#047857_55%,#65a30d_100%)] text-white'
              : 'border-slate-100 bg-white shadow-sm dark:border-emerald-900 dark:bg-emerald-950',
          )}
        >
          <div className={cn('grid gap-6 p-6 sm:p-9', page.hero_image_url && 'lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center')}>
            <div>
              {page.badge && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-fluid-2xs font-bold',
                    isLanding ? 'bg-white/15' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
                  )}
                >
                  <BadgePercent size={13} />
                  {page.badge}
                </span>
              )}
              <h1
                className={cn(
                  'mt-3 text-fluid-2xl font-extrabold leading-12',
                  isLanding ? 'text-white' : 'text-slate-800 dark:text-white',
                )}
              >
                {page.title}
              </h1>
              {page.hero_text && (
                <p
                  className={cn(
                    'mt-3 max-w-2xl text-fluid-sm leading-8',
                    isLanding ? 'text-emerald-50' : 'text-slate-500 dark:text-emerald-200',
                  )}
                >
                  {page.hero_text}
                </p>
              )}

              {page.cta_label && (
                <a
                  href={page.cta_url || '/contact'}
                  className={cn(
                    'mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-fluid-sm font-extrabold transition',
                    isLanding ? 'bg-white text-emerald-800 hover:bg-emerald-50' : 'bg-emerald-600 text-white hover:bg-emerald-700',
                  )}
                >
                  <PhoneCall size={17} />
                  {page.cta_label}
                </a>
              )}
            </div>

            {page.hero_image_url && (
              <img
                src={page.hero_image_url}
                alt=""
                className="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
        </header>

        {isLanding && page.product && <LandingProduct product={page.product} />}

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {page.blocks.map((block) => (
              <Block key={block.id} block={block} />
            ))}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {isLanding ? (
              <ConsultCard
                productTitle={page.product?.title || page.title}
                productUrl={pageUrl}
              />
            ) : (
              <div className="rounded-3xl border border-emerald-100 bg-white p-5 dark:border-emerald-900 dark:bg-emerald-950">
                <p className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">سؤالی دارید؟</p>
                <p className="mt-1.5 text-fluid-xs leading-7 text-slate-500 dark:text-emerald-200">
                  تیم پشتیبانی در ساعات کاری پاسخ می‌دهد؛ برای سفارش‌ها کد پیگیری را همراه داشته باشید.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Link
                    to="/contact"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-fluid-xs font-bold text-white"
                  >
                    <MessageCircle size={16} />
                    تماس با ما
                  </Link>
                  <Link
                    to="/support"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 px-4 text-fluid-xs font-bold text-emerald-700 dark:border-emerald-800 dark:text-lime-300"
                  >
                    ثبت پیشنهاد یا شکایت
                  </Link>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

/** The product box on a landing page: price, stock and one cart action. */
function LandingProduct({
  product,
}: {
  product: NonNullable<import('../types').SitePage['product']>;
}) {
  const addToCart = useCartStore((state) => state.addToCart);
  const price = product.discounted_price || product.price;

  async function add() {
    try {
      await addToCart(product.id, 1);
      toast.success('به سبد خرید اضافه شد.');
    } catch {
      // The cart store reports the failure.
    }
  }

  return (
    <section className="mt-5 flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5 dark:border-emerald-900 dark:bg-emerald-950">
      <img src={product.image_url} alt={product.title} className="h-24 w-28 shrink-0 rounded-2xl object-cover" />
      <div className="min-w-0 flex-1">
        <Link to={`/products/${product.slug}`} className="text-fluid-sm font-extrabold text-slate-800 hover:text-emerald-700 dark:text-white">
          {product.title}
        </Link>
        <p className="mt-1 flex items-center gap-2 text-fluid-xs text-slate-500 dark:text-emerald-300">
          <CheckCircle2 size={14} className="text-emerald-600 dark:text-lime-300" />
          {product.is_in_stock ? 'موجود در انبار' : 'پیش‌سفارش'}
        </p>
      </div>
      <div className="text-start sm:text-end">
        <p className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">
          {product.price_on_request ? 'تماس بگیرید' : `${formatPrice(price)} تومان`}
        </p>
        {!product.price_on_request && (
          <button
            type="button"
            onClick={() => void add()}
            disabled={!product.is_in_stock}
            className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-gradient-to-l from-emerald-600 to-lime-500 px-4 text-fluid-xs font-bold text-white disabled:opacity-50"
          >
            <ShoppingCart size={15} />
            افزودن
          </button>
        )}
      </div>
    </section>
  );
}

function Block({ block }: { block: SitePageBlock }) {
  switch (block.block_type) {
    case 'heading':
      return (
        <h2 className="text-fluid-xl font-extrabold leading-10 text-slate-800 dark:text-white">
          {block.title}
          {block.text && <span className="mt-1 block text-fluid-sm font-normal leading-8 text-slate-500 dark:text-emerald-200">{block.text}</span>}
        </h2>
      );

    case 'bullets':
      return (
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
          {block.title && <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">{block.title}</h2>}
          <ul className={cn('grid gap-2', block.text.split('\n').filter(Boolean).length > 3 && 'sm:grid-cols-2')}>
            {block.text
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2 rounded-2xl bg-emerald-50/70 p-3 text-fluid-sm leading-7 text-slate-700 dark:bg-emerald-900/40 dark:text-emerald-100"
                >
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-lime-300" />
                  {line}
                </li>
              ))}
          </ul>
        </section>
      );

    case 'image':
      if (!block.image_url) return null;
      return (
        <figure>
          <img src={block.image_url} alt={block.title || ''} className="w-full rounded-3xl object-cover shadow-sm" loading="lazy" />
          {block.text && <figcaption className="mt-2 text-center text-fluid-2xs text-slate-400">{block.text}</figcaption>}
        </figure>
      );

    case 'spec_table':
    case 'price_table': {
      const rows = block.rows || [];
      if (!rows.length) return null;
      const isPrice = block.block_type === 'price_table';
      return (
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
          {block.title && (
            <h2 className="border-b border-slate-100 px-5 py-3.5 text-fluid-sm font-extrabold text-slate-800 dark:border-emerald-900 dark:text-white">
              {block.title}
            </h2>
          )}
          {/* A table that does not fit is scrolled, never clipped: `overflow-hidden`
              on the card would otherwise cut the last column off the page. */}
          <div className="overflow-x-auto overscroll-contain">
          <table className="w-full min-w-[30rem] text-fluid-sm">
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={index}
                  className={cn(
                    'border-b border-slate-50 last:border-0 dark:border-emerald-900/60',
                    isPrice && index === 0 && 'bg-slate-50 font-bold dark:bg-emerald-900/40',
                  )}
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        'px-5 py-2.5 align-top leading-7',
                        cellIndex === 0
                          ? 'font-bold text-slate-700 dark:text-emerald-50'
                          : 'text-slate-600 dark:text-emerald-200',
                        !isPrice && cellIndex > 1 && 'hidden',
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {block.text && <p className="border-t border-slate-100 px-5 py-3 text-fluid-2xs text-slate-400 dark:border-emerald-900">{block.text}</p>}
        </section>
      );
    }

    case 'video':
      if (!block.video_url) {
        return (
          <p className="rounded-3xl border border-dashed border-emerald-200 bg-white/60 p-5 text-fluid-xs text-slate-500 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            فایل ویدئو برای این بلوک آپلود نشده است (از پنل: بلوک صفحه ← فایل ویدئو).
          </p>
        );
      }
      return (
        <figure className="overflow-hidden rounded-3xl border border-slate-100 bg-black dark:border-emerald-900">
          <video src={block.video_url} controls playsInline className="max-h-[420px] w-full" />
          {block.title && <figcaption className="bg-white px-4 py-2.5 text-fluid-xs font-bold text-slate-700 dark:bg-emerald-950 dark:text-white">{block.title}</figcaption>}
        </figure>
      );

    case 'products':
      return <BlockProductGrid block={block} />;

    case 'articles':
      return <BlockArticleGrid block={block} />;

    case 'quote':
      return (
        <blockquote className="rounded-3xl bg-emerald-50 p-5 text-fluid-sm leading-8 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-50">
          <Quote size={18} className="mb-2 text-emerald-600 dark:text-lime-300" />
          {block.text}
          {block.title && <footer className="mt-2 text-fluid-2xs font-bold">{block.title}</footer>}
        </blockquote>
      );

    case 'cta':
      return (
        <section className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-slate-900 p-6 sm:flex-row sm:items-center">
          <div>
            {block.title && <h2 className="text-fluid-lg font-extrabold text-white">{block.title}</h2>}
            {block.text && <p className="mt-1.5 max-w-xl text-fluid-sm leading-7 text-slate-300">{block.text}</p>}
          </div>
          <a
            href={block.link || '/contact'}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-lime-400 px-5 text-fluid-sm font-extrabold text-emerald-950"
          >
            <PhoneCall size={17} />
            {block.title ? 'مشاوره و سفارش' : 'تماس بگیرید'}
          </a>
        </section>
      );

    case 'faq':
      // The same accordion /faq builds, so a page that carries questions never
      // renders them differently from the questions page.
      return <FaqList title={block.title} pairs={faqPairsOfBlock(block)} />;

    case 'text':
    default:
      return (
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 dark:border-emerald-900 dark:bg-emerald-950">
          {block.title && <h2 className="mb-2 text-fluid-lg font-extrabold text-slate-800 dark:text-white">{block.title}</h2>}
          <ArticleBody body={block.text} />
        </section>
      );
  }
}

/** Live catalogue rows for a `{"category": "...", "limit": 8}` block. */
function BlockProductGrid({ block }: { block: SitePageBlock }) {
  const category = typeof block.data?.category === 'string' ? block.data.category : undefined;
  const limit = typeof block.data?.limit === 'number' ? block.data.limit : 8;
  const ordering = typeof block.data?.ordering === 'string' ? block.data.ordering : '-sales_count';

  const { data } = useQuery({
    queryKey: ['page-block-products', category ?? 'all', ordering, limit],
    queryFn: async () =>
      (
        await productsApi.getAll({
          category,
          ordering,
          page_size: limit,
        })
      ).data,
    staleTime: 5 * 60 * 1000,
  });

  const items: MockProduct[] = (data?.results || []).map((item) => convertToMockProduct(item));
  if (!items.length) return null;

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      {block.title && <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">{block.title}</h2>}
      {block.text && <p className="mt-1 text-fluid-xs text-slate-500 dark:text-emerald-200">{block.text}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.slice(0, limit).map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            index={index}
            isWishlisted={false}
            isComparing={false}
            compareDisabled
            onToggleWishlist={() => undefined}
            onAddToCart={() => undefined}
            onQuickView={() => undefined}
            onToggleCompare={() => undefined}
          />
        ))}
      </div>
      <Link to="/products" className="mt-4 inline-flex min-h-10 items-center text-fluid-xs font-bold text-emerald-700 underline dark:text-lime-300">
        مشاهده همه محصولات
      </Link>
    </section>
  );
}

function BlockArticleGrid({ block }: { block: SitePageBlock }) {
  const kind = block.data?.kind === 'article' || block.data?.kind === 'guide' ? (block.data.kind as 'article' | 'guide') : undefined;
  const limit = typeof block.data?.limit === 'number' ? block.data.limit : 3;

  const { data = [] } = useQuery({
    queryKey: ['page-block-articles', kind ?? 'all', limit],
    queryFn: async () => (await articlesApi.getAll({ kind, limit })).data,
    staleTime: 5 * 60 * 1000,
  });

  if (!data.length) return null;

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      {block.title && <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">{block.title}</h2>}
      {block.text && <p className="mt-1 text-fluid-xs text-slate-500 dark:text-emerald-200">{block.text}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
