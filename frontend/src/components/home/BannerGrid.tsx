// frontend/src/components/home/BannerGrid.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, ChevronLeft, GraduationCap, Store, TrendingUp } from 'lucide-react';

import { agricultureApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';

/**
 * Shortcuts into the four other things this platform does, plus the seller
 * call.
 *
 * The tiles used to be four saturated gradient panels (emerald→teal,
 * lime→emerald, teal→cyan, amber→lime) carrying a white glyph each: four
 * different hues, four different moods, and no hierarchy — the reader could
 * not tell that these are secondary destinations, nor which one mattered.
 * Now they are one surface, one glyph weight, one type scale, and the tint
 * only marks the hover. The seller banner keeps the deep green because on
 * this marketplace the sellers *are* the inventory — it is the one tile that
 * earns the weight.
 */
const TILES = [
  {
    to: '/services',
    icon: GraduationCap,
    title: 'مشاوره کارشناس',
    text: 'برنامه کود و سم رایگان برای مزرعه شما',
  },
  {
    to: '/storefronts',
    icon: Store,
    title: 'بازار کشاورزان',
    text: 'خرید مستقیم از غرفه‌های تأییدشده',
  },
  {
    to: '/blog',
    icon: BookOpen,
    title: 'مجله کشاورزی',
    text: 'راهنمای فصل کشت و مدیریت آفات',
  },
  {
    to: '/rewards',
    icon: TrendingUp,
    title: 'باشگاه مشتریان',
    text: 'هر خرید، امتیاز و تخفیف بعدی',
  },
] as const;

export default function BannerGrid() {
  // A stallholder clicking «شروع غرفه‌داری» lands on a signup form they have
  // already completed — insulting, and a dead end away from their own shop.
  // The auth store carries `has_storefront`, so for them the banner becomes a
  // shortcut into their own stall instead of a second acquisition pitch. The
  // actual stall address comes from the same source پروفایل uses: the account
  // requests its own storefront and we keep the slug here once it arrives
  // (anonymous visitors never fire the request, so the banner stays CTA).
  const hasStorefront = useAuthStore((state) => Boolean(state.account?.has_storefront));
  const [myStallSlug, setMyStallSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!hasStorefront) return;
    agricultureApi
      .getStorefront()
      .then((response) => setMyStallSlug(response.data?.slug ?? null))
      .catch(() => setMyStallSlug(null));
  }, [hasStorefront]);

  const bannerTo = hasStorefront && myStallSlug ? `/storefronts/${myStallSlug}` : hasStorefront ? '/profile' : '/farmer-sell';

  return (
    <section className="page-shell py-8 sm:py-10" aria-label="میان‌برهای گرین کود">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map(({ to, icon: Icon, title, text }) => (
          <li key={title} className="min-w-0">
            <Link
              to={to}
              className="group flex h-full flex-col gap-2.5 rounded-xl border border-emerald-100/90 bg-white p-4 transition-[border-color,background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-emerald-300 hover:bg-emerald-50/50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:active:scale-100 dark:border-emerald-900 dark:bg-ink dark:hover:border-emerald-700 dark:hover:bg-emerald-900/40"
            >
              <Icon
                size={20}
                aria-hidden="true"
                strokeWidth={1.75}
                className="text-emerald-700 dark:text-lime-300"
              />
              <span className="text-fluid-sm font-extrabold text-ink-deep dark:text-white">
                {title}
              </span>
              <span className="text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-200/80">
                {text}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/*
        The seller call. One dark surface on a page of light ones, which is
        how it earns the attention the four gradient tiles used to split
        between them. The arrow (not a white pill pretending to be a button
        inside a link) says where it goes; the whole strip is the target.
      */}
      <Link
        to={bannerTo}
        aria-label={hasStorefront ? 'رفتن به غرفه من' : 'شروع ثبت‌نام غرفه‌داری'}
        className="group mt-3 flex min-h-20 flex-wrap items-center justify-between gap-4 rounded-xl bg-ink-deep px-5 py-4 text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink active:scale-[0.995] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:active:scale-100 dark:border dark:border-emerald-800"
      >
        <span className="min-w-0">
          <span className="block text-fluid-base font-extrabold">
            {hasStorefront
              ? 'غرفه شما منتظر شماست'
              : 'محصولت را مستقیم بفروش — همین امروز غرفه بزن'}
          </span>
          <span className="mt-1 block text-fluid-2xs leading-6 text-emerald-100/80">
            {hasStorefront
              ? 'آگهی‌ها، سفارش‌ها و درآمد شما یک‌جا در پیشخوان غرفه'
              : 'ثبت‌نام غرفه‌داری با تأیید مدارک، دفتر مالی شفاف و تسویه به کارت بانکی'}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-fluid-xs font-extrabold text-lime-300">
          {hasStorefront ? 'رفتن به غرفه من' : 'شروع غرفه‌داری'}
          <ChevronLeft
            size={16}
            aria-hidden="true"
            className="transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-x-0.5 motion-reduce:transition-none"
          />
        </span>
      </Link>
    </section>
  );
}