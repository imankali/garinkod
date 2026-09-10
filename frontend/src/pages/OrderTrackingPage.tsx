// frontend/src/pages/OrderTrackingPage.tsx
// Shareable buyer-facing tracking surface: /tracking/<trackingCode>.
//
// State machine, deliberately explicit:
// * isPending  -> geometry-exact skeleton (no layout jump when data lands),
// * isError    -> transport/server failure with the parsed message + retry,
// * data null  -> code unknown (or belongs to someone else; the API never
//   confirms a foreign parcel), rendered as a calm "not found",
// * data       -> shipment summary card + TrackingTimeline (newest first).

import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  PackageSearch,
  RefreshCw,
  Truck,
} from 'lucide-react';

import { parseApiError } from '../api/errors';
import { getShipmentByTrackingCode } from '../services/logistics';
import TrackingTimeline from '../components/TrackingTimeline';
import Button from '../components/ui/Button';
import type { LogisticsShipmentStatus } from '../types/logistics';

/** Overall-status pill tones; page-local, mirroring Orders.tsx conventions. */
const STATUS_BADGE: Record<LogisticsShipmentStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  picked_up: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  in_transit: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  out_for_delivery: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  failed: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('fa-IR', { dateStyle: 'long' });
}

/**
 * Shimmer that matches the shipped layout one-to-one: a header card, four
 * summary rows and three timeline hops, so success content never jumps.
 */
function TrackingSkeleton() {
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری اطلاعات رهگیری" role="status">
      <div className="animate-pulse rounded-3xl border border-slate-100 bg-white px-4 py-5 shadow-sm dark:border-emerald-800 dark:bg-emerald-950">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-slate-200 dark:bg-emerald-900" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-emerald-900" />
            <div className="h-5 w-40 rounded bg-slate-200 dark:bg-emerald-900" />
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4">
              <div className="h-3 w-20 rounded bg-slate-100 dark:bg-emerald-900/70" />
              <div className="h-3 w-32 rounded bg-slate-200 dark:bg-emerald-900" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 animate-pulse rounded-3xl border border-slate-100 bg-white px-4 py-5 shadow-sm dark:border-emerald-800 dark:bg-emerald-950">
        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-emerald-900" />
        <div className="mt-5 space-y-6">
          {[0, 1, 2].map((hop) => (
            <div key={hop} className="flex items-start gap-4">
              <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200 dark:bg-emerald-900" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-28 rounded bg-slate-200 dark:bg-emerald-900" />
                <div className="h-3 w-full rounded bg-slate-100 dark:bg-emerald-900/70" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  const { trackingCode = '' } = useParams<{ trackingCode: string }>();
  const code = trackingCode.trim();

  const {
    data: shipment,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['logistics-shipment', code],
    queryFn: () => getShipmentByTrackingCode(code),
    enabled: code.length > 0,
    // A buyer refreshes tracking while the parcel moves; one minute is fresh
    // enough to stop refetch storms without hiding real progress.
    staleTime: 60 * 1000,
  });

  const notFound = code.length > 0 && !isPending && !isError && !shipment;

  return (
    <main className="page-shell py-8">
      <Helmet>
        <title>{`رهگیری مرسوله ${code} | گرین کود`}</title>
        {/* Tracking pages are per-buyer and volatile; they must never be indexed. */}
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-fluid-sm font-bold text-emerald-700 dark:text-lime-300">
            رهگیری لحظه‌ای مرسوله
          </p>
          <h1 className="mt-1 text-fluid-2xl font-extrabold text-slate-800 dark:text-white">
            مرسوله <span dir="ltr">{code || 'نامشخص'}</span>
          </h1>
        </div>
        <Button to="/orders" variant="secondary" icon={ClipboardList}>
          سفارش‌های من
        </Button>
      </header>

      <div className="mt-7">
        {code.length === 0 || notFound ? (
          <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm dark:border-emerald-800 dark:bg-emerald-950">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
              <PackageSearch size={26} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-fluid-lg font-extrabold text-slate-800 dark:text-white">
              مرسوله‌ای با این کد رهگیری پیدا نشد
            </h2>
            <p className="mx-auto mt-2 max-w-md text-fluid-sm leading-7 text-slate-500 dark:text-emerald-200">
              کد رهگیری را دقیقاً همان‌طور که روی رسید حامل درج شده بنویسید. اگر تازه
              وارد حساب نشده‌اید، ابتدا از صفحه سفارش‌های من وارد شوید؛ رهگیری فقط به
              مالک سفارش نشان داده می‌شود.
            </p>
            <div className="mt-5 flex justify-center">
              <Button to="/orders" variant="primary" icon={ClipboardList}>
                رفتن به سفارش‌های من
              </Button>
            </div>
          </section>
        ) : isPending ? (
          <TrackingSkeleton />
        ) : isError ? (
          <section
            role="alert"
            className="rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm dark:border-rose-900 dark:bg-emerald-950"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200">
              <AlertTriangle size={26} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-fluid-lg font-extrabold text-slate-800 dark:text-white">
              اطلاعات رهگیری دریافت نشد
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
        ) : shipment ? (
          <>
            {/* Shipment summary: carrier, code, overall state, the promise. */}
            <section className="rounded-3xl border border-slate-100 bg-white px-4 py-5 shadow-sm dark:border-emerald-800 dark:bg-emerald-950 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
                    <Truck size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-fluid-2xs text-slate-400 dark:text-emerald-200/70">
                      {shipment.carrier_name}
                    </p>
                    <p className="truncate text-fluid-base font-extrabold text-slate-800 dark:text-white" dir="ltr">
                      {shipment.tracking_code}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-fluid-2xs font-bold ${STATUS_BADGE[shipment.status]}`}
                >
                  {shipment.status_label}
                </span>
              </div>

              <dl className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 dark:border-emerald-800">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-fluid-xs text-slate-500 dark:text-emerald-200">سفارش</dt>
                  <dd className="text-fluid-xs font-bold text-slate-700 dark:text-emerald-100" dir="ltr">
                    {shipment.order_code}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-fluid-xs text-slate-500 dark:text-emerald-200">نام حامل</dt>
                  <dd className="text-fluid-xs font-bold text-slate-700 dark:text-emerald-100">
                    {shipment.carrier_name}
                  </dd>
                </div>
                {shipment.estimated_delivery_date && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="flex items-center gap-1.5 text-fluid-xs text-slate-500 dark:text-emerald-200">
                      <CalendarClock size={13} aria-hidden="true" />
                      تحویل تخمینی
                    </dt>
                    <dd className="text-fluid-xs font-bold text-emerald-700 dark:text-lime-300">
                      {formatDate(shipment.estimated_delivery_date)}
                    </dd>
                  </div>
                )}
                {shipment.shipped_at && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-fluid-xs text-slate-500 dark:text-emerald-200">خروج از انبار</dt>
                    <dd className="text-fluid-xs font-bold text-slate-700 dark:text-emerald-100">
                      {formatDateTime(shipment.shipped_at)}
                    </dd>
                  </div>
                )}
                {shipment.delivered_at && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-fluid-xs text-slate-500 dark:text-emerald-200">زمان تحویل</dt>
                    <dd className="text-fluid-xs font-bold text-emerald-700 dark:text-lime-300">
                      {formatDateTime(shipment.delivered_at)}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            <TrackingTimeline
              events={shipment.events}
              heading="رویدادهای مرسوله"
              className="mt-6"
            />
          </>
        ) : null}
      </div>
    </main>
  );
}
