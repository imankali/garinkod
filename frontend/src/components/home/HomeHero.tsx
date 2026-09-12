// frontend/src/components/home/HomeHero.tsx

import { Link } from 'react-router';
import { ArrowLeft, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

import { useTranslation } from '../../i18n';
import Parallax from '../motion/Parallax';
import SplitHeading from '../motion/SplitHeading';

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
 *
 * Decorative backdrop: a real <picture> element serves AVIF → WebP → JPEG via
 * responsive srcset (480/768/1024px). Explicit width/height plus the parent
 * section's fixed gradient keep CLS at zero. The image is the LCP candidate,
 * so it is loaded EAGERLY with fetchPriority="high" — loading="lazy" on a
 * hero would delay the largest paint and is intentionally not used here
 * (lazy loading is for below-the-fold imagery).
 */
export default function HomeHero() {
  const reduceMotion = useReducedMotion();
  const { t } = useTranslation();

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-bl from-emerald-800 via-emerald-700 to-lime-600 text-white"
      aria-labelledby="hero-heading"
    >
      {/*
        Decorative only — hidden from assistive technology. The backdrop is the
        one place parallax earns its keep: a 40px drift on a 20%-opacity image
        gives the hero depth without moving a single letter of text. Content is
        never parallaxed, because drifting text is unreadable while it moves.
      */}
      <Parallax
        distance={40}
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
      <picture aria-hidden="true" className="h-full w-full">
        <source
          type="image/avif"
          srcSet="/images/hero-farm-480.avif 480w, /images/hero-farm-768.avif 768w, /images/hero-farm-1024.avif 1024w"
          sizes="100vw"
        />
        <source
          type="image/webp"
          srcSet="/images/hero-farm-480.webp 480w, /images/hero-farm-768.webp 768w, /images/hero-farm-1024.webp 1024w"
          sizes="100vw"
        />
        <img
          src="/images/hero-farm.jpg"
          alt=""
          width={1024}
          height={1024}
          decoding="async"
              fetchPriority="high"
              loading="eager"
              className="h-full w-full object-cover opacity-20"
            />
          </picture>
        </Parallax>

      <div className="page-shell relative py-10 sm:py-14">
        <p className="text-fluid-sm font-bold text-lime-200">
          نهاده‌های کشاورزی، مستقیم و مطمئن
        </p>

        {/*
          SplitText reveal on the headline. The component renders a real <h2>
          with the full sentence in the DOM, so if GSAP never loads — or the
          visitor asked for reduced motion — this is an ordinary heading. The
          id is preserved for the e2e assertions that target #hero-heading.
        */}
        <SplitHeading
          as="h2"
          id="hero-heading"
          className="mt-2 max-w-3xl text-fluid-3xl font-extrabold leading-tight"
        >
          {t('home.heroTitle')}
        </SplitHeading>

        <p className="mt-4 max-w-2xl text-fluid-base leading-8 text-emerald-50">
          {t('home.heroSubtitle')}
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <motion.div whileHover={reduceMotion ? undefined : { y: -4 }} whileTap={reduceMotion ? undefined : { scale: 0.97 }}>
          <Link
            to="/products"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-6 text-fluid-sm font-extrabold text-emerald-800 shadow-lg transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white "
          >
            {t('home.buyFromShop')}
            <ArrowLeft size={17} aria-hidden="true" />
          </Link>
          </motion.div>
          <motion.div whileHover={reduceMotion ? undefined : { y: -4 }} whileTap={reduceMotion ? undefined : { scale: 0.97 }}>
          <Link
            to="/storefronts"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-white/70 px-6 text-fluid-sm font-extrabold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white "
          >
            {t('home.farmersMarket')}
            <ArrowLeft size={17} aria-hidden="true" />
          </Link>
          </motion.div>
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
