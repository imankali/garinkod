// frontend/src/pages/Faq.tsx
//
// The questions the support desk answers over and over, on the page instead of in
// the chat.
//
// The content is not written here: it is a published `SitePage` (slug `faq`) whose
// blocks are of the «faq» type — question and answer as one row. That is what lets
// the team add this week's question without a deploy, and it is also why the page
// degrades to the desk rather than showing stale prose: if no such page is
// published, there is nothing to claim.
//
// The same rows are emitted as FAQPage structured data, so the answers a crawler
// reads are the answers a person reads.

import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, LifeBuoy, Scale } from 'lucide-react';

import { sitePagesApi } from '../api/services';
import { LEGAL_CORE_LINKS } from '../config/legal';
import type { SitePageBlock } from '../types';

const FAQ_SLUG = 'faq';

function faqGroups(blocks: SitePageBlock[]) {
  return blocks
    .filter((block) => block.block_type === 'faq' && (block.rows?.length ?? 0) > 0)
    .map((block) => ({
      id: block.id,
      title: block.title || 'پرسش‌های متداول',
      // A row is [question, answer]; a cell count other than two is the admin
      // typing a stray pipe, so the row is skipped rather than half-rendered.
      pairs: (block.rows ?? [])
        .map((row) => ({ question: (row[0] ?? '').trim(), answer: row.slice(1).join(' | ').trim() }))
        .filter((pair) => pair.question && pair.answer),
    }))
    .filter((group) => group.pairs.length > 0);
}

export default function Faq() {
  const { data, isLoading } = useQuery({
    queryKey: ['faq-page'],
    queryFn: async () => (await sitePagesApi.getBySlug(FAQ_SLUG)).data,
    retry: false,
  });

  const groups = data ? faqGroups(data.blocks ?? []) : [];
  const flat = groups.flatMap((group) => group.pairs);

  return (
    <>
      <Helmet>
        <title>{data?.seo_title || 'سؤالات متداول | گرین کود'}</title>
        <meta name="description" content={data?.seo_description || 'پاسخ کوتاه به پرسش‌های رایج خرید نهاده‌های کشاورزی'} />
        <link rel="canonical" href="/faq" />
        {flat.length > 0 && (
          <script type="application/ld+json">
            {JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: flat.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: { '@type': 'Answer', text: item.answer },
              })),
            })}
          </script>
        )}
      </Helmet>

      <main className="mx-auto max-w-4xl px-[var(--page-gutter)] py-8 md:py-12">
        <header>
          <p className="text-fluid-2xs font-bold text-emerald-700 dark:text-lime-300">{data?.badge || 'راهنما'}</p>
          <h1 className="mt-1.5 text-2xl font-extrabold leading-10 text-slate-800 md:text-3xl dark:text-white">
            {data?.title || 'سؤالات متداول'}
          </h1>
          {data?.hero_text && (
            <p className="mt-3 whitespace-pre-line text-fluid-sm leading-8 text-slate-600 dark:text-emerald-100">
              {data.hero_text}
            </p>
          )}
        </header>

        {isLoading && <div className="mt-8 h-64 animate-pulse rounded-3xl bg-slate-100 dark:bg-emerald-950" />}

        {!isLoading && groups.length === 0 && (
          <p className="mt-8 rounded-2xl border border-dashed border-slate-200 p-6 text-fluid-sm leading-8 text-slate-500 dark:border-emerald-800 dark:text-emerald-200">
            فهرست پرسش و پاسخ هنوز در پنل مدیریت تنظیم نشده است. پرسش خود را همین حالا از میز پشتیبانی
            بپرسید؛ پاسخ‌های پرتکرار به همین صفحه اضافه می‌شوند.
          </p>
        )}

        {groups.map((group) => (
          <section key={group.id} className="mt-8" aria-labelledby={`faq-${group.id}`}>
            <h2 id={`faq-${group.id}`} className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">
              {group.title}
            </h2>
            <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white dark:divide-emerald-900 dark:border-emerald-900 dark:bg-emerald-950">
              {group.pairs.map((pair) => (
                <details key={pair.question} className="group/pair">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-fluid-sm font-extrabold text-slate-800 transition-colors hover:bg-emerald-50/60 dark:text-white dark:hover:bg-emerald-900/40">
                    <span>{pair.question}</span>
                    <ChevronDown
                      size={17}
                      aria-hidden="true"
                      className="shrink-0 text-emerald-600 transition-transform duration-200 group-open/pair:rotate-180 dark:text-lime-300"
                    />
                  </summary>
                  <p className="whitespace-pre-line px-4 pb-4 text-fluid-sm leading-8 text-slate-600 dark:text-emerald-100">
                    {pair.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <section className="mt-10 grid gap-3 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5 sm:grid-cols-2 dark:border-emerald-900 dark:bg-emerald-950/60">
          <Link
            to="/support"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-fluid-sm font-bold text-white transition-colors hover:bg-emerald-700"
          >
            <LifeBuoy size={17} aria-hidden="true" />
            پاسخ‌تان اینجا نبود؟ در میز پشتیبانی بپرسید
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-fluid-2xs font-bold text-slate-500 dark:text-emerald-200">
            <Scale size={14} aria-hidden="true" />
            متن دقیق‌تر تعهدات در اسناد سایت:
            {LEGAL_CORE_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="text-emerald-700 hover:underline dark:text-lime-300">
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
