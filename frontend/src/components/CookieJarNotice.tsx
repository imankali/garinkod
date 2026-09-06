// frontend/src/components/CookieJarNotice.tsx
//
// The one thing a shop must not do is log someone in and then pretend it did not.
//
// By the time this card appears, every way of keeping a session has been tried and
// refused: the HttpOnly cookie, the frame's own storage, the credential written into the
// page's address for the proxy to carry, and the Authorization header. That is a setting of
// the browser around this frame rather than anything about the account, and saying so is
// worth more than another silent bounce to the login form.
//
// It deliberately does not promise what it cannot do. A preview shown inside a host that
// only serves it framed cannot be opened "in a new tab" by the page itself — popups are
// refused and the address is not reachable outside the host — so the card says where to go
// instead, and hands over the address for copying when the visitor wants it in a real window.

import { useEffect, useState } from 'react';
import { Clipboard, Cookie, RefreshCw, X } from 'lucide-react';

import { useAuthStore } from '../store/authStore';

export default function CookieJarNotice() {
  const cookieBlocked = useAuthStore((state) => state.cookieBlocked);
  const recheckCookieJar = useAuthStore((state) => state.recheckCookieJar);
  const dismissCookieNotice = useAuthStore((state) => state.dismissCookieNotice);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAddress, setShowAddress] = useState(false);

  // A session that cannot be kept is not a page the visitor can keep using, so the tab
  // title says so too — it is the only place visible once this card is dismissed.
  useEffect(() => {
    if (!cookieBlocked) return;
    const previous = document.title;
    document.title = 'این قاب نشست را نگه نمی‌دارد — گرین کود';
    return () => {
      document.title = previous;
    };
  }, [cookieBlocked]);

  if (!cookieBlocked) return null;

  const address = window.location.href;

  async function recheck() {
    setChecking(true);
    await recheckCookieJar();
    setChecking(false);
  }

  async function copyAddress() {
    setShowAddress(true);
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      // The field below is selectable, which is all a denied clipboard leaves behind.
    }
  }

  return (
    <div
      role="alert"
      dir="rtl"
      className="fixed inset-x-0 bottom-4 z-[999] mx-auto w-[min(620px,calc(100%-2rem))] rounded-2xl border-2 border-amber-300 bg-white p-4 shadow-2xl dark:border-amber-500/40 dark:bg-emerald-950"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <Cookie className="size-5" aria-hidden="true" />
        </span>

        <div className="flex-1 space-y-2 text-sm leading-6 text-slate-700 dark:text-emerald-100">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            این قاب هیچ‌جایی برای نگه داشتن نشست ندارد
          </h2>
          <p>
            نام کاربری و رمز درست بود و سرور شما را پذیرفت؛ اما این قاب نه کوکی را نگه
            داشت، نه دادهٔ خودش را، و نشانهٔ ورودی هم که در نشانی می‌گذاریم به صفحه نرسید.
            برای همین درخواست بعدی دوباره بی‌نام می‌ماند. این خطای حساب نیست — تنظیم همین
            قاب و مرورگرش است.
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs leading-5">
            <li>
              پیش‌نمایش را از همان گفت‌وگو در میزبانش باز کنید؛ نشانی این قاب بیرون از
              میزبان باز نمی‌شود، پس «تب تازه» از داخل این صفحه کاری انجام نمی‌دهد.
            </li>
            <li>
              اگر مرورگر روی «مسدود کردن کوکی و دادهٔ همهٔ سایت‌ها» است، برای همین نشانی
              آزادش کنید — در آن حالت هیچ جا برای نگه داشتن نشست نمی‌ماند.
            </li>
            <li>
              در پیش‌نمایش با کلید
              <span className="font-mono"> GK_PREVIEW_IFRAME_COOKIES</span> همان نشانهٔ
              کوکی یک‌بار به خود صفحه سپرده می‌شود تا با سربرگ یا نشانی فرستاده شود؛ در
              سایت واقعی تنها همان کوکی HttpOnly وجود دارد.
            </li>
          </ul>

          {showAddress ? (
            <label className="block space-y-1">
              <span className="text-xs text-slate-500 dark:text-emerald-300">
                نشانی همین پیش‌نمایش
              </span>
              <input
                readOnly
                value={address}
                onFocus={(event) => event.target.select()}
                dir="ltr"
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-left font-mono text-xs outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100"
              />
            </label>
          ) : null}

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
              onClick={copyAddress}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
            >
              <Clipboard className="size-4" aria-hidden="true" />
              {copied ? 'کپی شد' : 'کپی نشانی'}
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
