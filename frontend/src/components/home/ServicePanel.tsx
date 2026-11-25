// frontend/src/components/home/ServicePanel.tsx

import { Link } from 'react-router';
import { ArrowLeft, CalendarCheck, ClipboardList, Handshake, Headset, Sprout, Tractor, Wallet } from 'lucide-react';

import SectionHead from './SectionHead';

/**
 * What the platform does besides sell inputs.
 *
 * A definition list, not a card grid. Seven services rendered as seven
 * identical cards (icon in a tinted square, title, one grey line) is the
 * shape the craft floor calls "the lazy container": every card claims the
 * same importance and none of them is scannable. A two-column list of
 * name + one clarifying line reads in a third of the height and lets the
 * eye jump straight to the service it wants.
 */
const SERVICES = [
  { to: '/services', icon: Sprout, name: 'مشاورهٔ کود و سم', detail: 'برنامهٔ تغذیهٔ مزرعه بر اساس آزمون خاک' },
  { to: '/services', icon: Tractor, name: 'خدمات مکانیزه', detail: 'خاک‌ورزی، سم‌پاشی و برداشت با ماشین‌آلات' },
  { to: '/services', icon: CalendarCheck, name: 'آزمون خاک و آب', detail: 'نمونه‌گیری و تفسیر نتیجه با کارشناس' },
  { to: '/farmers', icon: ClipboardList, name: 'فروش محصول کشاورز', detail: 'ثبت غرفه و عرضهٔ محصول مستقیم به خریدار' },
  { to: '/track', icon: Wallet, name: 'پیگیری سفارش و پرداخت', detail: 'وضعیت ارسال و تسویه با کد سفارش' },
  { to: '/support', icon: Headset, name: 'پشتیبانی و شکایت', detail: 'ثبت شکایت از غرفه، پاسخ در صف رسیدگی' },
  { to: '/affiliate', icon: Handshake, name: 'همکاری در فروش', detail: 'معرفی کالا و دریافت سهم از فروش' },
] as const;

export default function ServicePanel() {
  return (
    <section aria-labelledby="services-title" className="section shell">
      <SectionHead
        id="services-title"
        title="خدمات گرین‌کود، فراتر از فروشگاه"
        hint="نهاده خریدن فقط بخشی از کار است؛ آزمون خاک، ماشین‌آلات و مشاوره هم از همین‌جا سفارش داده می‌شود."
        action={{ to: '/services', label: 'همهٔ خدمات' }}
      />

      <ul className="mt-4 grid gap-x-8 border-t border-line sm:grid-cols-2 dark:border-night-line">
        {SERVICES.map(({ to, icon: Icon, name, detail }) => (
          <li key={name} className="border-b border-line dark:border-night-line">
            <Link
              to={to}
              className="group flex min-h-14 items-start gap-3 py-3.5 transition-colors duration-150"
            >
              <Icon
                size={17}
                aria-hidden="true"
                strokeWidth={1.9}
                className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-300"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold text-ink transition-colors duration-150 group-hover:text-brand-800 dark:text-white dark:group-hover:text-brand-300">
                  {name}
                </span>
                <span className="mt-0.5 block text-2xs leading-6 text-ink-mute dark:text-white/50">{detail}</span>
              </span>
              <ArrowLeft
                size={14}
                aria-hidden="true"
                className="mt-1 shrink-0 text-ink-mute transition-[transform,color] duration-150 ease-[var(--ease-out)] group-hover:-translate-x-0.5 group-hover:text-brand-700 motion-reduce:transition-none dark:text-white/30"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
