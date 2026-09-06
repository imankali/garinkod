// frontend/src/components/CookieJarNotice.tsx
//
// The one thing a shop must not do is log someone in and then pretend it did not.
// When the browser refuses to keep the session cookie — a preview opened inside an
// iframe of another origin, third-party cookies blocked, certain private-browsing
// modes — the visitor sees «error» and is back at the door, so they retry a correct
// password forever. This card names the cause and offers the two things that
// actually help, instead of an empty toast.

import { useEffect, useState } from 'react';
import { Cookie, RefreshCw, X } from 'lucide-react';

import { useAuthStore } from '../store/authStore';

export default function CookieJarNotice() {
  const cookieBlocked = useAuthStore((state) => state.cookieBlocked);
  const recheckCookieJar = useAuthStore((state) => state.recheckCookieJar);
  const dismissCookieNotice = useAuthStore((state) => state.dismissCookieNotice);
  const [checking, setChecking] = useState(false);

  // A blocked cookie is not a page the visitor can keep using, so the tab title
  // says so too — it is the only place visible when the dialog is dismissed.
  useEffect(() => {
    if (!cookieBlocked) return;
    const previous = document.title;
    document.title = 'مرورگر کوکی ورود را نگه نمی‌دارد — گرین کود';
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
      className="fixed inset-x-0 bottom-4 z-[999] mx-auto w-[min(560px,calc(100%-2rem))] rounded-2xl border-2 border-amber-300 bg-white p-4 shadow-2xl dark:border-amber-500/40 dark:bg-emerald-950"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <Cookie className="size-5" aria-hidden="true" />
        </span>

        <div className="flex-1 space-y-2 text-sm leading-6 text-slate-700 dark:text-emerald-100">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            مرورگر شما کوکی این آدرس را نگه نمی‌دارد
          </h2>
          <p>
            نام کاربری و رمز درست بود و سرور شما را پذیرفت؛ اما کوکی نشست در این
            مرورگر ذخیره نشد، تا درخواست بعدی دوباره غریبه باشید. این خطای حساب نیست،
            تنظیم مرورگر است.
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              اگر سایت را درون پیش‌نمایش یا قاب دیگری باز کرده‌اید، آن را در یک تب
              جداگانه باز کنید؛ بیرون از قاب این کوکی اول‌طرف (first-party) است و
              بدون دردسر کار می‌کند.
            </li>
            <li>
              اگر مرورگر روی «مسدود کردن کوکی سایت‌های دیگر» است، برای همین آدرس آن را
              آزاد کنید.
            </li>
            <li>در حالت ناشناسِ سخت‌گیرانه، از همان حالت بیرون بیایید یا دوباره وارد شوید.</li>
          </ul>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={recheck}
              disabled={checking}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <RefreshCw className={`size-4 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />
              {checking ? 'دارم بررسی می‌کنم…' : 'دوباره بررسی می‌کنم'}
            </button>
            <button
              type="button"
              onClick={dismissCookieNotice}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
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
