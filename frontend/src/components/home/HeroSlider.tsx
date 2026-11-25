// frontend/src/components/home/HeroSlider.tsx

import { useTabListKeys } from '../../hooks/useTabListKeys';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { cn } from '../../utils/cn';
import { heroSlidesApi, type HeroSlideData } from '../../api/services';
import PlaybackToggle from '../ui/PlaybackToggle';

/**
 * The opening band of the home page — the one authored moment (Impeccable:
 * one focal moment per page; Taste: the hero is the dealt moment).
 *
 * It began as a Digikala-style carousel: four gradient art slides, arrows,
 * dots, an autoplaying progress line, and white text on lime. Every one of
 * those was a default rather than a decision, and together they produced the
 * page's loudest surface with its least legible type. What it is now:
 *
 *  - ONE statement. The headline says what this business is; a photo of the
 *    field sits beside it and holds still. Impeccable's craft floor bans a
 *    kicker above a heading, so the three kickers are gone; the headline
 *    carries its own weight.
 *  - Type on the page's own cream, not white on a photograph. Contrast is a
 *    property of the layout, not of whichever crop the API returned.
 *  - Two ways in, side by side, because a first-time visitor is deciding
 *    between exactly two intentions: buy inputs, or buy from a farmer.
 *  - The carousel engine is untouched: the API still supplies campaign
 *    slides, autoplay still dwells 6s, hover/focus still pause it, swipe and
 *    the arrow keys still work, and #hero-heading is still here for the e2e
 *    suite. Under reduced motion the band renders static.
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
  image?: string;
  title: string;
  body: string;
  cta: { to: string; label: string };
}

const SLIDE_DWELL_MS = 6000;

/**
 * The headline band's photograph. One image, served from /public, sized for
 * the two-column layout; the API's per-campaign `background_url` still wins
 * when a slide supplies one, so a seasonal campaign can swap the picture
 * without a deploy.
 */
const FIELD_PHOTO = '/images/hero-farm.jpg';

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
        // `kicker` and `gradient` are still produced by the console, and are
        // deliberately dropped here: the band has one headline and one
        // photograph, and a per-slide gradient wash behind type was the
        // habit this rebuild exists to remove.
        image: slide.background_url || undefined,
        title: slide.title,
        body: slide.body,
        cta: { to: slide.cta_url || '/products', label: slide.cta_label || 'مشاهده' },
      }))
    : null;
  if (fromApi) return fromApi;
  return [
    {
      title: t('home.heroTitle'),
      body: t('home.heroLead'),
      cta: { to: '/products', label: t('home.buyFromShop') },
    },
    {
      title: 'محصول مستقیم از کشاورز، بدون واسطه',
      body: 'از غرفه‌های تأییدشده خرید کنید؛ موجودی تأیید می‌شود و پرداخت پس از هماهنگی انجام می‌گیرد.',
      cta: { to: '/storefronts', label: t('home.farmersMarket') },
    },
    {
      title: 'تخفیف‌های فصل کشت، همین هفته',
      body: 'کود و سم با تخفیف واقعی تا پایان بازه کمپین؛ قیمت‌ها پیش از تخفیف هم نشان داده می‌شود.',
      cta: { to: '/products?collection=discounted', label: 'دیدن تخفیف‌ها' },
    },
  ];
}

