// frontend/src/pages/Home.tsx

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';

import { articlesApi, productsApi } from '../api/services';
import type { ProductList } from '@/types/shop';
import Hero from '../components/home/Hero';
import CategoryRail from '../components/home/CategoryRail';
import DealsPanel from '../components/home/DealsPanel';
import MarketPanel from '../components/home/MarketPanel';
import ServicePanel from '../components/home/ServicePanel';
import SectionHead from '../components/home/SectionHead';
import Reveal from '../components/ui/Reveal';
import ProductCard from '../components/shop/ProductCard';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import { nums } from '../lib/price';
import { useTitle } from '../lib/useTitle';

/**
 * The front page.
 *
 * Order is an argument, not a template:
 *   1. hero — what this is, and the two ways in.
 *   2. departments — "where is the fertiliser" answered in one row.
 *   3. deals — the deepest live discounts, with no invented deadline.
 *   4. best sellers — proof that other people buy here.
 *   5. the market — the platform's actual differentiator, above the fold-line
 *      it used to sit under.
 *   6. services — the rest of what the business does.
 *   7. from the magazine — expertise, last, because nobody arrives for it.
 *
 * Exactly one Reveal on this route (the market panel), per the taste rule of
 * one dealt moment per page; everything else is already visible.
 */
export default function Home() {
  useTitle('صفحهٔ اصلی');
  const bestSellers = useQuery({
    queryKey: ['home-best-sellers'],
    queryFn: async () => (await productsApi.getAll({ ordering: '-sales_count', page_size: 8 })).data,
    staleTime: 5 * 60 * 1000,
  });

  const newest = useQuery({
    queryKey: ['home-newest'],
    queryFn: async () => (await productsApi.getAll({ ordering: '-created', page_size: 8 })).data,
    staleTime: 5 * 60 * 1000,
  });

  const articles = useQuery({
    queryKey: ['home-articles'],
    queryFn: async () => (await articlesApi.getAll({ limit: 3 })).data,
    staleTime: 10 * 60 * 1000,
  });

  const best = bestSellers.data?.results ?? [];
  const fresh = newest.data?.results ?? [];
  const posts = articles.data ?? [];

  return (
    <>
      <Hero />
      <CategoryRail />
      <DealsPanel />

      <section aria-labelledby="best-title" className="section shell">
        <SectionHead
          id="best-title"
          title="پرفروش‌ترین کالاها"
          hint="بر اساس تعداد سفارش ثبت‌شده در گرین‌کود، نه بر اساس تبلیغ."
          action={{ to: '/products?ordering=-sales_count', label: 'همهٔ پرفروش‌ها' }}
        />
        <div className="mt-4">
          {bestSellers.isLoading ? (
            <CardGridSkeleton count={4} label="در حال بارگذاری پرفروش‌ها" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {best.map((product: ProductList) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Reveal>
        <MarketPanel />
      </Reveal>

      <ServicePanel />

      <section aria-labelledby="fresh-title" className="section shell">
        <SectionHead
          id="fresh-title"
          title="تازه‌های انبار"
          hint={`${nums(fresh.length)} کالایی که در هفته‌های اخیر به کاتالوگ اضافه شده‌اند.`}
          action={{ to: '/products?ordering=-created', label: 'دیدن همه' }}
        />
        <div className="mt-4">
          {newest.isLoading ? (
            <CardGridSkeleton count={4} label="در حال بارگذاری تازه‌ها" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {fresh.map((product: ProductList) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {posts.length > 0 && (
        <section aria-labelledby="magazine-title" className="section shell">
          <SectionHead
            id="magazine-title"
            title="از مجلهٔ کشاورزی"
            hint="راهنمای فصل کشت، مدیریت آفات و انتخاب نهاده — نوشتهٔ کارشناسان."
            action={{ to: '/magazine', label: 'همهٔ مقاله‌ها' }}
          />
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  to={`/magazine/${post.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-paper transition-[border-color,box-shadow] duration-[var(--dur-state)] ease-[var(--ease-out)] hover:border-brand-300 hover:shadow-[var(--shadow-card)] dark:border-night-line dark:bg-night-soft dark:hover:border-brand-700"
                >
                  {post.cover_url && (
                    <img
                      src={post.cover_url}
                      alt=""
                      width={480}
                      height={270}
                      loading="lazy"
                      className="h-36 w-full object-cover transition-transform duration-[var(--dur-image)] ease-[var(--ease-out)] group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
                    />
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="line-clamp-2 text-xs font-extrabold leading-6 text-ink dark:text-white">{post.title}</h3>
                    {post.excerpt && (
                      <p className="line-clamp-2 text-2xs leading-6 text-ink-mute dark:text-white/50">{post.excerpt}</p>
                    )}
                    <span className="mt-auto inline-flex items-center gap-1 pt-2 text-2xs font-bold text-brand-700 dark:text-brand-300">
                      خواندن
                      <ArrowLeft size={13} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* A closing invitation to sell, since half the audience is a farmer with
          produce and no shop. It is one line and one link, not a gradient slab. */}
      <section className="shell pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-5 py-4 dark:border-brand-800 dark:bg-night-soft">
          <p className="flex items-center gap-2 text-xs font-bold text-brand-900 dark:text-brand-100">
            <TrendingUp size={16} aria-hidden="true" />
            محصول داری؟ غرفه‌ات را همین امروز بساز و مستقیم بفروش.
          </p>
          <Link
            to="/farmers"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-sm bg-brand-700 px-4 text-2xs font-extrabold text-white transition-colors duration-150 hover:bg-brand-800"
          >
            شروع غرفه‌داری
            <ArrowLeft size={13} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
