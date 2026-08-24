// frontend/src/components/home/HomeHero.tsx

import { Link } from 'react-router-dom';
import { ArrowLeft, PackageCheck, ShieldCheck, Truck } from 'lucide-react';

import { useTranslation } from '../../i18n';

/**
 * The opening statement of the shop window.
 *
 * Before this existed the page began with a weather widget — useful, but it
 * never told a first-time visitor what the site sells or why to trust it. A
 * storefront's first screen has to answer "what is this?" and "where do I
 * start?" before anything else.
 *
 * Two calls to action, not five: the catalogue for buyers and the marketplace
 * for people who came for direct-from-farmer produce. Competing buttons dilute
 * each other.
 */
export default function HomeHero() {
  const { t } = useTranslation();

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-bl from-emerald-800 via-emerald-700 to-lime-600 text-white"
      aria-labelledby="hero-heading"
    >
      {/* Decorative only — hidden from assistive technology. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'url(/images/hero-farm.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      <div className="page-shell relative py-10 sm:py-14">
        <p className="text-fluid-sm font-bold text-lime-200">
          نهاده‌های کشاورزی، مستقیم و مطمئن
        </p>

        <h2
          id="hero-heading"
          className="mt-2 max-w-3xl text-fluid-3xl font-extrabold leading-tight"
        >
          {t('home.heroTitle')}
        </h2>

        <p className="mt-4 max-w-2xl text-fluid-base leading-8 text-emerald-50">
          {t('home.heroSubtitle')}
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/products"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-6 text-fluid-sm font-extrabold text-emerald-800 shadow-lg transition hover:bg-emerald-50"
          >
            {t('home.buyFromShop')}
            <ArrowLeft size={17} aria-hidden="true" />
          </Link>
          <Link
            to="/marketplace"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-white/70 px-6 text-fluid-sm font-extrabold text-white transition hover:bg-white/10"
          >
            {t('home.farmersMarket')}
            <ArrowLeft size={17} aria-hidden="true" />
          </Link>
        </div>

        {/* Trust signals: the three questions a new buyer asks silently. */}
        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, title: 'بررسی پیش از انتشار', text: 'هر آگهی غرفه تأیید می‌شود' },
            { icon: Truck, title: 'ارسال به سراسر کشور', text: 'رایگان از ۳ میلیون تومان' },
            { icon: PackageCheck, title: 'پرداخت پس از هماهنگی', text: 'تأیید موجودی پیش از پرداخت' },
          ].map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex items-start gap-2.5 rounded-2xl bg-white/10 p-3 backdrop-blur-sm"
            >
              <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-lime-200" />
              <span>
                <span className="block text-fluid-sm font-bold">{title}</span>
                <span className="block text-fluid-2xs text-emerald-50">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