export default function HeroSlider() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const dotTabs = useTabListKeys<HTMLDivElement>();
  const [paused, setPaused] = useState(false);
  // Distinct from `paused` (which hover/focus set temporarily): this is the
  // visitor's own decision and must survive the pointer leaving the slider.
  const [autoPlaying, setAutoPlaying] = useState(true);
  const touchStartX = useRef<number | null>(null);

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const slides = useHeroSlides();

  const go = useCallback((next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (!autoPlaying || paused || reduceMotion) return;
    const timer = window.setTimeout(() => go(index + 1), SLIDE_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, autoPlaying, reduceMotion, go]);

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
      /*
        The bottom clearance a page-shell carries is for the fixed mobile nav
        at the END of a page; inside the hero it only pushed the controls up
        against the copy, so it is zeroed here (inline: .page-shell is
        unlayered CSS and would beat a utility class).
      */
      className="page-shell pt-6"
      style={{ paddingBottom: 0 }}
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
      {/*
        Two columns, not a full-bleed picture with type on top. RTL order puts
        the words on the right (where Persian reading starts) and the field on
        the left. Below lg it stacks: type first, photograph under it, cropped
        to a band so it never pushes the CTA off a phone screen.
      */}
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">
        {/* ---------------------------- copy ---------------------------- */}
        <div className="relative min-w-0">
          {slides.map((slide, slideIndex) => (
            <div
              key={slide.title}
              data-hero-slide={slideIndex}
              aria-hidden={slideIndex !== index}
              /*
                Slides cross-fade in place. Absolute positioning keeps every
                slide the same box so the swap cannot reflow the page; opacity
                is the only property that animates (Emil: transform/opacity
                only), at 300ms ease-out — the band is an overlay-scale
                change, not a page transition, so it stays under 300ms and
                the entrance is not slower than the reader's patience.
              */
              className={cn(
                'transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                slideIndex === index ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
              )}
            >
              <h2
                id={slideIndex === 0 ? 'hero-heading' : undefined}
                className="max-w-[22ch] text-fluid-3xl font-extrabold leading-[1.25] tracking-[-0.015em] text-ink-deep dark:text-white"
              >
                {slide.title}
              </h2>
              <p className="mt-4 max-w-[46ch] text-fluid-base leading-8 text-slate-600 dark:text-emerald-100/80">
                {slide.body}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to={slide.cta.to}
                  tabIndex={slideIndex === index ? 0 : -1}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-green px-6 text-fluid-sm font-extrabold text-white shadow-sm transition-[background-color,box-shadow] duration-150 hover:bg-emerald-800 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  {slide.cta.label}
                  <ChevronLeft size={17} aria-hidden="true" />
                </Link>
                {/*
                  The second door. The first slide is the shop, so its
                  counterpart is the marketplace that makes this platform
                  different from a shop — one link away from the headline
                  rather than three screens down.
                */}
                {slideIndex === 0 && (
                  <Link
                    to="/storefronts"
                    /* aria-hidden is wrong here — this is a real destination —
                       but it must stay out of the accessible name of the
                       region's primary action, so it is simply a second link
                       with its own label. */
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-emerald-700/25 px-5 text-fluid-sm font-bold text-ink-deep transition-[background-color,border-color] duration-150 hover:border-emerald-700/50 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-emerald-200/25 dark:text-white dark:hover:bg-emerald-900/40"
                  >
                    {t('home.farmersMarket')}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* -------------------------- photograph ------------------------- */}
        {/*
          One picture, not a per-slide gradient wash. It is the page's only
          large image above the fold, so it is eager and explicit about its
          size; the art-direction crop keeps a 4:3 frame on phone and a tall
          frame beside the type on desktop. `aria-hidden` because the
          headline already says what the business is.
        */}
        <div className="relative order-first overflow-hidden rounded-2xl bg-emerald-100 lg:order-none dark:bg-emerald-950">
          <picture>
            <source type="image/avif" srcSet="/images/hero-farm-768.avif 768w, /images/hero-farm-1024.avif 1024w" sizes="(max-width: 1024px) 100vw, 46vw" />
            <source type="image/webp" srcSet="/images/hero-farm-768.webp 768w, /images/hero-farm-1024.webp 1024w" sizes="(max-width: 1024px) 100vw, 46vw" />
            <img
              src={slides[index]?.image || FIELD_PHOTO}
              alt=""
              width={1024}
              height={768}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="h-[190px] w-full object-cover object-center sm:h-[260px] lg:h-[380px]"
            />
          </picture>
        </div>
      </div>

      {/*
        Controls sit on the copy side, under the CTAs, where the slide's
        reading ends — not floating over a photograph where they competed
        with the type for the same corner. The dots keep their tablist
        contract and the arrows keep the RTL mapping the keyboard uses.
      */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <div
          className="flex items-center gap-2"
          role="tablist"
          aria-label="انتخاب اسلاید"
          ref={dotTabs.ref}
          onKeyDown={dotTabs.onKeyDown}
        >
          {slides.map((slide, dotIndex) => (
            <button
              key={slide.title}
              type="button"
              role="tab"
              aria-selected={dotIndex === index}
              aria-label={`اسلاید ${dotIndex + 1}`}
              onClick={() => go(dotIndex)}
              className="flex h-11 min-w-11 items-center justify-center"
            >
              <span
                className={cn(
                  'block h-1.5 rounded-full transition-[width,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
                  dotIndex === index
                    ? 'w-9 bg-brand-green'
                    : 'w-4 bg-emerald-700/20 hover:bg-emerald-700/40 dark:bg-white/25 dark:hover:bg-white/40',
                )}
              />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 md:flex">
            <button
              type="button"
              aria-label="اسلاید قبلی"
              onClick={() => go(index - 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-700/20 text-ink-deep transition-[background-color,border-color] duration-150 hover:border-emerald-700/45 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-white/20 dark:text-white dark:hover:bg-emerald-900/40"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="اسلاید بعدی"
              onClick={() => go(index + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-700/20 text-ink-deep transition-[background-color,border-color] duration-150 hover:border-emerald-700/45 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-white/20 dark:text-white dark:hover:bg-emerald-900/40"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
          </div>
          {/* The explicit stop for rotation, beside the controls it stops. */}
          <PlaybackToggle
            playing={autoPlaying}
            onToggle={() => setAutoPlaying((value) => !value)}
            subject="اسلایدها"
            variant="chip"
          />
        </div>
      </div>
    </section>
  );
}