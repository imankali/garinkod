// frontend/src/components/TopBar.tsx

import { Phone, Truck } from "lucide-react";

// ========================================
// Shipping promise
// ========================================
// One sentence, not four rotating ones. A marquee of four claims is four
// things nobody finishes reading; the single most decision-relevant fact —
// the free-shipping threshold — earns the line. No emoji prefix: a screen
// reader would read it aloud and each platform draws it differently.
const SHIPPING_PROMISE =
  "ارسال رایگان برای خرید بالای ۳ میلیون تومان، مطابق شرایط سفارش";

// ========================================
// TopBar Component
// ========================================
export default function TopBar(_props: { isDark?: boolean; onToggleDark?: () => void }) {
  const phoneNumber = import.meta.env.VITE_PHONE_NUMBER?.trim();

  return (
    /* The utility strip is the page's quietest line, not a second hero. It
       used to be a brand gradient with a marquee scrolling under it, which
       put the noisiest motion on the screen directly above the headline.
       Impeccable: one authored moment per page — the hero owns it. Taste:
       no ticker. Plain sentences, one at a time, in static type. */
    <div className="hidden border-b border-emerald-900/10 bg-ink-deep text-emerald-50 sm:block dark:border-emerald-800/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1 text-xs">
        
        {/* ======================================== */}
        {/* بخش چپ - ویژگی‌های فروشگاه */}
        {/* ======================================== */}
        <div className="flex items-center gap-3 whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            <Truck size={13} className="text-lime-300" />
            <span className="hidden md:inline">ارسال به سراسر کشور</span>
          </span>
          <span className="hidden text-fluid-xs text-emerald-100 md:inline">همراه تأمین، فروش و خدمات کشاورزی</span>
        </div>

        {/* ======================================== */}
        {/* Middle: the shipping promise, standing still. */}
        {/* ======================================== */}
        <p className="min-w-0 flex-1 truncate text-center text-fluid-2xs text-emerald-100/85">
          {SHIPPING_PROMISE}
        </p>

        {/* ======================================== */}
        {/* بخش راست - تماس و شبکه‌های اجتماعی */}
        {/* ======================================== */}
        <div className="flex items-center gap-3 whitespace-nowrap">
          {phoneNumber && (
            <a
              href={`tel:${phoneNumber.replace(/[^+\d]/g, '')}`}
              className="hidden min-h-11 items-center gap-1 hover:text-lime-300 md:flex"
              aria-label={`تماس با شماره ${phoneNumber}`}
            >
              <Phone size={13} />
              <span dir="ltr">{phoneNumber}</span>
            </a>
          )}

        </div>
      </div>
    </div>
  );
}