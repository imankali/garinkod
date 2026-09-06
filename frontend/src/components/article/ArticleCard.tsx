// frontend/src/components/article/ArticleCard.tsx
//
// One magazine card. Used by /blog, the home-page "مجله گرین کود" block and the
// related-articles strip on a guide, so the date format, the kind chip and the
// reading time stay identical everywhere.

import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, Sprout } from 'lucide-react';

import type { SiteArticleCard } from '../../types';
import { cn } from '../../utils/cn';

const FALLBACK_IMAGE = '/images/hero-farm.jpg';

export function articleHref(article: Pick<SiteArticleCard, 'slug' | 'kind'>) {
  return article.kind === 'guide' ? `/guides/${article.slug}` : `/blog/${article.slug}`;
}

export function faDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ArticleCard({
  article,
  variant = 'card',
  className,
}: {
  article: SiteArticleCard;
  /** `row` is the compact one-line form used in related lists. */
  variant?: 'card' | 'row';
  className?: string;
}) {
  if (variant === 'row') {
    return (
      <Link
        to={articleHref(article)}
        className={cn(
          'group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 transition hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950',
          className,
        )}
      >
        <img
          src={article.cover_url || FALLBACK_IMAGE}
          alt=""
          className="h-14 w-16 shrink-0 rounded-xl object-cover"
          onError={(event) => {
            event.currentTarget.src = FALLBACK_IMAGE;
          }}
        />
        <span className="min-w-0">
          <span className="block truncate text-fluid-sm font-bold text-slate-800 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-lime-300">
            {article.title}
          </span>
          <span className="mt-1 block text-fluid-2xs text-slate-400">
            {faDate(article.published_at)} · {article.reading_minutes.toLocaleString('fa-IR')} دقیقه مطالعه
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      to={articleHref(article)}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-900/10 dark:border-emerald-900 dark:bg-emerald-950',
        className,
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-emerald-50 dark:bg-emerald-900/40">
        <img
          src={article.cover_url || FALLBACK_IMAGE}
          alt={article.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          onError={(event) => {
            event.currentTarget.src = FALLBACK_IMAGE;
          }}
        />
        {article.kind === 'guide' && (
          <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-fluid-2xs font-bold text-white shadow">
            <Sprout size={12} />
            راهنمای کشت
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-fluid-sm font-extrabold leading-7 text-slate-800 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-lime-300">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="mt-2 line-clamp-3 text-fluid-xs leading-7 text-slate-500 dark:text-emerald-200">{article.excerpt}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-fluid-2xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} />
            {faDate(article.published_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 size={12} />
            {article.reading_minutes.toLocaleString('fa-IR')} دقیقه
          </span>
          {article.crop && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">{article.crop}</span>}
        </div>
      </div>
    </Link>
  );
}
