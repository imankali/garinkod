// frontend/src/components/home/ServiceShortcuts.tsx

import { Link } from 'react-router';
import {
  Building2,
  ClipboardList,
  Gift,
  Handshake,
  LifeBuoy,
  type LucideIcon,
  Sprout,
  Store,
} from 'lucide-react';

interface Shortcut {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
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
  // One entry for the marketplace. It used to be two cards — «بازار کشاورزان»
  // and «غرفه‌داران» — because they were two pages, and a visitor had to guess
  // which one held the thing they were looking for.
  {
    to: '/storefronts',
    label: 'غرفه‌داران',
    description: 'بازار مستقیم کشاورزان و تعاونی‌ها',
    icon: Store,
      },
  {
    to: '/services',
    label: 'خدمات کشاورزی',
    description: 'مشاوره، آبیاری، آزمون خاک',
    icon: Sprout,
      },
  {
    to: '/farmer-sell',
    label: 'فروش محصول',
    description: 'محصولتان را عرضه کنید',
    icon: Building2,
      },
  {
    to: '/orders',
    label: 'پیگیری سفارش',
    description: 'با کد سفارش',
    icon: ClipboardList,
      },
  {
    to: '/rewards',
    label: 'باشگاه مشتریان',
    description: 'کد تخفیف و کیف پول',
    icon: Gift,
      },
  {
    to: '/affiliate',
    label: 'همکاری در فروش',
    description: 'درآمد از معرفی',
    icon: Handshake,
      },
  {
    to: '/support',
    label: 'پشتیبانی',
    description: 'بازخورد و شکایت',
    icon: LifeBuoy,
      },
];

export default function ServiceShortcuts() {
  return (
    <section className="page-shell py-8 sm:py-10" aria-labelledby="services-heading">
      <h2
        id="services-heading"
        className="text-fluid-xl font-extrabold tracking-[-0.01em] text-ink-deep dark:text-white"
      >
        گرین کود چه خدماتی دارد؟
      </h2>
      <p className="mt-1 text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-200/80">
        فروشگاه فقط بخشی از پلتفرم است.
      </p>

      {/*
        Every tile used to have its own hue (lime, sky, amber, violet, rose,
        indigo, slate) in a 40px rounded square. Seven colours on seven
        identical cards is a palette with no owner: the colour marked nothing,
        and Impeccable's floor calls this shape — same-size card, icon,
        heading, text — the lazy container. One row of plain links instead:
        glyph and label on one line, description under it, separated by rules
        rather than boxed seven times, so the section reads as a list of
        services and takes a third of the height.
      */}
      <ul className="mt-4 grid gap-x-6 border-t border-emerald-100 sm:grid-cols-2 lg:grid-cols-3 dark:border-emerald-900">
        {SHORTCUTS.map(({ to, label, description, icon: Icon }) => (
          <li key={to} className="border-b border-emerald-100 dark:border-emerald-900">
            <Link
              to={to}
              className="group flex min-h-11 items-center gap-3 py-3 transition-colors duration-150 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:hover:text-lime-200"
            >
              <Icon
                size={18}
                aria-hidden="true"
                strokeWidth={1.75}
                className="shrink-0 text-emerald-700 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-x-0.5 motion-reduce:transition-none dark:text-lime-300"
              />
              <span className="min-w-0">
                <span className="block text-fluid-sm font-bold text-ink-deep dark:text-white">
                  {label}
                </span>
                <span className="block text-fluid-2xs text-slate-500 dark:text-emerald-200/80">
                  {description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}