// frontend/src/pages/Legal.tsx
//
// One legal document, rendered the way it is stored.
//
// A single component answers the canonical `/legal/<slug>` address and the three
// older routes (`/privacy`, `/terms`, `/returns`) that are already printed on
// e-mails, in saved bookmarks and in the sitemap's history. The legacy addresses
// render the same text and declare the canonical one, so a promise never ends up
// with two competing versions in a search index.
//
// Two sources, one renderer: the wording that ships with the code, or the blocks
// an editor published in the admin panel. Both go through the same section
// renderer, which is the whole point — the sentence a buyer reads is the sentence
// the team wrote, not a second copy kept in the frontend that would quietly
// drift away from the one the checkout asked them to accept.

import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import {
  BadgeCheck,
  FileText,
  Gift,
  LifeBuoy,
  Link2,
  Printer,
  RotateCcw,
  Scale,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';

import ArticleBody from '../components/article/ArticleBody';
import { legalApi } from '../api/services';
import { copyText } from '../utils/copyText';
import { cn } from '../utils/cn';
import type { LegalDocument } from '../types';

/** The registry names an icon; the component is chosen here. */
const ICONS: Record<string, typeof FileText> = {
  FileText,
  ShieldCheck,
  RotateCcw,
  Truck,
  BadgeCheck,
  Store,
  Gift,
  Scale,
};

/** Routes that existed before the legal hub and keep working. */
export const LEGAL_LEGACY_ROUTES: Record<string, string> = {
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/returns': 'returns',
};

interface Part {
  id: string;
  title: string;
  body: string;
  kind: string;
}

/**
 * Sections and admin blocks as one list.
 *
 * A `bullets` block stores one item per line; feeding it to the article
 * renderer as `- ` lines means the admin's plain list and the code's markdown
 * come out looking identical.
 */
function readParts(doc: LegalDocument): Part[] {
  if (doc.blocks.length > 0) {
    return doc.blocks.map((block) => ({
      id: `part-${block.id}`,
      title: block.title,
      kind: block.type,
      body:
        block.type === 'bullets'
          ? block.text
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => `- ${line.replace(/^[•*-]\s*/, '')}`)
              .join('\n')
          : block.text,
    }));
  }
  return doc.sections.map((section, index) => ({
    id: `part-${index + 1}`,
    title: section.title,
    kind: 'text',
    body: section.body,
  }));
}

