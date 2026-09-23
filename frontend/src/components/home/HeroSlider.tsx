// frontend/src/components/home/HeroSlider.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { cn } from '../../utils/cn';
import { useAutoRotate } from '../../hooks/useAutoRotate';
import AutoRotateToggle from '../ui/AutoRotateToggle';
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
 *    hostile. Just as importantly it is PAUSEABLE BY THE USER: the round
 *    control in the corner stops every auto-rotating region of the site (see
 *    `useAutoRotate`), which is the mechanism WCAG 2.2.2 requires of content
 *    that starts moving on its own and runs for more than five seconds. Hover
 *    was never that mechanism — a touch user has no hover, and the other five
 *    moving regions on this page were not listening to this one anyway.
 *  - Touch swipe (RTL-aware: swiping right goes to the previous slide).
 *  - Keyboard: ArrowRight/ArrowLeft move between slides; the slide picker
 *    takes ArrowLeft/ArrowRight/Home/End of its own once focus is inside it.
 *  - The heading keeps id="hero-heading" — e2e assertions target it — and the
 *    slide text stays in the DOM as real elements.
 *  - The slides are announced while motion is stopped and silent while it is
 *    running (`aria-live` flips), so a screen reader describes a slide once the
 *    user can actually hold it still — the pattern in the ARIA APG carousel.
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
  // Transient: the pointer is over the slider, or focus is inside it. Kept
  // separate from the user's explicit choice so that leaving the slider
  // resumes motion only for someone who never asked it to stop.
  const [interactionPaused, setInteractionPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const dotsRef = useRef<HTMLDivElement>(null);

  // Shared with every rail on the page: one control stops all of them, and the
  // OS reduced-motion preference is folded in here rather than read again.
  const { playing } = useAutoRotate();

  const slides = useHeroSlides();

  const go = useCallback((next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

  /** Move to a slide index and put focus on its dot (slide-picker keyboard model). */
  const goAndFocusDot = useCallback((next: number) => {
    const target = ((next % slides.length) + slides.length) % slides.length;
    go(target);
    const dot = dotsRef.current?.querySelectorAll<HTMLButtonElement>('button')[target];
    dot?.focus();
  }, [go, slides.length]);

  useEffect(() => {
    if (!playing || interactionPaused) return;
    const timer = window.setTimeout(() => go(index + 1), SLIDE_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [index, playing, interactionPaused, go]);

  // `aria-live` follows the same switch as the timer: describing slides while
  // they are still moving would talk over the user, and describing them only
  // when rotation has stopped means the announcement lands on a slide that is
  // going to stay put. The dot group is exempted below so that its own arrow
  // keys are not also read as "next slide".
  const autoRotating = playing && !interactionPaused;

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
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocus={() => setInteractionPaused(true)}
      onBlur={() => setInteractionPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={(event) => {
        // The slide picker owns the arrow keys while focus is inside it;
        // without this the section would advance the slide *and* move the dot.
        if ((event.target as HTMLElement | null)?.closest('[data-slide-picker]')) return;
        if (event.key === 'ArrowRight') go(index - 1);
        if (event.key === 'ArrowLeft') go(index + 1);
      }}
    >      <div
        className="relative h-[320px] sm:h-[380px] lg:h-[420px]"
        aria-live={autoRotating ? 'off' : 'polite'}
        aria-atomic="false"
      >
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

      {/* Arrows — a small cluster at the bottom-right corner. The arrows are
          DESKTOP ONLY (touch widths swipe the slider natively and the arrows
          only crowded the small screen), but the pause control is NOT: it is
          the site-wide mechanism for stopping motion, so it renders on every
          width. In RTL the right-hand button is "previous", matching the
          ArrowRight keyboard behaviour. `.tap-target` gives each 32px visual
          button the 44px hit area WCAG 2.5.5 asks for. */}
      <div className="absolute bottom-3 right-4 z-10 flex items-center gap-1.5">
        <button
          type="button"
          aria-label="اسلاید قبلی"
          onClick={() => go(index - 1)}
          className="tap-target hidden h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/35 focus-visible:outline-2 focus-visible:outline-white md:flex"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="اسلاید بعدی"
          onClick={() => go(index + 1)}
          className="tap-target hidden h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/35 focus-visible:outline-2 focus-visible:outline-white md:flex"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <AutoRotateToggle />
      </div>

      {/* Slide picker.
          These are buttons in a labelled group, not a tablist: there are no
          tabpanels behind them and no roving tabindex, so `role="tab"` promised
          a keyboard model (arrow keys moving between tabs, arrow keys moving
          selection) that was never there — a screen reader said "tab, 1 of 3"
          and the arrow keys did nothing. `aria-current` states the same thing
          without the broken promise, and the group now implements the arrow /
          Home / End navigation the role used to imply. */}
      <div
        ref={dotsRef}
        data-slide-picker
        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2"
        role="group"
        aria-label="انتخاب اسلاید"
      >
        {slides.map((slide, dotIndex) => (
          <button
            key={slide.title}
            type="button"
            aria-current={dotIndex === index}
            aria-label={`اسلاید ${dotIndex + 1} از ${slides.length}`}
            tabIndex={dotIndex === index ? 0 : -1}
            onClick={() => go(dotIndex)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') { event.preventDefault(); goAndFocusDot(index + 1); }
              if (event.key === 'ArrowRight') { event.preventDefault(); goAndFocusDot(index - 1); }
              if (event.key === 'Home') { event.preventDefault(); goAndFocusDot(0); }
              if (event.key === 'End') { event.preventDefault(); goAndFocusDot(slides.length - 1); }
            }}
            className={cn(
              // `transition-all` used to animate every property on every dot on
              // every slider tick; the pill only ever changes its width and its
              // colour, so that is what it transitions.
              'tap-target h-2 rounded-full transition-[width,background-color] duration-300',
              dotIndex === index ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/80',
            )}
          />
        ))}
      </div>
    </section>
  );
}
