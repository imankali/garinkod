// frontend/src/components/WeatherWidget.tsx

import { useState } from "react";
import { AlertTriangle, CloudRain, Droplets, MapPin, Sun, Wind } from "lucide-react";

// ========================================
// Types
// ========================================
interface WeatherData {
  temp: string;
  condition: string;
  wind: string;
  humidity: string;
  advisory: string;
  canSpray: boolean;
  icon: typeof Sun;
}

interface WeatherDataMap {
  [key: string]: WeatherData;
}

// ========================================
// Weather Data Configuration
// ✅ داده‌های هواشناسی برای استان‌های مختلف
// ========================================
const weatherData: WeatherDataMap = {
  fars: {
    temp: "۲۴°C",
    condition: "آفتابی و آرام",
    wind: "۸ کیلومتر بر ساعت",
    humidity: "۴۵٪",
    advisory: "شرایط جوی برای محلول‌پاشی و سمپاشی بهاره کاملاً مساعد است.",
    canSpray: true,
    icon: Sun,
  },
  khozestan: {
    temp: "۳۱°C",
    condition: "آفتابی و گرم",
    wind: "۱۲ کیلومتر بر ساعت",
    humidity: "۳۵٪",
    advisory: "به علت دمای بالا در میانه روز، محلول‌پاشی فقط در ساعات اولیه صبح یا غروب توصیه می‌شود.",
    canSpray: true,
    icon: Sun,
  },
  kerman: {
    temp: "۲۲°C",
    condition: "وزش باد شدید",
    wind: "۲۸ کیلومتر بر ساعت",
    humidity: "۳۰٪",
    advisory: "هشدار باد شدید! از هرگونه محلول‌پاشی و سمپاشی خودداری کنید زیرا باعث هدررفت و آسیب می‌شود.",
    canSpray: false,
    icon: Wind,
  },
  mazandaran: {
    temp: "۱۹°C",
    condition: "بارانی و مرطوب",
    wind: "۱۵ کیلومتر بر ساعت",
    humidity: "۸۵٪",
    advisory: "بارش باران پیش‌بینی می‌شود؛ حداقل ۴۸ ساعت تا پایداری هوا از مصرف قارچ‌کش‌ها و سموم خودداری کنید.",
    canSpray: false,
    icon: CloudRain,
  },
  khorasan: {
    temp: "۲۱°C",
    condition: "معتدل و پایدار",
    wind: "۱۰ کیلومتر بر ساعت",
    humidity: "۴۰٪",
    advisory: "هوای پایدار؛ زمان طلایی برای تغذیه با کودهای پتاس‌بالا و اسید هیومیک در باغات.",
    canSpray: true,
    icon: Droplets,
  },
};

// ========================================
// WeatherWidget Component
// ========================================
export default function WeatherWidget() {
  const [province, setProvince] = useState<string>("fars");
  const data: WeatherData = weatherData[province] ?? weatherData.fars!;
  const IconComponent = data.icon;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 pb-2">
      <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-md dark:border-emerald-900/40 dark:bg-[#08392a] md:p-5">
        
        {/* ======================================== */}
        {/* Header */}
        {/* ======================================== */}
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-[#0F8A5F] dark:bg-emerald-950 dark:text-lime-300">
              <IconComponent size={24} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 dark:text-emerald-300">
                  نمونهٔ توصیه اقلیمی
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    data.canSpray
                      ? "bg-emerald-100 text-[#0F8A5F] dark:bg-emerald-900 dark:text-lime-300"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                  }`}
                >
                  {data.canSpray ? "✔ شرایط مساعد سمپاشی" : "⚠ نامساعد برای سمپاشی"}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white md:text-base">
                توصیه نمایشی؛ پیش از مصرف، داده زنده را بررسی کنید
              </h3>
            </div>
          </div>

          {/* ======================================== */}
          {/* Region Selector */}
          {/* ======================================== */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <MapPin size={15} className="text-[#0F8A5F] dark:text-lime-300" />
            <span className="text-xs font-semibold text-slate-600 dark:text-emerald-100">
              استان شما:
            </span>
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-[#0F8A5F] focus:outline-none dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
              aria-label="انتخاب استان"
            >
              <option value="fars">فارس (شیراز و مرودشت)</option>
              <option value="khozestan">خوزستان (اهواز و دزفول)</option>
              <option value="kerman">کرمان (رفسنجان و سیرجان)</option>
              <option value="mazandaran">مازندران (ساری و بابل)</option>
              <option value="khorasan">خراسان رضوی (مشهد و نیشابور)</option>
            </select>
          </div>
        </div>

        {/* ======================================== */}
        {/* Stats Strip */}
        {/* ======================================== */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-emerald-900/40 sm:grid-cols-4">
          {/* Temperature */}
          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-emerald-950/50">
            <span className="block text-[10px] text-slate-400 dark:text-emerald-400">دمای هوا</span>
            <span className="text-xs font-bold text-slate-700 dark:text-white">
              {data.temp} ({data.condition})
            </span>
          </div>

          {/* Wind */}
          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-emerald-950/50">
            <span className="block text-[10px] text-slate-400 dark:text-emerald-400">سرعت باد</span>
            <span className="text-xs font-bold text-slate-700 dark:text-white">{data.wind}</span>
          </div>

          {/* Humidity */}
          <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-emerald-950/50">
            <span className="block text-[10px] text-slate-400 dark:text-emerald-400">رطوبت نسبی</span>
            <span className="text-xs font-bold text-slate-700 dark:text-white">{data.humidity}</span>
          </div>

          {/* Advisory */}
          <div
            className={`col-span-2 flex items-center gap-2 rounded-xl p-2.5 sm:col-span-1 ${
              data.canSpray
                ? "bg-emerald-50/80 text-[#0F8A5F] dark:bg-emerald-900/30 dark:text-lime-300"
                : "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
            }`}
          >
            <AlertTriangle size={15} className="shrink-0" />
            <span className="text-[11px] font-semibold leading-tight">{data.advisory}</span>
          </div>
        </div>
      </div>
    </section>
  );
}