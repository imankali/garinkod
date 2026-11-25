// frontend/src/components/home/Hero.tsx

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ArrowLeft, ChevronLeft, ChevronRight, Leaf, ShieldCheck, Truck } from 'lucide-react';

import { heroSlidesApi } from '../../api/services';
import type { HeroSlideData } from '../../api/services';
import { cn } from '../../lib/cn';

/**
 * The opening band. This is the page's one authored moment — the "dealt"
 * block the taste skill asks for, and the only entrance animation on the
 * route.
 *
 * Design decisions:
 *  - Type on cream, photograph beside it. White text over a photograph is a
 *    contrast gamble: it depends on whichever crop the CMS returns. Here the
 *    headline sits on the page's own surface at 12:1 and the photograph is
 *    allowed to be a photograph.
 *  - One statement. No kicker above it (craft floor bans the eyebrow), no
 *    slogan under it repeating the same words. The sub-line answers "what can
 *    I actually do here".
 *  - Two doors, side by side, because a first-time visitor is choosing
 *    between exactly two intentions: buy inputs, or buy from a farmer.
 *  - Three facts, not five, and every one of them is checkable — free
 *    shipping over a stated amount, review before publishing, expert advice.
 *
 * Motion: the copy and the photograph arrive together over 520ms with a 12px
 * rise and no bounce, and then nothing on this route moves again except the
 * state changes the visitor causes. Under `prefers-reduced-motion` it renders
 * in place.
 */
