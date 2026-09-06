// frontend/src/components/ShopQueueGate.tsx
//
// The waiting screen a busy shop shows instead of a wall of error toasts.
//
// It replaces the application tree while the visitor is outside the door, which
// is the whole point: the queries, pollers and image loads of a storefront are
// exactly the traffic a strained server cannot afford, and a screen that keeps
// retrying them "for the user's convenience" is how a slowdown becomes an outage.
// While it is up, the only thing this app does is ask one small question once in
// a while.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Hourglass, RefreshCw } from 'lucide-react';

import { getAdmissionState, releaseWaiting, subscribeAdmission, type AdmissionState } from '../api/admission';
import { opsApi, type AdmissionAnswer } from '../api/services';

const FALLBACK_REFRESH_SECONDS = 15;

export default function ShopQueueGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdmissionState>(getAdmissionState());
  const [answer, setAnswer] = useState<AdmissionAnswer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(FALLBACK_REFRESH_SECONDS);
  const [checking, setChecking] = useState(false);
  const reloading = useRef(false);

  useEffect(() => subscribeAdmission(setState), []);

  const ask = useCallback(async () => {
    setChecking(true);
    try {
      const response = await opsApi.admission();
      setAnswer(response.data);
      if (response.data.state === 'inside') {
        // Back in. The data behind a waiting screen is stale by definition, so the
        // page is loaded once, from the address the visitor was already on.
        if (!reloading.current) {
          reloading.current = true;
          releaseWaiting();
          window.location.reload();
        }
        return;
      }
      setSecondsLeft(Math.max(5, response.data.refresh_seconds || FALLBACK_REFRESH_SECONDS));
    } catch {
      // No answer is an answer too: the line still moves, and the next attempt is
      // the one that matters. Nothing is shown as an error on purpose.
      setSecondsLeft(FALLBACK_REFRESH_SECONDS);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!state.waiting) return;
    ask();
    const ticker = window.setInterval(() => setSecondsLeft((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => window.clearInterval(ticker);
  }, [state.waiting, ask]);

  useEffect(() => {
    if (!state.waiting) return;
    const wait = Math.max(5, answer?.refresh_seconds || secondsLeft || FALLBACK_REFRESH_SECONDS);
    const timer = window.setTimeout(ask, wait * 1000);
    return () => window.clearTimeout(timer);
  }, [state.waiting, answer?.refresh_seconds, secondsLeft, ask]);

  if (!state.waiting) return <>{children}</>;

  const position = answer?.position ?? state.snapshot?.position ?? 0;
  const ahead = Math.max(position - 1, 0);
  const waitingMinutes = answer?.waiting_minutes ?? state.snapshot?.waiting_minutes ?? 0;
  const ceiling = answer?.max_wait_minutes ?? state.snapshot?.max_wait_minutes ?? 0;

  return (
    <div
      dir="rtl"
      className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#052e22] via-emerald-900 to-lime-600 p-4"
    >
      <div className="w-full max-w-xl rounded-[28px] bg-white/95 p-7 text-center shadow-2xl dark:bg-emerald-950/95">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-lime-200">
          <Hourglass size={14} />
          گرین کود — این لحظه شلوغ است
        </span>

        <h1 className="mt-4 text-2xl font-extrabold text-slate-800 dark:text-white">
          {position ? `شما نفر ${toFa(position)} در صف هستید` : 'صف برای شما باز می‌شود'}
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-emerald-100">
          {answer?.message
            || 'جایتان در صف نگه داشته شده و هر جا که خالی شود، به ترتیب ورود، همان صفحه‌ای که می‌خواستید باز می‌شود. لازم نیست صفحه را ببندید.'}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <Cell label="نفرات جلوتر" value={toFa(ahead)} />
          <Cell label="زمانی که صبر کرده‌اید" value={waitingMinutes ? `${toFa(waitingMinutes)} دقیقه` : 'چند لحظه'} />
          <Cell label="ظرفیت فعلی سرور" value={toFa(answer?.capacity ?? state.snapshot?.capacity ?? 0)} />
        </div>

        <p className="mt-4 text-xs leading-6 text-slate-500 dark:text-emerald-200">
          {typeof ceiling === 'number' && ceiling > 0
            ? `حتی اگر صف حرکت نکند، بیش از ${toFa(ceiling)} دقیقه معطل نمی‌شوید.`
            : 'صف به ترتیب زمان ورود حرکت می‌کند و لازم نیست چیزی را تازه کنید.'}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={ask}
            disabled={checking}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <RefreshCw size={15} className={checking ? 'animate-spin' : ''} />
            {checking ? 'دارم نگاه می‌کنم…' : 'دوباره نگاه می‌کنم'}
            {!checking && secondsLeft > 0 ? <span className="text-xs font-normal opacity-80">({toFa(secondsLeft)})</span> : null}
          </button>
        </div>

        <p className="mt-5 text-[11px] leading-6 text-slate-400 dark:text-emerald-300/70">
          رفرش‌های پی‌در‌پی شما را جلو نمی‌اندازد؛ بسته نگه‌داشتن همین صفحه هم جایتان را نگه می‌دارد و هم به سرور
          فرصت می‌دهد تا همان کاری را که برای بقیه انجام می‌داد، برای شما تمام کند.
        </p>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[128px] rounded-2xl bg-slate-50 px-4 py-3 dark:bg-emerald-900/40">
      <p className="text-[11px] text-slate-500 dark:text-emerald-200">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white">{value}</p>
    </div>
  );
}

/** Persian digits everywhere else in the shop; the waiting screen is no exception. */
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toFa(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)] ?? digit);
}
