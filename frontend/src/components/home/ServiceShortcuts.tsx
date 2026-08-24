// frontend/src/components/home/ServiceShortcuts.tsx

import { Link } from 'react-router-dom';
import {
  Building2,
  ClipboardList,
  Gift,
  Handshake,
  LifeBuoy,
  type LucideIcon,
  Sprout,
  Store,
  Tractor,
} from 'lucide-react';

interface Shortcut {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}

/**
 * Everything the platform does, other than selling from the catalogue.
 *
 * The home page previously showed only products and the dose calculator, so
 * the marketplace, the storefront directory, agronomy services, produce
 * procurement, the loyalty club, affiliate scheme, order tracking and support
 * were invisible to anyone who did not open a menu. For a platform whose
 * differentiator *is* the farmer marketplace, that is the shop window hiding
 * the merchandise.
 */
const SHORTCUTS: Shortcut[] = [
  {
    to: '/marketplace',
    label: 'بازار کشاورزان',
    description: 'خرید مستقیم از غرفه‌ها',
    icon: Tractor,
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
  },
  {
    to: '/storefronts',
    label: 'غرفه‌داران',
    description: 'کشاورزان و تعاونی‌ها',
    icon: Store,
    tone: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200',
  },
  {
    to: '/services',
    label: 'خدمات کشاورزی',
    description: 'مشاوره، آبیاری، آزمون خاک',
    icon: Sprout,
    tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200',
  },
  {
    to: '/farmer-sell',
    label: 'فروش محصول',
    description: 'محصولتان را عرضه کنید',
    icon: Building2,
    tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  },
  {
    to: '/orders',
    label: 'پیگیری سفارش',
    description: 'با کد سفارش',
    icon: ClipboardList,
    tone: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200',
  },
  {
    to: '/rewards',
    label: 'باشگاه مشتریان',
    description: 'کد تخفیف و کیف پول',
    icon: Gift,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
  },
  {
    to: '/affiliate',
    label: 'همکاری در فروش',
    description: 'درآمد از معرفی',
    icon: Handshake,
    tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200',
  },
  {
    to: '/support',
    label: 'پشتیبانی',
    description: 'بازخورد و شکایت',
    icon: LifeBuoy,
    tone: 'bg-slate-100 text-slate-700 dark:bg-emerald-900 dark:text-emerald-100',
  },
];

export default function ServiceShortcuts() {
  return (
    <section className="page-shell py-8" aria-labelledby="services-heading">
      <h2
        id="services-heading"
        className="text-fluid-xl font-extrabold text-slate-800 dark:text-white"
      >
        گرین کود چه خدماتی دارد؟
      </h2>
      <p className="mt-1 text-fluid-sm text-slate-500 dark:text-emerald-200">
        فروشگاه فقط بخشی از پلتفرم است.
      </p>

      {/*
        Two columns on the narrowest phones so labels stay readable rather than
        shrinking, widening to four on desktop.
      */}
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {SHORTCUTS.map(({ to, label, description, icon: Icon, tone }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex h-full min-h-11 flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                <Icon size={19} aria-hidden="true" />
              </span>
              <span className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                {label}
              </span>
              <span className="text-fluid-2xs text-slate-500 dark:text-emerald-300">
                {description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
