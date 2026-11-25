// frontend/src/pages/Guides.tsx
//
// «راهنمای کشت» — the growing guides on their own page.
//
// `/articles/guides/` and `/guides/index/` both had no caller. Neither is a
// duplicate of the magazine: `getAll` mixes news with guides, and
// `related_articles` only reaches the neighbours of whatever you are already
// reading — so a buyer who wants «راهنمای گندم» had to arrive from an article
// about wheat.
//
// `/guides/index/` is the honest part. It reports, per crop, how many guides
// exist, and per catalogue department, how many products *and* how many guides
// exist. The seeded numbers are 6 departments with guides: 0, and 3 crops with
// one guide each — so the page can say exactly which departments have nothing
// yet instead of implying full coverage. That is the whole point of reading it:
// a department with `guide_count: 0` gets no link.

import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { BookOpen, Sprout } from 'lucide-react';

import { articlesApi, siteInfoApi } from '../api/services';
import PageHead from '../components/shop/PageHead';
import { Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { nums } from '../lib/price';
import { useTitle } from '../lib/useTitle';

export default function Guides() {
  useTitle('راهنمای کشت');
  const [params, setParams] = useSearchParams();
  const crop = params.get('crop') ?? '';

  const guides = useQuery({
    queryKey: ['guides'],
    queryFn: async () => (await articlesApi.getGuides()).data,
    staleTime: 10 * 60 * 1000,
  });

  // Per-crop and per-department coverage, counted server-side.
  const index = useQuery({
    queryKey: ['growing-index'],
    queryFn: async () => (await siteInfoApi.getGrowingIndex()).data,
    staleTime: 30 * 60 * 1000,
  });

  // The guide rows already carry `crop`, so filtering is a local pass over the
  // list the server sent — no second request, and no invented crop vocabulary.
  const all = guides.data ?? [];
  const rows = crop ? all.filter((guide) => guide.crop === crop) : all;
  const covered = (index.data?.categories ?? []).filter((row) => row.guide_count > 0);
  const uncovered = (index.data?.categories ?? []).filter((row) => row.guide_count === 0);

  return (
    <div className="shell flex flex-col gap-5 py-8">
      <PageHead
        title="راهنمای کشت"
        lead="راهنمای گام‌به‌گام کشت و داشت، نوشتهٔ کارشناسان گرین‌کود — جدا از خبرهای مجله، تا اینکه چه چیزی را می‌شود کشت، یک‌جا پیدا شود."
        actions={
          <Button to="/magazine" variant="secondary" size="sm">
            مجله
          </Button>
        }
      />

      {crop && (
        <p className="flex flex-wrap items-center gap-2 text-2xs text-ink-soft dark:text-white/60">
          <span>
            راهنماهای <strong className="font-extrabold text-ink dark:text-white">{crop}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete('crop');
              setParams(next, { replace: true });
            }}
            className="font-bold text-brand-700 hover:underline dark:text-brand-300"
          >
            همهٔ راهنماها
          </button>
        </p>
      )}

      {guides.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={crop ? `برای ${crop} راهنمایی نیست` : 'هنوز راهنمایی منتشر نشده'}
          description={
            crop
              ? 'این محصول راهنمای کشت ندارد؛ می‌توانید بقیهٔ راهنماها را ببینید.'
              : 'به‌زودی برای محصولات فصل، راهنمای کشت اضافه می‌شود.'
          }
          action={
            <Button to={crop ? '/guides' : '/magazine'} variant="secondary" size="sm">
              {crop ? 'همهٔ راهنماها' : 'مجله'}
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-line dark:divide-night-line">
          {rows.map((guide) => (
            <li key={guide.id}>
              <Link
                to={`/magazine/${guide.slug}`}
                className="group flex flex-wrap items-start justify-between gap-x-6 gap-y-1 py-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-ink-mute dark:text-white/40">
                    {guide.kind_label}
                    {guide.crop && (
                      <Link
                        to={`/guides?crop=${encodeURIComponent(guide.crop)}`}
                        className="rounded-sm bg-brand-50 px-1.5 py-0.5 text-brand-800 hover:underline dark:bg-night dark:text-brand-300"
                      >
                        {guide.crop}
                      </Link>
                    )}
                  </span>
                  <span className="mt-1 block text-sm font-extrabold text-ink transition-colors duration-150 group-hover:text-brand-800 dark:text-white dark:group-hover:text-brand-300">
                    {guide.title}
                  </span>
                  {guide.excerpt && (
                    <span className="mt-1 line-clamp-2 block text-2xs leading-6 text-ink-soft dark:text-white/60">
                      {guide.excerpt}
                    </span>
                  )}
                </span>
                <span className="dateline shrink-0 text-2xs text-ink-mute dark:text-white/40">
                  {nums(guide.reading_minutes)} دقیقه
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(index.data?.crops ?? []).length > 0 && (
        <section aria-labelledby="coverage-title" className="border-t border-line pt-5 dark:border-night-line">
          <h2 id="coverage-title" className="text-sm font-extrabold text-ink dark:text-white">
            چه محصولی راهنما دارد
          </h2>
          <p className="mt-1 text-2xs leading-6 text-ink-soft dark:text-white/55">
            شمار راهنماها از خود سرور می‌آید؛ محصولی که راهنما ندارد اینجا هم نیامده است.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(index.data?.crops ?? []).map((row) => (
              <button
                key={row.crop}
                type="button"
                aria-pressed={crop === row.crop}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  if (crop === row.crop) next.delete('crop');
                  else next.set('crop', row.crop);
                  setParams(next, { replace: true });
                }}
                className={
                  crop === row.crop
                    ? 'inline-flex min-h-7 items-center gap-1 rounded-sm border border-brand-600 bg-brand-700 px-2 text-[11px] font-bold text-white'
                    : 'inline-flex min-h-7 items-center gap-1 rounded-sm border border-line px-2 text-[11px] font-bold text-ink-soft hover:border-brand-400 dark:border-night-line dark:text-white/60'
                }
              >
                <Sprout size={11} aria-hidden="true" />
                {row.crop}
                <span className="dateline opacity-70">{nums(row.guide_count)}</span>
              </button>
            ))}
          </div>

          {covered.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5">
              {covered.map((row) => (
                <li key={row.slug} className="flex items-center justify-between gap-3 text-2xs">
                  <Link
                    to={`/catalog/category/${row.slug}`}
                    className="font-bold text-ink hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
                  >
                    {row.name}
                  </Link>
                  <span className="dateline text-ink-mute dark:text-white/45">
                    {nums(row.guide_count)} راهنما · {nums(row.product_count)} کالا
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* A department with zero guides is stated, not hidden: the seller
              side needs to know which shelf has no advice behind it yet. */}
          {uncovered.length > 0 && (
            <p className="mt-4 rounded-md border border-line p-3 text-2xs leading-6 text-ink-mute dark:border-night-line dark:text-white/45">
              هنوز برای {uncovered.map((row) => row.name).join('، ')} راهنمایی نوشته نشده است — کالاها
              هستند، متن آموزشی نه.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
