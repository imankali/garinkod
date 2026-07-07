// frontend/src/components/TopBar.tsx

import { Globe, MessageCircle, Phone, Send, ShieldCheck, Truck } from "lucide-react";

// ========================================
// Types
// ========================================
interface TopBarProps {
  isDark?: boolean;
  onToggleDark?: () => void;
}

// ========================================
// Messages Configuration
// ✅ پیام‌های چرخشی در TopBar
// ========================================
const messages = [
  "🚚 ارسال رایگان برای خرید بالای ۳ میلیون تومان در سراسر کشور",
  "🌱 مشاوره رایگان کارشناسان کشاورزی: ۰۲-۱۲۳۴۵۶۷۸",
  " تا ۳۰٪ تخفیف ویژه بهاره روی کودهای ارگانیک",
  "🛡️ دارای مجوز رسمی فروش نهاده‌های کشاورزی",
];

// ========================================
// TopBar Component
// ========================================
export default function TopBar({}: TopBarProps) {
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
          <span className="hidden h-3 w-px bg-emerald-400/50 md:block" />
          <span className="hidden items-center gap-1.5 md:flex">
            <ShieldCheck size={13} className="text-lime-300" />
            مجوز رسمی نهاده‌های کشاورزی
          </span>
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
          
          <span className="hidden h-3 w-px bg-emerald-400/50 md:block" />
          
          {/* شبکه‌های اجتماعی */}
          <div className="flex items-center gap-2.5">
            <a
              href="#"
              className="transition-transform hover:-translate-y-0.5 hover:text-lime-300"
              aria-label="وبسایت"
            >
              <Globe size={14} />
            </a>
            <a
              href="#"
              className="transition-transform hover:-translate-y-0.5 hover:text-lime-300"
              aria-label="تلگرام"
            >
              <Send size={14} />
            </a>
            <a
              href="#"
              className="transition-transform hover:-translate-y-0.5 hover:text-lime-300"
              aria-label="واتس‌اپ"
            >
              <MessageCircle size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}