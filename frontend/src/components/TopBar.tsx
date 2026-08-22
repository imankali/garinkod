// frontend/src/components/TopBar.tsx

import { Phone, Truck } from "lucide-react";

// ========================================
// Messages Configuration
// ✅ پیام‌های چرخشی در TopBar
// ========================================
const messages = [
  "🚚 ارسال رایگان برای خرید بالای ۳ میلیون تومان، مطابق شرایط سفارش",
  "🌱 ثبت سفارش، مشاوره و خدمات مزرعه از یک حساب کاربری",
  "🌾 بازار کشاورزان با بررسی آگهی‌ها پیش از انتشار",
  "📦 پیش از پرداخت، موجودی و هزینه ارسال سفارش بررسی می‌شود",
];

// ========================================
// TopBar Component
// ========================================
export default function TopBar(_props: { isDark?: boolean; onToggleDark?: () => void }) {
  // ✅ شماره تلفن از environment variable (با fallback)
  const PHONE_NUMBER = import.meta.env.VITE_PHONE_NUMBER || "02112345678";

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
          <span className="hidden text-[11px] text-emerald-100 md:inline">همراه تأمین، فروش و خدمات کشاورزی</span>
        </div>

        {/* ======================================== */}
        {/* بخش وسط - پیام‌های چرخشی (Marquee) */}
        {/* ======================================== */}
        <div className="relative flex-1 overflow-hidden no-scrollbar">
          <div className="flex w-max animate-marquee gap-16 whitespace-nowrap">
            {[...messages, ...messages].map((msg, idx) => (
              <span key={idx} className="opacity-90">
                {msg}
              </span>
            ))}
          </div>
        </div>

        {/* ======================================== */}
        {/* بخش راست - تماس و شبکه‌های اجتماعی */}
        {/* ======================================== */}
        <div className="flex items-center gap-3 whitespace-nowrap">
          {/* شماره تلفن */}
          <a
            href={`tel:${PHONE_NUMBER}`}
            className="hidden items-center gap-1 hover:text-lime-300 md:flex"
            aria-label={`تماس با شماره ${PHONE_NUMBER}`}
          >
            <Phone size={13} />
            <span dir="ltr">{PHONE_NUMBER}</span>
          </a>

        </div>
      </div>
    </div>
  );
}