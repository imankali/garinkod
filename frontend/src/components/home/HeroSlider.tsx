// frontend/src/components/home/HeroSlider.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { cn } from '../../utils/cn';
import { heroSlidesApi, type HeroSlideData } from '../../api/services';

/**
 * The Digikala-style opening slider: full-width art slides, arrows, dots and
 * a progress line on the active dot — rebuilt for an agricultural brand.
 *
 * Slides come from the content-production console (HeroSlide rows via
 * /api/hero-slides/), so a seasonal campaign launches without a deploy; the
 * built-in set below only renders while the API has nothing (empty site,
 * fresh checkout, network hiccup) — the page must never open blank.
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
  image?: string;
  kicker: string;
  title: string;
  body: string;
  cta: { to: string; label: string };
}

const SLIDE_DWELL_MS = 6000;

/**
 * Slides from the console; while the API has nothing (fresh checkout, network
 * hiccup) the built-in set renders so the page never opens blank.
 */
function useHeroSlides(): Slide[] {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['hero-slides'],
    queryFn: async () => (await heroSlidesApi.list()).data,
    staleTime: 60 * 1000,
  });
  const fromApi: Slide[] | null = data && data.length > 0
    ? data.map((slide: HeroSlideData) => ({
        art: slide.gradient || 'bg-gradient-to-bl from-emerald-800 via-emerald-700 to-lime-600',
        image: slide.background_url || undefined,
        kicker: slide.kicker,
        title: slide.title,
        body: slide.body,
        cta: { to: slide.cta_url || '/products', label: slide.cta_label || 'مشاهده' },
      }))
    : null;
  if (fromApi) return fromApi;
  return [
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
}

export default function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const slides = useHeroSlides();

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
    >      <div className="relative h-[320px] sm:h-[380px] lg:h-[420px]">
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
            {slide.image && (
              <img
                src={slide.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading={slideIndex === 0 ? 'eager' : 'lazy'}
              />
            )}
            {/* A photo needs a scrim or the white text becomes unreadable over
                a bright field shot; over a plain gradient it is invisible. */}
            {slide.image && <div className="absolute inset-0 bg-gradient-to-l from-black/55 via-black/35 to-black/20" aria-hidden="true" />}
            {/* `.page-shell` carries a global bottom clearance for the fixed
                mobile nav; inside the slider that 84px pad squeezes the
                centered stack out of the box's top edge on phones, so it is
                explicitly zeroed here (inline, because .page-shell is unlayered
                CSS and beats utility classes). */}
            <div
              className="page-shell relative flex h-full flex-col justify-center gap-3 px-6 sm:px-10"
              style={{ paddingBottom: 0 }}
            >
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

      {/* Arrows — a small pair sitting together at the bottom-right corner,
          visible on every screen size (touch users get them too, not only
          swipe). In RTL the right-hand button is "previous", matching the
          ArrowRight keyboard behaviour. */}
      <div className="absolute bottom-3 right-4 z-10 flex items-center gap-1.5">
        <button
          type="button"
          aria-label="اسلاید قبلی"
          onClick={() => go(index - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/35 focus-visible:outline-2 focus-visible:outline-white"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="اسلاید بعدی"
          onClick={() => go(index + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/35 focus-visible:outline-2 focus-visible:outline-white"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
      </div>

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
