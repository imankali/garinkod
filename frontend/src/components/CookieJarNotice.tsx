// frontend/src/components/CookieJarNotice.tsx
//
// The one thing a shop must not do is log someone in and then pretend it did not.
// By the time this card appears, both ways of keeping a session have been tried and
// refused: the HttpOnly cookie (which a frame of another origin often cannot store) and
// the preview credential the store keeps itself (api/previewSession.ts), which needs the
// preview switch on and somewhere to live. That combination is rare and it is
// irreducible from inside the page — so instead of looping, the card hands over the one
// address that always works and the one key that explains the rest.
//
// A popup is also refused by a sandboxed frame, so «open in another tab» is only the
// first attempt: when the browser answers with null, the address itself is revealed for
// copying rather than pretending the click did something.

import { useEffect, useState } from 'react';
import { Clipboard, Cookie, ExternalLink, RefreshCw, X } from 'lucide-react';

import { useAuthStore } from '../store/authStore';

export default function CookieJarNotice() {
  const cookieBlocked = useAuthStore((state) => state.cookieBlocked);
  const recheckCookieJar = useAuthStore((state) => state.recheckCookieJar);
  const dismissCookieNotice = useAuthStore((state) => state.dismissCookieNotice);
  const [checking, setChecking] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [copied, setCopied] = useState(false);

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

  function openTopLevel() {
    let opened: Window | null = null;
    try {
      opened = window.open(address, '_blank', 'noopener');
    } catch {
      opened = null;
    }
    if (!opened) setShowAddress(true);
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
            این قاب هنوز نشست را نگه نمی‌دارد
          </h2>
          <p>
            نام کاربری و رمز درست بود و سرور شما را پذیرفت؛ اما هیچ‌یک از دو راه
            نگه‌داشتن نشست در این قاب به نتیجه نرسید: کوکی ذخیره نشد و دادهٔ همین قاب
            هم نگه داشته نشد. برای همین درخواست بعدی دوباره بی‌نام می‌ماند — این خطای
            حساب نیست، تنظیم همین مرورگر است.
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs leading-5">
            <li>
              مطمئن‌ترین راه: سایت را بیرون از این قاب باز کنید؛ آدرسش همان است و آنجا
              کوکی اول‌طرف (first-party) است.
            </li>
            <li>
              اگر مرورگر روی «مسدود کردن کوکی و دادهٔ سایت‌های دیگر» است، برای همین آدرس
              آزادش کنید؛ در آن حالت هیچ جایی برای نگه داشتن نشست نیست.
            </li>
            <li>
              در پیش‌نمایش، توکن با کلید
              <span className="font-mono"> GK_PREVIEW_IFRAME_COOKIES</span> به صفحه داده
              می‌شود؛ اگر روشن نیست، این مسیر اصلاً باز نمی‌شود. در سایت واقعی هم هر دو
              راه فقط همان کوکی HttpOnly است.
            </li>
          </ul>

          {showAddress ? (
            <label className="block space-y-1">
              <span className="text-xs text-slate-500 dark:text-emerald-300">
                این آدرس را در یک تب تازه باز کنید
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
              onClick={openTopLevel}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              باز کردن در تب جدا
            </button>
            <button
              type="button"
              onClick={copyAddress}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
            >
              <Clipboard className="size-4" aria-hidden="true" />
              {copied ? 'کپی شد' : 'کپی آدرس'}
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
