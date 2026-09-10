// frontend/src/pages/ExportDashboard.tsx
// The buyer's export desk: every trade file of the signed-in account, with
// its market, money and - once a specialist has verified them - the customs
// papers ready to download.
//
// State machine mirrors OrderTrackingPage: skeleton while loading, a parsed
// error card with retry on transport/server failure, and a calm empty state
// because most buyers will never have an export file.

import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import {
  AlertTriangle,
  ClipboardList,
  Download,
  FileText,
  RefreshCw,
  Ship,
} from 'lucide-react';

import { getMyExportOrders } from '../services/export';
import type { ExportOrder, ExportOrderStatus } from '../types/export';
import { parseApiError } from '../api/errors';
import Button from '../components/ui/Button';

/** Status pill tones, page-local like Orders.tsx keeps its own. */
const STATUS_BADGE: Record<ExportOrderStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  pending_docs: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  customs_clearance: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  shipped: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
};

function formatForeignAmount(value: string): string {
  const amount = Number(value);
  return Number.isNaN(amount)
    ? value
    : amount.toLocaleString('fa-IR', { maximumFractionDigits: 2 });
}

function formatIssueDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('fa-IR', { dateStyle: 'medium' });
}

/** Two-card shimmer matching the shipped list geometry, so content never jumps. */
function ExportSkeleton() {
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری پرونده‌های صادراتی" className="space-y-4" role="status">
      {[0, 1].map((card) => (
        <div
          key={card}
          className="animate-pulse rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-800 dark:bg-emerald-950"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-slate-200 dark:bg-emerald-900" />
              <div className="h-5 w-36 rounded bg-slate-200 dark:bg-emerald-900" />
            </div>
            <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-emerald-900" />
          </div>
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 dark:border-emerald-800">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <div className="h-3 w-24 rounded bg-slate-100 dark:bg-emerald-900/70" />
                <div className="h-3 w-32 rounded bg-slate-200 dark:bg-emerald-900" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One trade file: header facts plus its papers. */
function ExportOrderCard({ exportOrder }: { exportOrder: ExportOrder }) {
  return (
    <article className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200">
            <Ship size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-fluid-2xs text-slate-400 dark:text-emerald-200/70">پرونده سفارش</p>
            <h2 className="mt-0.5 text-fluid-base font-extrabold text-sky-800 dark:text-sky-100" dir="ltr">
              {exportOrder.order_code}
            </h2>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-fluid-2xs font-bold ${STATUS_BADGE[exportOrder.status]}`}
        >
          {exportOrder.status_label}
        </span>
      </div>

      <dl className="mt-4 grid gap-2.5 border-t border-slate-100 pt-4 dark:border-emerald-800 sm:grid-cols-2">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-fluid-xs text-slate-500 dark:text-emerald-200">کشور مقصد</dt>
          <dd className="text-fluid-xs font-bold text-slate-700 dark:text-emerald-100">
            {exportOrder.destination_country_label}{' '}
            <span className="text-slate-400" dir="ltr">
              ({exportOrder.destination_country})
            </span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-fluid-xs text-slate-500 dark:text-emerald-200">ارزش قرارداد</dt>
          <dd className="text-fluid-xs font-bold text-emerald-700 dark:text-lime-300">
            {formatForeignAmount(exportOrder.total_value_foreign)} {exportOrder.currency_label}
          </dd>
        </div>
      </dl>

      <section className="mt-4 border-t border-slate-100 pt-4 dark:border-emerald-800">
        <h3 className="mb-2 text-fluid-xs font-extrabold text-slate-600 dark:text-emerald-100">
          اسناد گمرکی
        </h3>
        {exportOrder.documents.length ? (
          <ul className="space-y-2">
            {exportOrder.documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 px-3 py-2.5 dark:border-emerald-800"
              >
                <span className="flex min-w-0 items-center gap-2 text-fluid-sm text-slate-700 dark:text-emerald-100">
                  <FileText size={15} aria-hidden="true" className="shrink-0 text-slate-400" />
                  <span className="font-bold">{document.document_type_label}</span>
                  <span className="text-fluid-2xs text-slate-400">
                    صدور: {formatIssueDate(document.issue_date)}
                  </span>
                </span>
                {document.is_verified ? (
                  <a
                    href={document.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-fluid-2xs font-bold text-white transition-colors hover:bg-emerald-700"
                  >
                    <Download size={13} aria-hidden="true" />
                    دانلود سند
                  </a>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-fluid-2xs font-bold text-slate-500 dark:bg-emerald-900 dark:text-emerald-200">
                    در انتظار تأیید کارشناس
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-fluid-2xs text-slate-400 dark:border-emerald-800 dark:text-emerald-300">
            هنوز سندی برای این پرونده بارگذاری نشده است.
          </p>
        )}
      </section>
    </article>
  );
}

export default function ExportDashboard() {
  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['export-orders', 'mine'],
    queryFn: getMyExportOrders,
    staleTime: 60 * 1000,
  });

  const exportOrders = data ?? [];

  return (
    <main className="page-shell py-8">
      <Helmet>
        <title>پرونده‌های صادراتی | گرین کود</title>
        {/* Account-scoped desk; must never be indexed. */}
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-fluid-sm font-bold text-emerald-700 dark:text-lime-300">
            تجارت بین‌الملل
          </p>
          <h1 className="mt-1 text-fluid-2xl font-extrabold text-slate-800 dark:text-white">
            پرونده‌های صادراتی من
          </h1>
        </div>
        <Button to="/orders" variant="secondary" icon={ClipboardList}>
          سفارش‌های من
        </Button>
      </header>

      <div className="mt-7">
        {isPending ? (
          <ExportSkeleton />
        ) : isError ? (
          <section
            role="alert"
            className="rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm dark:border-rose-900 dark:bg-emerald-950"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200">
              <AlertTriangle size={26} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-fluid-lg font-extrabold text-slate-800 dark:text-white">
              پرونده‌های صادراتی دریافت نشد
            </h2>
            <p className="mx-auto mt-2 max-w-md text-fluid-sm leading-7 text-slate-500 dark:text-emerald-200">
              {parseApiError(error).message}
            </p>
            <div className="mt-5 flex justify-center">
              <Button
                variant="primary"
                icon={RefreshCw}
                loading={isRefetching}
                onClick={() => void refetch()}
              >
                تلاش دوباره
              </Button>
            </div>
          </section>
        ) : exportOrders.length ? (
          <div className="space-y-4">
            {exportOrders.map((exportOrder) => (
              <ExportOrderCard key={exportOrder.id} exportOrder={exportOrder} />
            ))}
          </div>
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm dark:border-emerald-800 dark:bg-emerald-950">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200">
              <Ship size={26} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-fluid-lg font-extrabold text-slate-800 dark:text-white">
              هنوز پرونده‌ی صادراتی ندارید
            </h2>
            <p className="mx-auto mt-2 max-w-md text-fluid-sm leading-7 text-slate-500 dark:text-emerald-200">
              وقتی یکی از سفارش‌های شما برای صادرات برنامه‌ریزی شود، پرونده‌ی آن همین‌جا باز
              می‌شود و اسناد گمرکی‌اش - پس از تأیید کارشناس - برای دانلود در دسترس قرار می‌گیرد.
            </p>
            <div className="mt-5 flex justify-center">
              <Button to="/orders" variant="primary" icon={ClipboardList}>
                رفتن به سفارش‌های من
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
