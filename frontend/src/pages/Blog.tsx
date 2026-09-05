// frontend/src/pages/Blog.tsx
//
// The site-wide magazine: editorial articles plus every storefront-independent
// growing guide. `/blog` shows both, `/guides` shows only «راهنمای کشت» with the
// crop index, mirroring how a nursery site organises its plant advice.

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Search, Sprout, X } from 'lucide-react';

import ArticleCard, { articleHref } from '../components/article/ArticleCard';
import RouteSeo from '../components/RouteSeo';
import { articlesApi } from '../api/services';
import { cn } from '../utils/cn';

type View = 'all' | 'article' | 'guide';

const TABS: Array<{ id: View; label: string; hint: string }> = [
  { id: 'all', label: 'همه مطالب', hint: 'مقاله‌ها و راهنماهای کشت' },
  { id: 'article', label: 'مقاله‌ها', hint: 'تحلیل بازار و آموزش' },
  { id: 'guide', label: 'راهنمای کشت', hint: 'گام‌به‌گام هر گیاه' },
];

export default function Blog({ fixedKind }: { fixedKind?: 'guide' | 'article' }) {
  const [searchParams] = useSearchParams();
  // /blog?kind=article keeps a single component for both views, so a "مقاله‌ها"
  // tab is a real URL a reader can share.
  const queryKind = searchParams.get('kind');
  const kind = fixedKind || (queryKind === 'article' || queryKind === 'guide' ? queryKind : undefined);
  const [search, setSearch] = useState('');
  const [crop, setCrop] = useState('');
  const isGuideHub = kind === 'guide';

  const { data: articles = [], isFetching } = useQuery({
    queryKey: ['articles', kind || 'all', search.trim(), crop],
    queryFn: async () =>
      (
        await articlesApi.getAll({
          kind: kind,
          search: search.trim() || undefined,
          crop: crop || undefined,
          limit: 24,
        })
      ).data,
    staleTime: 60_000,
  });

  const { data: crops = [] } = useQuery({
    queryKey: ['article-crops'],
    queryFn: async () => (await articlesApi.getCrops()).data,
    enabled: isGuideHub,
    staleTime: 10 * 60 * 1000,
  });

  const { data: featured = [] } = useQuery({
    queryKey: ['articles', 'featured'],
    queryFn: async () => (await articlesApi.getAll({ featured: true, limit: 3 })).data,
    enabled: !isGuideHub && !search.trim() && !crop,
    staleTime: 5 * 60 * 1000,
  });

  const hero = featured.find((item) => item.kind !== 'guide') || featured[0];

  return (
    <main className="page-shell py-8 md:py-10">
      <RouteSeo />

      <header className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-fluid-2xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
          <BookOpen size={14} />
          {isGuideHub ? 'راهنمای کشت' : 'مجله گرین کود'}
        </span>
        <h1 className="mt-3 text-fluid-2xl font-extrabold leading-12 text-slate-800 dark:text-white">
          {isGuideHub ? 'هر گیاه، یک برنامه کشت کامل' : 'آنچه پیش از خرید باید بدانید'}
        </h1>
        <p className="mt-3 leading-8 text-slate-500 dark:text-emerald-200">
          {isGuideHub
            ? 'آب‌وهوا، خاک، کاشت، داشت، برداشت و نگهداری؛ همراه با بذر و نهاده‌هایی که برای همان گیاه در فروشگاه و غرفه‌ها موجود است.'
            : 'تحلیل قیمت، راهنمای مصرف نهاده‌ها و آموزش‌های کوتاه که از تجربه مزرعه‌های واقعی نوشته شده است.'}
        </p>
      </header>

      {/* Controls */}
      <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {!fixedKind && (
          <div className="flex gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-emerald-900/60" role="tablist" aria-label="نوع مطلب">
            {TABS.map((tab) => (
              <Link
                key={tab.id}
                to={tab.id === 'all' ? '/blog' : tab.id === 'guide' ? '/guides' : '/blog?kind=article'}
                role="tab"
                aria-selected={tab.id === (kind || 'all')}
                className={cn(
                  'flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-fluid-xs font-bold transition',
                  tab.id === (kind || 'all')
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-lime-300'
                    : 'text-slate-500 dark:text-emerald-300',
                )}
              >
                {tab.id === 'guide' && <Sprout size={15} />}
                {tab.label}
              </Link>
            ))}
          </div>
        )}

        <label className="relative flex-1 lg:max-w-sm">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو در عنوان و متن مطالب..."
            aria-label="جستجو در مقالات"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pe-10 ps-10 text-fluid-sm outline-none transition focus:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="پاک کردن جستجو"
              className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
            >
              <X size={16} />
            </button>
          )}
        </label>
      </div>

      {isGuideHub && crops.length > 0 && (
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="فهرست گیاهان">
          <button
            type="button"
            onClick={() => setCrop('')}
            className={cn(
              'min-h-11 shrink-0 rounded-full px-4 text-fluid-xs font-bold transition',
              !crop ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800',
            )}
          >
            همه گیاهان
          </button>
          {crops.map((item) => (
            <button
              key={item.crop}
              type="button"
              onClick={() => setCrop(item.crop === crop ? '' : item.crop)}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-fluid-xs font-bold transition',
                item.crop === crop
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800',
              )}
            >
              {item.crop}
              <span className="rounded-full bg-emerald-50 px-1.5 text-fluid-2xs text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
                {item.article_count.toLocaleString('fa-IR')}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Lead article */}
      {hero && !search.trim() && !crop && (
        <section className="mt-7 overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-l from-emerald-50 to-white dark:border-emerald-900 dark:from-emerald-900/60 dark:to-emerald-950">
          <Link to={articleHref(hero)} className="grid gap-4 p-5 md:grid-cols-[1.1fr_1fr] md:items-center md:p-7">
            <div>
              <span className="text-fluid-2xs font-bold text-emerald-700 dark:text-lime-300">
                {hero.kind === 'guide' ? 'راهنمای منتخب این هفته' : 'مطلب منتخب این هفته'}
              </span>
              <h2 className="mt-2 text-fluid-xl font-extrabold leading-9 text-slate-800 dark:text-white">{hero.title}</h2>
              <p className="mt-2 line-clamp-3 text-fluid-sm leading-8 text-slate-500 dark:text-emerald-200">{hero.excerpt}</p>
              <span className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 text-fluid-xs font-bold text-white">
                خواندن مطلب
              </span>
            </div>
            <img
              src={hero.cover_url || '/images/hero-farm.jpg'}
              alt=""
              className="aspect-[16/10] w-full rounded-2xl object-cover shadow-lg"
              onError={(event) => {
                event.currentTarget.src = '/images/hero-farm.jpg';
              }}
            />
          </Link>
        </section>
      )}

      {/* Grid */}
      <section className="mt-7" aria-live="polite">
        {isFetching && !articles.length ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          </div>
        ) : articles.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-emerald-200 bg-white/60 p-10 text-center dark:border-emerald-800 dark:bg-emerald-950/50">
            <p className="text-fluid-lg font-extrabold text-slate-700 dark:text-white">مطالبی با این فیلترها پیدا نشد</p>
            <p className="mt-2 text-fluid-sm text-slate-500 dark:text-emerald-200">
              عبارت جستجو را کوتاه‌تر کنید یا فهرست گیاهان را تغییر دهید.
            </p>
            {(search || crop) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCrop('');
                }}
                className="mt-4 min-h-11 rounded-xl bg-emerald-600 px-4 text-fluid-xs font-bold text-white"
              >
                حذف فیلترها
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
