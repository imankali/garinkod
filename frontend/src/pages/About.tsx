// frontend/src/pages/About.tsx
//
// The trust page a wholesale buyer looks for before a first transfer: who runs
// the place, which brands are represented, and what the platform actually is.
// Every number on this page is counted from the database by /api/site/about/,
// so nothing here is a marketing figure the deployment cannot back up.

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  BadgeCheck,
  Building2,
  Handshake,
  Leaf,
  Package,
  ShieldCheck,
  Sprout,
  Store,
  Tractor,
  Users,
} from 'lucide-react';

import NewsletterForm from '../components/NewsletterForm';
import RouteSeo from '../components/RouteSeo';
import { siteInfoApi } from '../api/services';
import { cn } from '../utils/cn';

const FALLBACK_AVATAR = '/images/hero-farm.jpg';

const MILESTONES: Array<{ year: string; title: string; text: string; icon: typeof Leaf }> = [
  {
    year: 'گام اول',
    title: 'فروشگاه تخصصی نهاده‌ها',
    text: 'کود، سم و بذر با برچسب فارسی، دوز مجاز و دوره کارتن در صفحه هر کالا.',
    icon: Package,
  },
  {
    year: 'گام دوم',
    title: 'بازار غرفه‌داران',
    text: 'کشاورز، تعاونی و تاجر غرفه می‌گیرد؛ هر آگهی پیش از انتشار بررسی می‌شود.',
    icon: Store,
  },
  {
    year: 'گام سوم',
    title: 'خدمات و مشاوره مزرعه',
    text: 'درخواست آبیاری، خاک و سمپاشی با پرونده زمین و تقویم کشت.',
    icon: Tractor,
  },
  {
    year: 'گام چهارم',
    title: 'محتوای آموزشی',
    text: 'راهنمای کشت هر گیاه کنار همان محصول؛ تا خرید بر پایه دانش باشد نه تبلیغ.',
    icon: Sprout,
  },
];

const COMMITMENTS = [
  {
    icon: ShieldCheck,
    title: 'بررسی پیش از انتشار',
    text: 'آگهی غرفه‌ها و دیدگاه‌ها پیش از نمایش توسط تیم محتوا و بازار بازبینی می‌شوند؛ دلیل رد به فروشنده نوشته می‌شود.',
  },
  {
    icon: BadgeCheck,
    title: 'قیمت و موجودی زنده',
    text: 'مبلغ، تخفیف و موجودی در لحظه ثبت سفارش روی سرور دوباره محاسبه می‌شود؛ قیمت صفحه مرجع پرداخت نیست.',
  },
  {
    icon: Handshake,
    title: 'تسویه شفاف با غرفه‌دار',
    text: 'کمیسیون هر آگهی در همان سفارش ثبت می‌شود و کارکرد غرفه‌دار از پنل خودش قابل پیگیری است.',
  },
  {
    icon: Award,
    title: 'توصیه مسئولانه',
    text: 'ماشین‌حساب دوز، هشدار کارتن و یادآوری مشورت با کارشناس محلی در کنار هر توصیه نوشته می‌شود.',
  },
];

