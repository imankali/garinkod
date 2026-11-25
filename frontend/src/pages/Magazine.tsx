// frontend/src/pages/Magazine.tsx

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { BookOpen } from 'lucide-react';

import { articlesApi } from '../api/services';
import PageHead from '../components/shop/PageHead';
import { Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

/**
 * The magazine index.
 *
 * One column of rows, not a magazine-style mosaic: article titles are long in
 * Persian, and a three-column tile grid clips every one of them to a headline
 * fragment. The first item is allowed to be larger because it is the newest
 * piece of expertise, not because a layout needs a hero.
 */
export default function Magazine() {
  const { data, isLoading } = useQuery({
    queryKey: ['articles'],
    queryFn: async () => (await articlesApi.getAll({ limit: 24 })).data,
    staleTime: 10 * 60 * 1000,
  });

  // `/articles/crops/` lists the crops that already have a guide, with counts.
  // It had no caller, so the magazine had no way to answer «راهنمای گندم دارید؟»
  // other than scrolling the whole list.
  const crops = useQuery({
    queryKey: ['article-crops'],
    queryFn: async () => (await articlesApi.getCrops()).data,
    staleTime: 30 * 60 * 1000,
  });

  const posts = data ?? [];
  const [lead, ...rest] = posts;

  return (
    <div className="shell flex flex-col gap-5 py-8">
      <PageHead
        title="مجلهٔ کشاورزی"
        lead="راهنمای فصل کشت، مدیریت آفات و انتخاب نهاده — نوشتهٔ کارشناسان گرین‌کود، برای مزرعهٔ واقعی."
      />

      {(crops.data ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-ink-mute dark:text-white/40">محصول:</span>
          {(crops.data ?? []).map((row) => (
            <span
              key={row.crop}
              className="inline-flex min-h-7 items-center gap-1 rounded-sm border border-line px-2 text-[11px] font-bold text-ink-soft dark:border-night-line dark:text-white/60"
            >
              {row.crop}
              <span className="dateline text-ink-mute dark:text-white/35">
                {row.article_count.toLocaleString('fa-IR')}
              </span>
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="هنوز مقاله‌ای منتشر نشده"
          description="مجله به‌زودی با راهنمای فصل کشت پر می‌شود. تا آن موقع، کاتالوگ و خدمات در دسترس‌اند."
        />
      ) : (
        <>
          {lead && (
            <Link
              to={`/magazine/${lead.slug}`}
              className="group grid gap-4 overflow-hidden rounded-lg border border-line bg-paper transition-[border-color,box-shadow] duration-[var(--dur-state)] hover:border-brand-300 hover:shadow-[var(--shadow-card)] sm:grid-cols-[1.1fr_1fr] dark:border-night-line dark:bg-night-soft dark:hover:border-brand-700"
            >
              {lead.cover_url && (
                <img
                  src={lead.cover_url}
                  alt=""
                  width={640}
                  height={360}
                  className="h-44 w-full object-cover sm:h-full"
                />
              )}
              <div className="flex flex-col justify-center gap-2 p-4 sm:py-6 sm:pe-6">
                <p className="text-2xs font-bold text-brand-700 dark:text-brand-300">
                  {lead.kind_label}
                  {lead.crop ? ` · ${lead.crop}` : ''}
                </p>
                <h2 className="text-base font-extrabold leading-7 text-ink dark:text-white">{lead.title}</h2>
                <p className="line-clamp-3 text-xs leading-6 text-ink-soft dark:text-white/60">{lead.excerpt}</p>
                <p className="dateline mt-1 text-2xs text-ink-mute dark:text-white/45">
                  {lead.author_name} · {lead.reading_minutes.toLocaleString('fa-IR')} دقیقه مطالعه
                </p>
              </div>
            </Link>
          )}

          <ul className="divide-y divide-line border-y border-line dark:divide-night-line dark:border-night-line">
            {rest.map((post) => (
              <li key={post.id}>
                <Link to={`/magazine/${post.slug}`} className="group flex flex-wrap items-center gap-x-6 gap-y-1 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs font-bold text-ink-mute dark:text-white/45">
                      {post.kind_label}
                      {post.crop ? ` · ${post.crop}` : ''}
                    </p>
                    <h2 className="mt-0.5 text-xs font-extrabold text-ink transition-colors duration-150 group-hover:text-brand-800 dark:text-white dark:group-hover:text-brand-300">
                      {post.title}
                    </h2>
                  </div>
                  <p className="dateline shrink-0 text-2xs text-ink-mute dark:text-white/40">
                    {post.reading_minutes.toLocaleString('fa-IR')} دقیقه
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