export default function Legal() {
  const { slug: routeSlug } = useParams<{ slug?: string }>();
  const location = useLocation();
  const slug = routeSlug || LEGAL_LEGACY_ROUTES[location.pathname] || '';

  const { data: document, isLoading, isError } = useQuery({
    queryKey: ['legal-document', slug],
    queryFn: async () => (await legalApi.document(slug)).data,
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });
  const { data: hub } = useQuery({
    queryKey: ['legal-index'],
    queryFn: async () => (await legalApi.index()).data,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (isError || !document) {
    return (
      <>
        <Helmet>
          <title>سند حقوقی پیدا نشد | گرین کود</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <div className="page-shell flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
          <h1 className="text-fluid-xl font-extrabold text-slate-800 dark:text-white">این سند در دسترس نیست</h1>
          <p className="mt-3 max-w-md text-fluid-sm leading-7 text-slate-500 dark:text-emerald-200">
            ممکن است جابه‌جا شده باشد. از فهرست اسناد حقوقی می‌توانید سند درست را پیدا کنید.
          </p>
          <Link to="/legal" className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-fluid-sm font-bold text-white">
            همه اسناد حقوقی
          </Link>
        </div>
      </>
    );
  }

  const Icon = ICONS[document.icon] ?? FileText;
  const parts = readParts(document);
  // The live values are printed above the text, not inside it: the wording of the
  // document is stable and auditable, while the window and the fee are settings.
  const policy = document.policy;
  const review = document.updated_at
    ? `آخرین بازبینی: ${new Date(document.updated_at).toLocaleDateString('fa-IR')}`
    : 'متن پایه‌ای که با این نسخه نرم‌افزار منتشر شده است.';

  return (
    <div className="page-shell py-8 md:py-12">
      <Helmet>
        <title>{document.title} | گرین کود</title>
        <meta name="description" content={document.summary} />
        <link rel="canonical" href={`${window.location.origin}/legal/${document.slug}`} />
      </Helmet>

      <nav aria-label="بازگشت" className="mb-5">
        <Link
          to="/legal"
          className="inline-flex min-h-11 items-center gap-1.5 text-fluid-xs font-bold text-slate-500 transition hover:text-emerald-700 dark:text-emerald-200 dark:hover:text-lime-300"
        >
          <LifeBuoy size={14} aria-hidden="true" />
          همه اسناد حقوقی
        </Link>
      </nav>

      <header className="max-w-3xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
          <Icon size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-fluid-2xl font-extrabold leading-tight text-slate-800 dark:text-white">
          {document.title}
        </h1>
        <p className="mt-3 text-fluid-sm leading-7 text-slate-500 dark:text-emerald-200">{document.summary}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-fluid-2xs text-slate-400 dark:text-emerald-300/80">
          <span>{review}</span>
          {hub?.version && (
            <span
              dir="ltr"
              className="rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-500 dark:bg-emerald-900/60 dark:text-emerald-100"
            >
              {hub.version}
            </span>
          )}
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-bold transition hover:bg-slate-100 dark:hover:bg-emerald-900/60"
            >
              <Printer size={13} aria-hidden="true" />
              چاپ
            </button>
            <button
              type="button"
              onClick={() => {
                void copyText(`${window.location.origin}/legal/${document.slug}`)
                  .then(() => toast.success('نشانی این سند کپی شد.'))
                  .catch(() => toast.error('کپی کردن انجام نشد.'));
              }}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-bold transition hover:bg-slate-100 dark:hover:bg-emerald-900/60"
            >
              <Link2 size={13} aria-hidden="true" />
              کپی نشانی
            </button>
          </span>
        </div>
      </header>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4 print:space-y-3">
          {policy && (
            <aside className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-fluid-2xs leading-7 dark:border-emerald-800 dark:bg-emerald-900/40">
              <h2 className="text-fluid-xs font-extrabold text-slate-800 dark:text-white">
                مقدار جاری این سیاست در سایت
              </h2>
              <ul className="mt-2 space-y-1 text-slate-600 dark:text-emerald-100">
                <li>
                  مهلت بازگشت کالا:{' '}
                  <strong className="text-emerald-700 dark:text-lime-300">
                    {policy.return_window_days
                      ? `${policy.return_window_days.toLocaleString('fa-IR')} روز پس از تحویل`
                      : 'به‌صورت عددی اعلام نشده است'}
                  </strong>
                </li>
                {policy.express_shipping?.enabled && (
                  <li>
                    تحویل فوری:{' '}
                    <strong className="text-emerald-700 dark:text-lime-300">
                      فعال{policy.express_shipping.fee ? ` · ${policy.express_shipping.fee.toLocaleString('fa-IR')} تومان هزینه اضافی` : ''}
                    </strong>
                  </li>
                )}
                {policy.return_conditions && <li className="whitespace-pre-line">{policy.return_conditions}</li>}
              </ul>
              <p className="mt-2 text-slate-400">
                این مقدار را تیم سایت در پنل مدیریت تنظیم می‌کند؛ متن این سند به همان مقدار ارجاع می‌دهد و
                رقم تازه‌ای نمی‌سازد.
              </p>
            </aside>
          )}

          {parts.map((part) => (
            <section
              key={part.id}
              id={part.id}
              className="scroll-mt-24 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-6"
            >
              {part.title && (
                <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">{part.title}</h2>
              )}
              <div className="mt-2">
                <ArticleBody body={part.body} />
              </div>
            </section>
          ))}

          <aside className="rounded-3xl bg-emerald-50 p-5 dark:bg-emerald-900/30 print:hidden">
            <p className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">
              همین متن، همان چیزی است که می‌پذیرید
            </p>
            <p className="mt-2 text-fluid-xs leading-7 text-slate-600 dark:text-emerald-100">
              شماره نسخه بالا کنار هر سفارش ثبت می‌شود؛ اگر روزی لازم شد، روشن است که خریدار در روز خرید کدام متن را
              پذیرفته بود — نه متن امروز.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/support"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-fluid-xs font-bold text-white transition hover:bg-emerald-700"
              >
                <LifeBuoy size={14} aria-hidden="true" />
                ثبت شکایت یا درخواست
              </Link>
              <Link
                to="/messages?channel=support"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 text-fluid-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900 dark:text-lime-300"
              >
                گفتگو با میز پشتیبانی
              </Link>
            </div>
          </aside>
        </div>

        <div className="space-y-4 print:hidden lg:sticky lg:top-24 lg:h-fit">
          {parts.length > 2 && (
            <nav aria-label="فهرست این سند" className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-emerald-900 dark:bg-emerald-950">
              <p className="text-fluid-xs font-extrabold text-slate-800 dark:text-white">فهرست این سند</p>
              <ul className="mt-2 space-y-1">
                {parts
                  .filter((part) => part.title)
                  .map((part) => (
                    <li key={part.id}>
                      <a
                        href={`#${part.id}`}
                        className="block rounded-lg px-2 py-1.5 text-fluid-2xs font-bold leading-6 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
                      >
                        {part.title}
                      </a>
                    </li>
                  ))}
              </ul>
            </nav>
          )}

          {hub && (
            <nav aria-label="اسناد حقوقی" className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-900/40">
              <p className="text-fluid-xs font-extrabold text-slate-800 dark:text-white">بقیه اسناد</p>
              <div className="mt-2 space-y-3">
                {hub.groups.map((group) => (
                  <div key={group.id}>
                    <p className="text-fluid-2xs font-bold text-slate-400 dark:text-emerald-300/80">{group.label}</p>
                    <div className="mt-1 flex flex-col">
                      {group.items.map((item) => (
                        <Link
                          key={item.slug}
                          to={item.url}
                          aria-current={item.slug === document.slug ? 'page' : undefined}
                          className={cn(
                            'min-h-9 rounded-lg px-2 py-1.5 text-fluid-2xs font-bold transition',
                            item.slug === document.slug
                              ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-800 dark:text-lime-200'
                              : 'text-emerald-700 hover:bg-white dark:text-lime-300 dark:hover:bg-emerald-800/60',
                          )}
                        >
                          {item.short_title}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Link
                to="/legal"
                className="mt-3 block text-fluid-2xs font-extrabold text-slate-500 underline-offset-4 hover:underline dark:text-emerald-200"
              >
                فهرست کامل و توضیح هر سند
              </Link>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