export default function About() {
  const { data, isFetching } = useQuery({
    queryKey: ['site-about'],
    queryFn: async () => (await siteInfoApi.getAbout()).data,
    staleTime: 5 * 60 * 1000,
  });

  const stats = data?.stats;
  const statCards = [
    { label: 'کالای فعال فروشگاه', value: stats?.products, icon: Package },
    { label: 'غرفه فعال کشاورزان', value: stats?.storefronts, icon: Store },
    { label: 'آگهی منتشرشده', value: stats?.listings, icon: Building2 },
    { label: 'مقاله و راهنمای کشت', value: stats?.articles, icon: Sprout },
    { label: 'سفارش ثبت‌شده', value: stats?.orders, icon: Handshake },
    { label: 'استان تحت پوشش غرفه‌ها', value: stats?.provinces, icon: Users },
  ];

  return (
    <main className="page-shell py-8 md:py-10">
      <RouteSeo />

      <header className="overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-800 via-emerald-700 to-lime-600 p-6 text-white sm:p-9">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-fluid-2xs font-bold">
          <Leaf size={13} />
          درباره گرین کود
        </span>
        <h1 className="mt-3 text-fluid-2xl font-extrabold leading-12">
          نهاده کشاورزی را از کسی بخرید که خودش در مزرعه بوده است
        </h1>
        <p className="mt-3 max-w-3xl text-fluid-sm leading-8 text-emerald-50">
          گرین کود یک فروشگاه تخصصی و بازار کشاورزان است: فروشگاه کالاهای تخصصی با جدول ویژگی کامل، غرفه‌هایی که
          کشاورز و تعاونی خودشان محصول می‌گذارند، و دفترچه راهنمای کشت که کنار همان کالا باز می‌شود.
          هدف ما یک چیز است: خریدی که در آن کشاورز بداند دقیقاً چه می‌خرد و چرا.
        </p>
      </header>

      {/* Counters from real rows */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="آمار واقعی سایت">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={cn(
              'rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm dark:border-emerald-900 dark:bg-emerald-950',
              isFetching && 'opacity-60',
            )}
          >
            <card.icon size={18} className="mx-auto text-emerald-600 dark:text-lime-300" />
            <p className="mt-2 text-fluid-xl font-extrabold text-slate-800 dark:text-white">
              {(card.value ?? 0).toLocaleString('fa-IR')}
            </p>
            <p className="mt-1 text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-300">{card.label}</p>
          </div>
        ))}
      </section>

      {/* Team */}
      <section className="mt-9">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-fluid-xl font-extrabold text-slate-800 dark:text-white">تیم گرین کود</h2>
            <p className="mt-1 text-fluid-sm text-slate-500 dark:text-emerald-200">
              کاری که انجام می‌دهیم بین فروش، تأیید غرفه‌ها و پاسخ به سؤالات فنی تقسیم شده است.
            </p>
          </div>
          <Link to="/contact" className="hidden min-h-11 shrink-0 items-center rounded-xl border border-emerald-200 px-4 text-fluid-xs font-bold text-emerald-700 dark:border-emerald-800 dark:text-lime-300 sm:inline-flex">
            گفتگو با تیم
          </Link>
        </div>

        {data?.team.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.team.map((member) => (
              <article
                key={member.id}
                className="flex gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"
              >
                <img
                  src={member.photo_url || FALLBACK_AVATAR}
                  alt={member.name}
                  className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-1 ring-emerald-100 dark:ring-emerald-800"
                  onError={(event) => {
                    event.currentTarget.src = FALLBACK_AVATAR;
                  }}
                />
                <div className="min-w-0">
                  <h3 className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">{member.name}</h3>
                  <p className="mt-0.5 text-fluid-2xs font-bold text-emerald-700 dark:text-lime-300">{member.role}</p>
                  {member.bio && <p className="mt-2 line-clamp-3 text-fluid-xs leading-7 text-slate-500 dark:text-emerald-200">{member.bio}</p>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-emerald-200 bg-white/60 p-5 text-fluid-sm text-slate-500 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            معرفی تیم از پنل مدیریت (بخش «تیم گرین کود») تکمیل می‌شود.
          </p>
        )}
      </section>

      {/* Brands */}
      <section className="mt-9 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 dark:border-emerald-900 dark:bg-emerald-950">
        <h2 className="text-fluid-xl font-extrabold text-slate-800 dark:text-white">برندها و شرکت‌هایی که نماینده فروش آن‌ها هستیم</h2>
        <p className="mt-1 text-fluid-sm text-slate-500 dark:text-emerald-200">
          کالاها با برچسب اصلی و شماره بچ همان تولیدکننده ارسال می‌شود؛ برای اطمینان، بچ را با درج‌شده روی کارتن مقایسه کنید.
        </p>
        {data?.brands.length ? (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.brands.map((brand) => (
              <li
                key={brand.id}
                className="flex flex-col items-center gap-2 rounded-2xl bg-slate-50 p-4 text-center transition hover:bg-emerald-50 dark:bg-emerald-900/40 dark:hover:bg-emerald-900"
              >
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt={brand.name} className="h-12 w-full object-contain" loading="lazy" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-lime-300">
                    <Award size={20} />
                  </span>
                )}
                <span className="text-fluid-xs font-extrabold text-slate-700 dark:text-white">{brand.name}</span>
                {brand.since_year && (
                  <span className="text-fluid-2xs text-slate-400">از سال {brand.since_year.toLocaleString('fa-IR')}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-fluid-sm text-slate-500 dark:text-emerald-200">فهرست برندها هنوز از پنل وارد نشده است.</p>
        )}
      </section>

      {/* Story + commitments */}
      <section className="mt-9 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
          <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">چطور به اینجا رسیدیم</h2>
          <ol className="mt-4 space-y-4">
            {MILESTONES.map((step) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
                  <step.icon size={18} />
                </span>
                <span>
                  <span className="block text-fluid-2xs font-bold text-emerald-700 dark:text-lime-300">{step.year}</span>
                  <span className="block text-fluid-sm font-extrabold text-slate-800 dark:text-white">{step.title}</span>
                  <span className="mt-1 block text-fluid-xs leading-7 text-slate-500 dark:text-emerald-200">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-3xl bg-slate-50 p-5 dark:bg-emerald-900/30">
          <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">قرارداد ما با شما</h2>
          <ul className="mt-4 space-y-4">
            {COMMITMENTS.map((item) => (
              <li key={item.title} className="flex gap-3 rounded-2xl bg-white p-3.5 shadow-sm dark:bg-emerald-950">
                <item.icon size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-lime-300" />
                <span>
                  <span className="block text-fluid-sm font-extrabold text-slate-800 dark:text-white">{item.title}</span>
                  <span className="mt-1 block text-fluid-xs leading-7 text-slate-500 dark:text-emerald-200">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/products" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 text-fluid-xs font-bold text-white">
              مشاهده فروشگاه
            </Link>
            <Link to="/storefronts" className="inline-flex min-h-11 items-center rounded-xl border border-emerald-200 px-4 text-fluid-xs font-bold text-emerald-700 dark:border-emerald-800 dark:text-lime-300">
              غرفه‌داران
            </Link>
            <Link to="/guides" className="inline-flex min-h-11 items-center rounded-xl border border-emerald-200 px-4 text-fluid-xs font-bold text-emerald-700 dark:border-emerald-800 dark:text-lime-300">
              راهنمای کشت
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-9 grid gap-4 rounded-3xl border border-emerald-100 bg-white p-5 sm:grid-cols-2 sm:p-7 dark:border-emerald-900 dark:bg-emerald-950">
        <div>
          <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">هفته‌ای یک پیام، آن هم مفید</h2>
          <p className="mt-1.5 text-fluid-sm leading-8 text-slate-500 dark:text-emerald-200">
            تغییر قیمت نهاده‌ها، ورود بذر و نهاده تازه، و راهنمای کشت همان فصل. شماره یا ایمیل خود را بگذارید؛
            هر زمان خواستید با یک کلیک خارج می‌شوید.
          </p>
        </div>
        <NewsletterForm source="about-page" variant="panel" />
      </section>
    </main>
  );
}
