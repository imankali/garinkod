// frontend/src/components/CookieJarNotice.tsx
//
// The one thing a shop must not do is log someone in and then pretend it did not.
// When a frame refuses to keep the session — a preview inside an iframe of another
// origin, storage denied, third-party cookies blocked, some private-browsing modes —
// the visitor sees «error» and is back at the door, so they retry a correct password
// forever. This card says what actually happened, offers the fastest way out (open the
// same address on its own), and re-checks on request instead of asking for a reload.
//
// It is not the place where the fallback lives: the auth store first tries to keep the
// preview credential itself (see api/previewSession.ts), and only when that too was
// refused does this appear.

import { useEffect, useState } from 'react';
import { Cookie, ExternalLink, RefreshCw, X } from 'lucide-react';

import { useAuthStore } from '../store/authStore';

export default function CookieJarNotice() {
  const cookieBlocked = useAuthStore((state) => state.cookieBlocked);
  const recheckCookieJar = useAuthStore((state) => state.recheckCookieJar);
  const dismissCookieNotice = useAuthStore((state) => state.dismissCookieNotice);
  const [checking, setChecking] = useState(false);

  // A blocked session is not a page the visitor can keep using, so the tab title
  // says so too — it is the only place visible once this card is dismissed.
  useEffect(() => {
    if (!cookieBlocked) return;
    const previous = document.title;
    document.title = 'این قاب کوکی نشست را نگه نمی‌دارد — گرین کود';
    return () => {
      document.title = previous;
    };
  }, [cookieBlocked]);

  if (!cookieBlocked) return null;

  async function recheck() {
    setChecking(true);
    await recheckCookieJar();
    setChecking(false);
  }

  return (
    <div
      role="alert"
      dir="rtl"
      className="fixed inset-x-0 bottom-4 z-[999] mx-auto w-[min(600px,calc(100%-2rem))] rounded-2xl border-2 border-amber-300 bg-white p-4 shadow-2xl dark:border-amber-500/40 dark:bg-emerald-950"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <Cookie className="size-5" aria-hidden="true" />
        </span>

        <div className="flex-1 space-y-2 text-sm leading-6 text-slate-700 dark:text-emerald-100">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            مرورگر شما کوکی این آدرس را نگه نمی‌دارد
          </h2>
          <p>
            نام کاربری و رمز درست بود و سرور شما را پذیرفت؛ اما این قاب هیچ‌کدام از
            دو راهِ نگه‌داشتن نشست را نگفت — کوکی ذخیره نشد و حافظه همین قاب هم اجازه
            نداشت. برای همین درخواست بعدی دوباره بی‌نام می‌ماند. این خطای حساب نیست،
            تنظیم مرورگر است.
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              سریع‌ترین راه: همین آدرس را در یک تب جداگانه باز کنید. بیرون از قاب، کوکی
              اول‌طرف (first-party) است و همان ورود بی‌دردسر می‌نشیند.
            </li>
            <li>
              اگر مرورگر روی «مسدود کردن کوکی سایت‌های دیگر» است، برای همین آدرس آن را
              آزاد کنید.
            </li>
            <li>در حالت ناشناسِ سخت‌گیرانه، حافظهٔ این قاب هم پاک می‌شود؛ از آن بیرون بیایید.</li>
          </ul>
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-emerald-900/40 dark:text-emerald-200">
            در پیش‌نمایش، کلید <span className="font-mono">GK_PREVIEW_IFRAME_COOKIES</span> به‌جز
            کوکی، توکن را هم در حافظه همین قاب نگه می‌دارد و با سربرگ Authorization
            می‌فرستد؛ اگر این پیام را می‌بینید، آن هم نگه داشته نشد. در سایت واقعی این
            کار انجام نمی‌شود و نشست تنها همان کوکی HttpOnly است.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => window.open(window.location.href, '_blank', 'noopener')}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              باز کردن در تب جدا
            </button>
            <button
              type="button"
              onClick={recheck}
              disabled={checking}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
            >
              <RefreshCw className={`size-4 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />
              {checking ? 'دارم بررسی می‌کنم…' : 'دوباره بررسی می‌کنم'}
            </button>
            <button
              type="button"
              onClick={dismissCookieNotice}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-50 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
            >
              <X className="size-4" aria-hidden="true" />
              بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
