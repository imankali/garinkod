// frontend/src/components/home/Hero.tsx

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Leaf, ShieldCheck, Truck } from 'lucide-react';

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
              { icon: Truck, term: 'ارسال رایگان', detail: 'خرید بالای ۳ میلیون' },
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
