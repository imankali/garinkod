// frontend/src/components/home/HeroSlider.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { cn } from '../../utils/cn';

/**
 * The Digikala-style opening slider: full-width art slides, arrows, dots and
 * a progress line on the active dot — rebuilt for an agricultural brand.
 *
 * Behaviours, each one deliberate:
 *  - Autoplay every 6s; PAUSED while the pointer is over the slider or the
 *    tab focus sits inside it, because a moving target you are reading is
 *    hostile. `prefers-reduced-motion` disables autoplay entirely.
 *  - Touch swipe (RTL-aware: swiping right goes to the previous slide).
 *  - Keyboard: ArrowRight/ArrowLeft move between slides.
 *  - The heading keeps id="hero-heading" — e2e assertions target it — and the
 *    slide text stays in the DOM as real elements.
 */

interface Slide {
  art: string;
  kicker: string;
  title: string;
  body: string;
  cta: { to: string; label: string };
}

const SLIDE_DWELL_MS = 6000;

export default function HeroSlider() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const slides: Slide[] = [
    {
      art: 'bg-gradient-to-bl from-emerald-800 via-emerald-700 to-lime-600',
      kicker: 'نهاده‌های کشاورزی، مستقیم و مطمئن',
      title: t('home.heroTitle'),
      body: 'خرید کود، سم، بذر و تجهیزات از غرفه‌های معتبر با تأیید پیش از انتشار و پشتیبانی کارشناس.',
      cta: { to: '/products', label: t('home.buyFromShop') },
    },
    {
      art: 'bg-gradient-to-bl from-teal-800 via-teal-700 to-emerald-500',
      kicker: 'بازار کشاورزان',
      title: 'محصول مستقیم از کشاورز، بدون واسطه',
      body: 'از غرفه‌های تأییدشده خرید کنید؛ موجودی تأیید می‌شود و پرداخت پس از هماهنگی انجام می‌گیرد.',
      cta: { to: '/storefronts', label: t('home.farmersMarket') },
    },
    {
      art: 'bg-gradient-to-bl from-lime-700 via-lime-600 to-amber-400',
      kicker: 'فروش فصلی',
      title: 'تخفیف‌های فصل کشت، همین هفته',
      body: 'کود و سم با تخفیف واقعی تا پایان بازه کمپین؛ قیمت‌ها پیش از تخفیف هم نشان داده می‌شود.',
      cta: { to: '/products?collection=discounted', label: 'دیدن تخفیف‌ها' },
    },
  ];

  const go = useCallback((next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const timer = window.setTimeout(() => go(index + 1), SLIDE_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, reduceMotion, go]);

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) > 40) {
      // RTL: swiping the content to the right (positive delta) reveals the
      // previous slide.
      go(index + (delta > 0 ? -1 : 1));
    }
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl text-white"
      aria-roledescription="carousel"
      aria-label="معرفی گرین کود"
      dir="rtl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') go(index - 1);
        if (event.key === 'ArrowLeft') go(index + 1);
      }}
    >
      <div className="relative h-[320px] sm:h-[380px] lg:h-[420px]">
        {slides.map((slide, slideIndex) => (
          <div
            key={slide.title}
            aria-hidden={slideIndex !== index}
            className={cn(
              'absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none',
              slide.art,
              slideIndex === index ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            <div className="page-shell flex h-full flex-col justify-center gap-3 px-6 sm:px-10">
              <p className="text-fluid-sm font-bold text-lime-200">{slide.kicker}</p>
              <h2
                id={slideIndex === 0 ? 'hero-heading' : undefined}
                className="max-w-3xl text-fluid-3xl font-extrabold leading-tight"
              >
                {slide.title}
              </h2>
              <p className="max-w-2xl text-fluid-base leading-8 text-emerald-50">{slide.body}</p>
              <div className="mt-3">
                <Link
                  to={slide.cta.to}
                  tabIndex={slideIndex === index ? 0 : -1}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-6 text-fluid-sm font-extrabold text-emerald-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:hover:translate-y-0"
                >
                  {slide.cta.label}
                  <ChevronLeft size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Arrows — only from sm upward, where hovering makes sense. */}
      <button
        type="button"
        aria-label="اسلاید قبلی"
        onClick={() => go(index - 1)}
        className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/35 focus-visible:outline-2 focus-visible:outline-white sm:flex"
      >
        <ChevronRight size={22} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="اسلاید بعدی"
        onClick={() => go(index + 1)}
        className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/35 focus-visible:outline-2 focus-visible:outline-white sm:flex"
      >
        <ChevronLeft size={22} aria-hidden="true" />
      </button>

      {/* Dots: the active dot is a progress pill. */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2" role="tablist" aria-label="انتخاب اسلاید">
        {slides.map((slide, dotIndex) => (
          <button
            key={slide.title}
            type="button"
            role="tab"
            aria-selected={dotIndex === index}
            aria-label={`اسلاید ${dotIndex + 1}`}
            onClick={() => go(dotIndex)}
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              dotIndex === index ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/80',
            )}
          />
        ))}
      </div>
    </section>
  );
}
