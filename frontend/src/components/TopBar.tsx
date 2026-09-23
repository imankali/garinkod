// frontend/src/components/TopBar.tsx

import { LucideIcon, PackageCheck, Phone, Sprout, Store, Truck } from 'lucide-react';

import { useAutoRotate } from "../hooks/useAutoRotate";

// ========================================
// Messages Configuration
// ✅ پیام‌های چرخشی در TopBar
// ========================================
/*
 * The ticker's four messages, each with the icon that used to be an emoji.
 *
 * The emoji were doing two jobs — marking the message and setting its width —
 * and only one of them was intended: a marquee whose items are emoji is a strip
 * whose layout changes with the reader's platform font. An SVG from the same set
 * the header uses keeps the strip's rhythm identical everywhere, and the icon
 * inherits the bar's colour instead of bringing its own.
 */
const FIRST_MESSAGE: { text: string; icon: LucideIcon } = {
  text: "ارسال رایگان برای خرید بالای ۳ میلیون تومان، مطابق شرایط سفارش",
  icon: Truck,
};

const messages: { text: string; icon: LucideIcon }[] = [
  FIRST_MESSAGE,
  { text: "ثبت سفارش، مشاوره و خدمات مزرعه از یک حساب کاربری", icon: Sprout },
  { text: "بازار کشاورزان با بررسی آگهی‌ها پیش از انتشار", icon: Store },
  { text: "پیش از پرداخت، موجودی و هزینه ارسال سفارش بررسی می‌شود", icon: PackageCheck },
];

// ========================================
// TopBar Component
// ========================================
export default function TopBar(_props: { isDark?: boolean; onToggleDark?: () => void }) {
  const phoneNumber = import.meta.env.VITE_PHONE_NUMBER?.trim();
  // The ticker is auto-moving text in a bar that is always on screen, so it
  // obeys the same switch as the hero and the rails (WCAG 2.2.2). Its CSS
  // animation also stops under `prefers-reduced-motion` — see index.css.
  const { playing } = useAutoRotate();

  return (
    <div className="hidden overflow-hidden bg-brand-gradient text-emerald-50 sm:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-xs">
        
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
        {/* بخش وسط - پیام‌های چرخشی (Marquee) */}
        {/* ======================================== */}
        {/* min-w-0 lets the flex child actually shrink, so the w-max marquee
            inside is clipped instead of stretching the whole bar. */}
        <div className="no-scrollbar relative min-w-0 flex-1 overflow-hidden" aria-hidden="true">
          {playing ? (
            /*
             * Seamless ticker.
             *
             * It used to travel `translateX(100%) → -100%` on a `w-max` strip
             * while the window showing it is a quarter of its width, so the
             * strip spent most of the cycle entirely outside the bar: measured
             * across the 22s loop, this box was empty for 8 of those seconds
             * (36%) and every message had to be caught on the way past.
             *
             * Two changes make it continuous. The strip holds the list twice and
             * travels exactly one copy (`0 → -50%`), so the moment the second
             * copy reaches the window the first copy is where it started. And
             * the gap moved from `gap-16` into each item's padding: a flex `gap`
             * between items is not part of the element's measured width, so
             * `-50%` would have been half a gap short every loop and the seam
             * would tick. Padding counts toward the width, so the two halves are
             * exactly equal and the loop is pixel-exact.
             *
             * 15s per copy is ~110 px/s at this type size — slow enough to read
             * a message on the way past, which the old 290 px/s was not.
             */
            <div className="flex w-max animate-marquee whitespace-nowrap">
              {[...messages, ...messages].map((msg, idx) => (
                <span key={idx} className="flex shrink-0 items-center gap-1.5 pe-16 opacity-90">
                  <msg.icon size={13} aria-hidden="true" className="shrink-0" />
                  {msg.text}
                </span>
              ))}
            </div>
          ) : (
            /* Motion off: one message, stationary and readable, instead of a
               strip frozen wherever the loop happened to be. */
            <span className="flex items-center gap-1.5 truncate opacity-90">
              <FIRST_MESSAGE.icon size={13} aria-hidden="true" className="shrink-0" />
              {FIRST_MESSAGE.text}
            </span>
          )}
        </div>

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