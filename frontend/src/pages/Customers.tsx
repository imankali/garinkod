// frontend/src/pages/Customers.tsx
//
// «تجربه خرید مشتریان» — buyers' own words, not a wall of invented praise.
//
// Every card here is a review that exists in the database. The server decides
// which ones and says how: an editor's picks (`curated`), otherwise the reviews of
// paid orders (`verified`), otherwise the best-rated ones (`open`). The page prints
// that mode as a caption, because a testimonial section that quietly cherry-picks
// the flattering ones is the kind of thing a farmer learns not to trust.
//
// There is no "۹۸٪ رضایت" counter: the site does not survey every buyer, so the
// only honest number would be the count of reviews, and that is what is shown.

import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, MessageSquareQuote, Quote, ThumbsUp } from 'lucide-react';

import { testimonialsApi } from '../api/services';
import { StarRow } from '../components/StarRating';
import { cn } from '../utils/cn';

const MODE_NOTE: Record<'curated' | 'verified' | 'open', { label: string; hint: string }> = {
  curated: {
    label: 'منتخب تیم گرین کود',
    hint: 'این دیدگاه‌ها را تیم سایت از میان بازخوردهای منتشرشده انتخاب کرده است.',
  },
  verified: {
    label: 'دیدگاه خریداران با پرداخت تأییدشده',
    hint: 'هنوز دیدگاهی دستی انتخاب نشده؛ فهرست بر اساس رأی مفید بودنِ خریداران مرتب شده است.',
  },
  open: {
    label: 'بازخوردهای امتیازدار',
    hint: 'نه انتخاب دستی و نه خرید تأییدشده؛ هر چه تا امروز ثبت شده و امتیاز گرفته است.',
  },
};

export default function Customers() {
  const { data, isLoading } = useQuery({
    queryKey: ['buyer-experiences'],
    queryFn: async () => (await testimonialsApi.list()).data,
    staleTime: 5 * 60 * 1000,
  });

  const items = data?.items ?? [];
  const note = MODE_NOTE[data?.mode ?? 'open'] ?? MODE_NOTE.open;

  return (
    <>
      <Helmet>
        <title>تجربه خرید مشتریان | گرین کود</title>
        <meta
          name="description"
          content="بازخوردهای واقعی خریداران نهاده‌های کشاورزی درباره کیفیت، بسته‌بندی و نتیجه در مزرعه."
        />
        <link rel="canonical" href="/customers" />
      </Helmet>

      <main className="mx-auto max-w-6xl px-[var(--page-gutter)] py-8 md:py-12">
        <header className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-7 dark:border-emerald-900 dark:bg-emerald-950">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-fluid-2xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-lime-300">
            <MessageSquareQuote size={13} aria-hidden="true" />
            {note.label}
          </p>
          <h1 className="mt-3 text-2xl font-extrabold leading-10 text-slate-800 md:text-3xl dark:text-white">
            تجربه خرید مشتریان
          </h1>
          <p className="mt-2 max-w-2xl text-fluid-sm leading-8 text-slate-600 dark:text-emerald-100">
            هر کارت یک دیدگاه است که زیر همان کالا منتشر شده؛ تصویر، امتیاز و لینک کالا به همان
            صفحه می‌رود. {note.hint}
          </p>
          {data && (
            <p className="mt-3 text-fluid-2xs font-bold text-slate-400">
              مجموع دیدگاه‌های امتیازدار منتشرشده:{' '}
              <span className="text-emerald-700 dark:text-lime-300">{data.total.toLocaleString('fa-IR')}</span>
            </p>
          )}
        </header>

        {isLoading && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-44 animate-pulse rounded-3xl bg-slate-100 dark:bg-emerald-950" />
            ))}
          </div>
        )}

        {!isLoading && !items.length && (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-fluid-sm leading-8 text-slate-500 dark:border-emerald-800 dark:text-emerald-200">
            هنوز دیدگاه امتیازداری منتشر نشده است. پس از آنکه نخستین خریداران تجربه‌شان را بنویسند،
            همین صفحه پر می‌شود — چیزی که اینجا نمی‌خوانید ساخته نشده است.
          </p>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex flex-col rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"
            >
              <Quote size={20} aria-hidden="true" className="text-emerald-200 dark:text-emerald-800" />
              <p className="mt-2 flex-1 whitespace-pre-line text-fluid-sm leading-8 text-slate-700 dark:text-emerald-50">
                {item.body}
              </p>

              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={`تصویر فرستاده خریدار برای ${item.product.title}`}
                  className="mt-3 h-40 w-full rounded-2xl object-cover"
                  loading="lazy"
                />
              )}

              <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-emerald-900">
                <div className="min-w-0">
                  <p className="truncate text-fluid-sm font-extrabold text-slate-800 dark:text-white">{item.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-fluid-2xs text-slate-400">
                    <Link to={item.product.url} className="font-bold text-emerald-700 hover:underline dark:text-lime-300">
                      {item.product.title}
                    </Link>
                    {item.verified_purchase && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-lime-300">
                        <BadgeCheck size={12} aria-hidden="true" /> خرید تأییدشده
                      </span>
                    )}
                    <time dateTime={item.created}>{new Date(item.created).toLocaleDateString('fa-IR')}</time>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {item.rating ? <StarRow value={item.rating} size={13} /> : null}
                  {!!item.helpful_count && (
                    <span className={cn('inline-flex items-center gap-1 text-fluid-2xs font-bold text-slate-500 dark:text-emerald-200')}>
                      <ThumbsUp size={12} aria-hidden="true" />
                      {item.helpful_count.toLocaleString('fa-IR')}
                    </span>
                  )}
                </div>
              </footer>
            </article>
          ))}
        </div>

        <p className="mt-8 text-fluid-2xs leading-7 text-slate-400">
          دیدگاه‌ها پیش از نمایش بررسی می‌شوند و هیچ تخفیف یا پاداشی بابت امتیاز بالا داده نمی‌شود. برای
          نوشتن تجربه خود، به صفحه کالایی که خریده‌اید بروید.
        </p>
      </main>
    </>
  );
}
