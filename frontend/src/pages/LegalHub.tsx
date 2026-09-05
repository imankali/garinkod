// frontend/src/pages/LegalHub.tsx
//
// The index of everything the platform promises in writing.
//
// A legal section is usually a list of links nobody reads until they need it, so
// the page leads with the four questions that actually arrive — when it ships,
// whether it can come back, who stands behind it, what happens to my data — and
// puts each one next to its document. The version line is shown on purpose: it
// is the number written on every order, and seeing it here is what makes that
// record mean something to the buyer as well as to us.

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import {
  ArrowLeft,
  BadgeCheck,
  FileText,
  Gift,
  LifeBuoy,
  RotateCcw,
  Scale,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react';

import { legalApi } from '../api/services';
import { useSiteContact } from '../hooks/useSiteContact';
import type { LegalDocumentSummary } from '../types';

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

/** The questions people arrive with, answered by the document that covers them. */
const QUICK_ROWS: Array<{ question: string; slug: string; label: string }> = [
  { question: 'کالا چند روز دیگر به دستم می‌رسد؟', slug: 'shipping', label: 'شرایط ارسال و تحویل' },
  { question: 'اگر کالا مغایر یا آسیب‌دیده بود؟', slug: 'returns', label: 'خرید، لغو و بازگشت کالا' },
  { question: 'چه کسی ضمانت اصالت را می‌دهد؟', slug: 'warranty', label: 'ضمانت اصالت کالا' },
  { question: 'داده‌هایم کجا می‌نشیند و تا کِی؟', slug: 'privacy', label: 'حریم خصوصی' },
  { question: 'چطور از غرفه‌دار شکایت کنم؟', slug: 'complaints', label: 'شکایات و حل اختلاف' },
];

export default function LegalHub() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['legal-index'],
    queryFn: async () => (await legalApi.index()).data,
    staleTime: 5 * 60 * 1000,
  });
  const contact = useSiteContact();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page-shell flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
        <h1 className="text-fluid-xl font-extrabold text-slate-800 dark:text-white">فهرست اسناد باز نشد</h1>
        <p className="mt-3 max-w-md text-fluid-sm leading-7 text-slate-500 dark:text-emerald-200">
          یک بار دیگر تلاش کنید؛ اگر ادامه داشت، از صفحه پشتیبانی به ما خبر دهید.
        </p>
        <Link to="/support" className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-fluid-sm font-bold text-white">
          پشتیبانی
        </Link>
      </div>
    );
  }

  const bySlug = new Map<string, LegalDocumentSummary>(data.documents.map((row) => [row.slug, row]));

  return (
    <div className="page-shell py-8 md:py-12">
      <Helmet>
        <title>اسناد حقوقی گرین کود | قوانین، حریم خصوصی و بازگشت کالا</title>
        <meta
          name="description"
          content="قوانین و مقررات، حریم خصوصی، شرایط خرید و بازگشت کالا، ارسال، ضمانت اصالت، قوانین غرفه‌داری، امتیاز و پاداش، و رسیدگی به شکایات."
        />
        <link rel="canonical" href={`${window.location.origin}/legal`} />
      </Helmet>

      <header className="max-w-3xl">
        <h1 className="text-fluid-2xl font-extrabold leading-tight text-slate-800 dark:text-white">
          اسناد حقوقی گرین کود
        </h1>
        <p className="mt-3 text-fluid-sm leading-7 text-slate-500 dark:text-emerald-200">
          هر آنچه پیش از خرید باید بدانید، یک‌جا و بدون واژه‌های مبهم. هر سند جداگانه هم نشانی دارد و هم در پاورقی
          سایت لینک شده است؛ اگر بندی را پیدا نکردید، از میز پشتیبانی بپرسید.
        </p>
        <p className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-fluid-2xs font-bold text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-100">
          نسخه متن در جریان:
          <span dir="ltr" className="rounded-lg bg-white px-2 py-0.5 text-slate-700 dark:bg-emerald-800 dark:text-lime-200">
            {data.version}
          </span>
          <span className="font-normal text-slate-400 dark:text-emerald-200/80">
            همین شماره روی هر سفارش ثبت می‌شود.
          </span>
        </p>
      </header>

      {/* The four questions that bring people here, before the formal list. */}
      <section aria-label="پاسخ‌های سریع" className="mt-7 grid gap-2 sm:grid-cols-2">
        {QUICK_ROWS.map((row) => {
          const doc = bySlug.get(row.slug);
          if (!doc) return null;
          return (
            <Link
              key={row.slug}
              to={doc.url}
              className="group flex min-h-16 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-emerald-200 hover:shadow dark:border-emerald-900 dark:bg-emerald-950 dark:hover:border-emerald-700"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-fluid-xs font-extrabold text-slate-800 dark:text-white">
                  {row.question}
                </span>
                <span className="mt-0.5 block truncate text-fluid-2xs text-slate-400 dark:text-emerald-300/80">
                  {row.label}
                </span>
              </span>
              <ArrowLeft
                size={16}
                className="shrink-0 text-slate-300 transition group-hover:text-emerald-600 dark:text-emerald-700"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </section>

      {data.groups.map((group) => (
        <section key={group.id} aria-label={group.label} className="mt-9">
          <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">{group.label}</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {group.items.map((doc) => {
              const Icon = ICONS[doc.icon] ?? FileText;
              return (
                <li key={doc.slug}>
                  <Link
                    to={doc.url}
                    className="flex h-full flex-col rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950 dark:hover:border-emerald-700"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <span className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                        {doc.title}
                      </span>
                    </span>
                    <span className="mt-2.5 text-fluid-xs leading-7 text-slate-500 dark:text-emerald-200">
                      {doc.summary}
                    </span>
                    <span className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-slate-100 pt-2.5 text-fluid-2xs text-slate-400 dark:border-emerald-900 dark:text-emerald-300/80">
                      <span>
                        {doc.updated_at
                          ? `آخرین بازبینی ${new Date(doc.updated_at).toLocaleDateString('fa-IR')}`
                          : 'منتشرشده با این نسخه سایت'}
                      </span>
                      <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-lime-300">
                        خواندن سند
                        <ArrowLeft size={12} aria-hidden="true" />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="mt-10 rounded-3xl bg-emerald-50 p-5 dark:bg-emerald-900/30">
        <h2 className="flex items-center gap-2 text-fluid-sm font-extrabold text-slate-800 dark:text-white">
          <LifeBuoy size={16} className="text-emerald-600 dark:text-lime-300" aria-hidden="true" />
          پرسش حقوقی‌تان این‌جا جواب ندارد؟
        </h2>
        <p className="mt-2 text-fluid-xs leading-7 text-slate-600 dark:text-emerald-100">
          متن‌های این صفحه قواعد کلی‌اند و جای بررسی مورد شما را نمی‌گیرند. کد سفارش و شرح مشکل را برای میز
          پشتیبانی بفرستید؛ پاسخ در ساعت کاری همان روز داده می‌شود.
          {contact.primaryPhone && (
            <>
              {' '}
              شماره تماس: <strong dir="ltr">{contact.primaryPhone}</strong>
            </>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/messages?channel=support"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-fluid-xs font-bold text-white transition hover:bg-emerald-700"
          >
            گفتگو با پشتیبانی
          </Link>
          <Link
            to="/support"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 text-fluid-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900 dark:text-lime-300"
          >
            فرم شکایت و بازخورد
          </Link>
          <Link
            to="/contact"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 text-fluid-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900 dark:text-lime-300"
          >
            شماره‌ها و نشانی
          </Link>
        </div>
      </section>
    </div>
  );
}