export default function Hero() {
  const [entered, setEntered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  /**
   * The operator's campaign slides.
   *
   * The model behind this has one stated purpose: «so a manager can launch a
   * seasonal campaign without a deploy», and the endpoint that serves it is
   * public, throttled for the home page and documented. Nothing consumed it —
   * the band below is a fixed design that never changes with the season, so
   * every campaign a manager scheduled went out to no one.
   *
   * The designed band is not replaced by a CMS carousel, though. It is the
   * page's one authored moment and it states facts a slide cannot be trusted
   * to (where the two doors go, what is checked before publishing). So: when
   * the operator has published slides, they sit above it as a dated campaign
   * line; when they have published none — the current state — the page looks
   * exactly as before.
   */
  const slides = useQuery({
    queryKey: ['hero-slides'],
    queryFn: async () => (await heroSlidesApi.list()).data,
    staleTime: 5 * 60 * 1000,
  });

  const campaigns: HeroSlideData[] = slides.data ?? [];
  const active = campaigns.length > 0 ? campaigns[Math.min(index, campaigns.length - 1)] : null;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setEntered(true);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <section
      ref={rootRef}
      aria-labelledby="hero-title"
      className="shell relative overflow-hidden pt-8 pb-10 sm:pt-12 lg:pt-16 lg:pb-16"
    >
      {active && (
        <div
          role="region"
          aria-label="پیشنهادهای این فصل"
          className={cn(
            'mb-8 overflow-hidden rounded-lg border border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-night-soft',
            active.background_url && 'bg-none',
          )}
        >
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5">
            {active.background_url && (
              <img
                src={active.background_url}
                alt=""
                width={160}
                height={96}
                loading="lazy"
                className="h-24 w-full rounded-sm object-cover sm:h-20 sm:w-40"
              />
            )}
            <div className="min-w-0 flex-1">
              {active.kicker && (
                <p className="text-2xs font-bold text-brand-800 dark:text-brand-300">{active.kicker}</p>
              )}
              <p className="mt-0.5 text-sm font-extrabold text-ink dark:text-white">{active.title}</p>
              {active.body && (
                <p className="mt-1 text-2xs leading-6 text-ink-soft dark:text-white/65">{active.body}</p>
              )}
            </div>

            {active.cta_label && active.cta_url && (
              // Internal paths only: a slide is operator content, and sending a
              // visitor to an arbitrary absolute URL from the home page is how
              // a campaign becomes a phishing link the day an account leaks.
              active.cta_url.startsWith('/') ? (
                <Link
                  to={active.cta_url}
                  className="inline-flex min-h-10 shrink-0 items-center rounded-md bg-brand-700 px-4 text-2xs font-extrabold text-white hover:bg-brand-800"
                >
                  {active.cta_label}
                </Link>
              ) : (
                <a
                  href={active.cta_url}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="inline-flex min-h-10 shrink-0 items-center rounded-md bg-brand-700 px-4 text-2xs font-extrabold text-white hover:bg-brand-800"
                >
                  {active.cta_label}
                </a>
              )
            )}

            {campaigns.length > 1 && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="پیشنهاد پیشین"
                  onClick={() => setIndex((current) => (current - 1 + campaigns.length) % campaigns.length)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-ink-mute hover:bg-brand-100 dark:text-white/50 dark:hover:bg-night"
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                <span className="dateline text-[11px] text-ink-mute dark:text-white/40">
                  {index + 1}/{campaigns.length}
                </span>
                <button
                  type="button"
                  aria-label="پیشنهاد بعدی"
                  onClick={() => setIndex((current) => (current + 1) % campaigns.length)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-ink-mute hover:bg-brand-100 dark:text-white/50 dark:hover:bg-night"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-14">
        <div
          className={cn(
            'transition-[opacity,transform] duration-[520ms] ease-[var(--ease-out)] motion-reduce:transition-none',
            entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
          )}
        >
          <h1
            id="hero-title"
            className="max-w-[18ch] text-[2rem] font-extrabold leading-[1.25] tracking-[-0.03em] text-ink sm:text-3xl dark:text-white"
          >
            نهاده‌های کشاورزی،
            <span className="mt-1 block text-brand-700 dark:text-brand-300">مستقیم سر مزرعه</span>
          </h1>

          <p className="mt-5 max-w-[46ch] text-sm leading-8 text-ink-soft sm:text-base dark:text-white/70">
            کود، سم، بذر و ادوات از فروشگاه تخصصی — یا محصول تازه، مستقیم از غرفهٔ کشاورز.
            هر آگهی پیش از انتشار بررسی می‌شود و موجودی پیش از پرداخت تأیید.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/products"
              className="inline-flex min-h-12 items-center gap-2 rounded-md bg-brand-700 px-6 text-sm font-extrabold text-white transition-[background-color,transform] duration-[var(--dur-state)] ease-[var(--ease-out)] hover:bg-brand-800 active:scale-[0.98] motion-reduce:active:scale-100"
            >
              خرید از فروشگاه
              <ArrowLeft size={17} aria-hidden="true" />
            </Link>
            <Link
              to="/storefronts"
              className="inline-flex min-h-12 items-center gap-2 rounded-md border border-brand-700/25 px-5 text-sm font-bold text-ink transition-[background-color,border-color] duration-[var(--dur-state)] ease-[var(--ease-out)] hover:border-brand-700/50 hover:bg-brand-50 dark:border-white/20 dark:text-white dark:hover:bg-night-soft"
            >
              بازار غرفه‌داران
            </Link>
          </div>

          <dl className="mt-9 flex flex-wrap gap-x-7 gap-y-3 border-t border-line pt-5 dark:border-night-line">
            {[
              // No threshold is printed here: the free-shipping amount is a
              // server setting, and this file guessed a third figure. The
              // product page states the real terms from /site/policies/.
              { icon: Truck, term: 'ارسال سراسری', detail: 'شرایط ارسال پیش از پرداخت' },
              { icon: ShieldCheck, term: 'غرفهٔ تأییدشده', detail: 'بررسی پیش از انتشار' },
              { icon: Leaf, term: 'مشاورهٔ کارشناس', detail: 'برنامهٔ کود و سم' },
            ].map(({ icon: Icon, term, detail }) => (
              <div key={term} className="flex items-start gap-2">
                <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-300" />
                <div>
                  <dt className="text-2xs font-extrabold text-ink dark:text-white">{term}</dt>
                  <dd className="text-2xs text-ink-mute dark:text-white/50">{detail}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        {/* The photograph. Eager, explicit dimensions, cropped to a band on
            phones and a tall frame beside the copy on desktop. */}
        <div
          className={cn(
            'relative overflow-hidden rounded-lg bg-brand-100 transition-[opacity,transform] duration-[520ms] ease-[var(--ease-out)] motion-reduce:transition-none',
            entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
          )}
          style={{ transitionDelay: entered ? '80ms' : '0ms' }}
        >
          <picture>
            <source type="image/avif" srcSet="/images/hero-farm-768.avif 768w, /images/hero-farm-1024.avif 1024w" sizes="(max-width: 1024px) 100vw, 46vw" />
            <source type="image/webp" srcSet="/images/hero-farm-768.webp 768w, /images/hero-farm-1024.webp 1024w" sizes="(max-width: 1024px) 100vw, 46vw" />
            <img
              src="/images/hero-farm.jpg"
              alt="مزرعهٔ سبز در نور صبح"
              width={1024}
              height={768}
              fetchPriority="high"
              decoding="async"
              className="h-[210px] w-full object-cover sm:h-[300px] lg:h-[420px]"
            />
          </picture>
        </div>
      </div>
    </section>
  );
}
