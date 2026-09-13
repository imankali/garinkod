// frontend/src/components/home/HomeMagazine.tsx

import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Newspaper } from 'lucide-react';

import ArticleCard from '../article/ArticleCard';
import { articlesApi } from '../../api/services';

/**
 * «مجله کشاورزی گرین کود» — the magazine block that used to live inside
 * ContentRails, extracted as its own component so the home page's rails and
 * its editorial block evolve independently.
 *
 * The block removes itself when nothing is published; an empty magazine on a
 * home page reads as a broken page.
 */
export default function HomeMagazine() {
  const { data: articles = [] } = useQuery({
    queryKey: ['home-magazine'],
    queryFn: async () => (await articlesApi.getAll({ limit: 4 })).data,
    staleTime: 10 * 60 * 1000,
  });

  if (!articles.length) return null;

  return (
    <section
      aria-labelledby="home-magazine-title"
      className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6 dark:border-emerald-900 dark:bg-emerald-950"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="home-magazine-title"
            className="flex items-center gap-2 text-fluid-lg font-extrabold text-slate-800 dark:text-white"
          >
            <Newspaper size={17} className="text-emerald-600 dark:text-lime-300" aria-hidden="true" />
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
          <ArrowLeft size={14} aria-hidden="true" />
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
    </section>
  );
}
