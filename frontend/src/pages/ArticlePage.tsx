// frontend/src/pages/ArticlePage.tsx
//
// One article or growing guide: sticky table of contents generated from the
// same "## " headings the API publishes, the body, and the catalogue/listings
// the guide recommends. A guide is a buying page as much as a reading page, so
// the product strip sits right after the section it concerns.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Clock3,
  Eye,
  ListOrdered,
  Package,
  Sprout,
} from 'lucide-react';

import ArticleBody from '../components/article/ArticleBody';
import ArticleCard, { articleHref, faDate } from '../components/article/ArticleCard';
import SharePanel from '../components/SharePanel';
import { articlesApi } from '../api/services';
import { formatPrice } from '../utils/formatPrice';
import { cn } from '../utils/cn';

const FALLBACK_IMAGE = '/images/hero-farm.jpg';

export default function ArticlePage() {
  const { slug = '' } = useParams();
  const [activeAnchor, setActiveAnchor] = useState('');

  const { data: article, isLoading, isError } = useQuery({
    queryKey: ['article', slug],
    queryFn: async () => (await articlesApi.getBySlug(slug)).data,
    enabled: Boolean(slug),
    staleTime: 60_000,
  });

  const { data: related = [] } = useQuery({
    queryKey: ['article-related', slug],
    queryFn: async () => (await articlesApi.getRelated(slug)).data,
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });

  // Headings come from the rendered body so the TOC and the DOM ids can never
  // drift apart; the API's `headings` list is the fallback.
  const toc = useMemo(() => {
    if (!article) return [];
    return article.headings.length ? article.headings : [];
  }, [article]);

  useEffect(() => {
    if (!toc.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveAnchor(visible.target.id);
      },
      { rootMargin: '-96px 0px -70% 0px' },
    );
    toc.forEach((heading) => {
      const node = document.getElementById(heading.anchor);
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [toc]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (isError || !article) {
    return (
      <>
        <Helmet>
          <title>مطلب پیدا نشد | گرین کود</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">این مطلب پیدا نشد</h1>
          <p className="mt-3 text-fluid-sm text-slate-500 dark:text-emerald-200">
            ممکن است بازنویسی شده یا هنوز منتشر نشده باشد.
          </p>
          <Link to="/blog" className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">
            رفتن به مجله گرین کود
          </Link>
        </div>
      </>
    );
  }

  const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
  const pageUrl = `${siteUrl}${articleHref(article)}`;
  const imageUrl = new URL(article.cover_url || FALLBACK_IMAGE, `${siteUrl}/`).href;
  const seoTitle = article.seo_title || `${article.title} | گرین کود`;
  const seoDescription = article.seo_description || article.excerpt || `${article.title} — مجله گرین کود`;
  const isGuide = article.kind === 'guide';

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': isGuide ? 'HowTo' : 'Article',
        headline: article.title,
        description: seoDescription,
        image: [imageUrl],
        datePublished: article.published_at || undefined,
        dateModified: article.updated_at,
        author: { '@type': 'Organization', name: article.author_name || 'گرین کود' },
        publisher: { '@type': 'Organization', name: 'گرین کود', url: `${siteUrl}/` },
        mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
        ...(isGuide && article.crop ? { about: [{ '@type': 'Crop', name: article.crop }] } : {}),
        ...(toc.length
          ? {
              hasPart: toc.map((heading, index) => ({
                '@type': 'HowToSection',
                name: heading.title,
                position: index + 1,
              })),
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'گرین کود', item: `${siteUrl}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: isGuide ? 'راهنمای کشت' : 'مجله گرین کود',
            item: `${siteUrl}${isGuide ? '/guides' : '/blog'}`,
          },
          { '@type': 'ListItem', position: 3, name: article.title, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={imageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <article className="page-shell py-8 md:py-10">
        <Link
          to={isGuide ? '/guides' : '/blog'}
          className="inline-flex min-h-11 items-center gap-2 text-fluid-sm font-bold text-emerald-700 hover:text-emerald-900 dark:text-lime-300"
        >
          <ArrowRight size={18} />
          {isGuide ? 'همه راهنماهای کشت' : 'مجله گرین کود'}
        </Link>

        <header className="mt-4 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-fluid-2xs font-bold">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1',
                isGuide
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
              )}
            >
              {isGuide ? <Sprout size={13} /> : <BookOpenCheck size={13} />}
              {article.kind_label}
            </span>
            {article.crop && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-emerald-900/60 dark:text-emerald-100">
                {article.crop}
              </span>
            )}
          </div>
          <h1 className="mt-3 text-fluid-2xl font-extrabold leading-12 text-slate-800 dark:text-white">{article.title}</h1>
          {article.excerpt && (
            <p className="mt-3 text-fluid-sm leading-8 text-slate-500 dark:text-emerald-200">{article.excerpt}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-fluid-2xs text-slate-400">
            <span>نویسنده: {article.author_name}</span>
            {article.published_at && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={13} />
                انتشار {faDate(article.published_at)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock3 size={13} />
              {article.reading_minutes.toLocaleString('fa-IR')} دقیقه مطالعه
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye size={13} />
              {article.views.toLocaleString('fa-IR')} بازدید
            </span>
            {article.updated_at && <span>به‌روزرسانی: {faDate(article.updated_at)}</span>}
          </div>
        </header>

        {article.cover && (
          <figure className="mt-6 overflow-hidden rounded-3xl border border-slate-100 dark:border-emerald-900">
            <img src={article.cover_url} alt="" className="max-h-[420px] w-full object-cover" />
          </figure>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
          {/* Side rail */}
          <aside className="order-2 space-y-4 lg:order-1">
            {toc.length > 1 && (
              <nav
                aria-label="فهرست مطالب"
                className="rounded-2xl border border-slate-100 bg-white p-4 lg:sticky lg:top-24 dark:border-emerald-900 dark:bg-emerald-950"
              >
                <p className="flex items-center gap-1.5 text-fluid-xs font-extrabold text-slate-700 dark:text-white">
                  <ListOrdered size={15} className="text-emerald-600 dark:text-lime-300" />
                  فهرست مطالب
                </p>
                <ul className="mt-3 space-y-1">
                  {toc.map((heading, index) => (
                    <li key={heading.anchor}>
                      <a
                        href={`#${heading.anchor}`}
                        className={cn(
                          'flex gap-2 rounded-lg px-2 py-1.5 text-fluid-xs leading-6 transition-colors',
                          activeAnchor === heading.anchor
                            ? 'bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-lime-300'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/40',
                        )}
                      >
                        <span className="text-slate-300 dark:text-emerald-700">{(index + 1).toLocaleString('fa-IR')}</span>
                        {heading.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <div className="rounded-2xl border border-slate-100 bg-white p-4 lg:sticky lg:top-24 dark:border-emerald-900 dark:bg-emerald-950">
              <p className="text-fluid-xs font-extrabold text-slate-700 dark:text-white">این مطلب را با دیگران به‌اشتراک بگذارید</p>
              <SharePanel
                url={pageUrl}
                title={article.title}
                text={article.excerpt || ''}
                variant="icons"
                className="mt-2"
              />
            </div>

            {article.products.length > 0 && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-800 dark:bg-emerald-900/40">
                <p className="flex items-center gap-1.5 text-fluid-xs font-extrabold text-emerald-800 dark:text-lime-300">
                  <Package size={15} />
                  نهاده‌های پیشنهادی این مطلب
                </p>
                <ul className="mt-3 space-y-2">
                  {article.products.slice(0, 4).map((product) => (
                    <li key={product.id}>
                      <Link
                        to={`/products/${product.slug}`}
                        className="flex items-center gap-2 rounded-xl bg-white p-2 transition hover:shadow-md dark:bg-emerald-950"
                      >
                        <img
                          src={product.image_url || FALLBACK_IMAGE}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          onError={(event) => {
                            event.currentTarget.src = FALLBACK_IMAGE;
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-fluid-xs font-bold text-slate-700 dark:text-white">
                            {product.title}
                          </span>
                          <span className="block text-fluid-2xs text-emerald-700 dark:text-lime-300">
                            {product.price_on_request ? 'قیمت با تماس' : `${formatPrice(product.discounted_price ?? product.price)} تومان`}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/products"
                  className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-3 text-fluid-2xs font-bold text-white"
                >
                  مشاهده فروشگاه
                </Link>
              </div>
            )}
          </aside>

          {/* Body */}
          <div className="order-1 min-w-0 lg:order-2">
            <ArticleBody body={article.body} />

            {article.listings.length > 0 && (
              <section className="mt-8 rounded-3xl border border-slate-100 bg-white p-5 dark:border-emerald-900 dark:bg-emerald-950">
                <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">
                  محصول این گیاه در غرفه‌های کشاورزان
                </h2>
                <p className="mt-1 text-fluid-xs text-slate-500 dark:text-emerald-200">
                  آگهی‌هایی که برای همین محصول ثبت و بررسی شده‌اند؛ قیمت و موجودی نزد غرفه‌دار است.
                </p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {article.listings.map((listing) => (
                    <li key={listing.id}>
                      <Link
                        to={`/storefronts/${listing.storefront_slug}?listing=${listing.slug}`}
                        className="flex h-full items-center gap-3 rounded-2xl border border-slate-100 p-3 transition hover:border-emerald-300 dark:border-emerald-900"
                      >
                        <img
                          src={listing.image_url || FALLBACK_IMAGE}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                          onError={(event) => {
                            event.currentTarget.src = FALLBACK_IMAGE;
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-fluid-sm font-bold text-slate-800 dark:text-white">
                            {listing.title}
                          </span>
                          <span className="block text-fluid-2xs text-slate-500 dark:text-emerald-300">
                            {listing.storefront_name} · {formatPrice(listing.price)} تومان / {listing.unit}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {related.length > 0 && (
              <section className="mt-9">
                <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">مطالب مرتبط</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {related.map((item) => (
                    <ArticleCard key={item.id} article={item} variant="row" />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </article>
    </>
  );
}
