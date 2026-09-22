// frontend/src/components/home/BannerGrid.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, GraduationCap, Store, TrendingUp } from 'lucide-react';

import { agricultureApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';

/**
 * The four-column promo grid + wide campaign banner Digikala places between
 * the flash deals and the best-sellers. Each tile promotes a real destination
 * of this platform (services, storefronts, magazine, rewards) — nothing here
 * links to a page that does not exist.
 *
 * The wide banner at the bottom is the seller-acquisition call ("غرفه بزنید"),
 * mirroring Digikala's full-width campaign strip; on this marketplace the
 * sellers ARE the inventory, so it earns the prime spot.
 */
const TILES = [
  {
    to: '/services',
    icon: GraduationCap,
    title: 'مشاوره کارشناس',
    text: 'برنامه کود و سم رایگان برای مزرعه شما',
    art: 'from-emerald-600 to-teal-500',
  },
  {
    to: '/storefronts',
    icon: Store,
    title: 'بازار کشاورزان',
    text: 'خرید مستقیم از غرفه‌های تأییدشده',
    art: 'from-lime-600 to-emerald-500',
  },
  {
    to: '/blog',
    icon: BookOpen,
    title: 'مجله کشاورزی',
    text: 'راهنمای فصل کشت و مدیریت آفات',
    art: 'from-teal-600 to-cyan-500',
  },
  {
    to: '/rewards',
    icon: TrendingUp,
    title: 'باشگاه مشتریان',
    text: 'هر خرید، امتیاز و تخفیف بعدی',
    art: 'from-amber-500 to-lime-500',
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
    <section className="page-shell py-6 sm:py-8" aria-label="میان‌برهای گرین کود">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map(({ to, icon: Icon, title, text, art }, tileIndex) => (
          <Link
            key={title}
            to={to}
            style={{ transitionDelay: `${tileIndex * 60}ms` }}
            className={`group relative flex min-h-28 flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-bl ${art} p-4 text-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-emerald-600 motion-reduce:hover:translate-y-0`}
          >
            <Icon
              size={26}
              aria-hidden="true"
              className="absolute left-4 top-4 text-white/70 transition duration-300 group-hover:scale-110 group-hover:text-white motion-reduce:group-hover:scale-100"
            />
            <span className="text-fluid-sm font-extrabold">{title}</span>
            <span className="mt-1 text-fluid-2xs leading-5 text-white/85">{text}</span>
          </Link>
        ))}
      </div>

      <Link
        to={bannerTo}
        aria-label={hasStorefront ? 'رفتن به غرفه من' : 'شروع ثبت‌نام غرفه‌داری'}
        className="mt-4 flex min-h-24 flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-l from-emerald-900 via-emerald-800 to-lime-700 px-6 py-5 text-white shadow-md transition duration-300 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-emerald-600"
      >
        <span>
          <span className="block text-fluid-lg font-extrabold">
            {hasStorefront
              ? 'غرفه شما منتظر شماست — پیشخوان فروشنده'
              : 'محصولت رو مستقیم بفروش — همین امروز غرفه بزن'}
          </span>
          <span className="mt-1 block text-fluid-xs text-emerald-50">
            {hasStorefront
              ? 'آگهی‌ها، سفارش‌ها و درآمد شما یک‌جا در پیشخوان غرفه'
              : 'ثبت‌نام غرفه‌داری با تأیید مدارک، دفتر مالی شفاف و تسویه به کارت بانکی'}
          </span>
        </span>
        <span className="rounded-xl bg-white px-5 py-2.5 text-fluid-sm font-extrabold text-emerald-800 transition group-hover:bg-emerald-50">
          {hasStorefront ? 'رفتن به غرفه من' : 'شروع غرفه‌داری'}
        </span>
      </Link>
    </section>
  );
}
