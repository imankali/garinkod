// frontend/src/components/home/FeaturedStorefronts.tsx
//
// «غرفه‌های منتخب» — the home page's window onto the marketplace, in the
// mydigipay «فروشگاه‌های منتخب» shape: a compact logo-tile carousel where each
// column stacks two stalls (logo tile + centered name), verified stalls carry a
// badge pinned to their logo, and the rail ends in a «بیشتر» tile that opens
// the full directory. The heading row carries the section title, a one-line
// pitch and the «همه» link on the far side — the same skeleton as the site's
// other rails, so the scroll personality (rAF tween, snap on touch, autoplay
// that pauses on hover) is shared everywhere.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, BadgeCheck, PlusCircle, Sprout } from 'lucide-react';

import { storefrontsApi } from '../../api/services';
import type { Storefront } from '@/types/storefront';

const AUTOPLAY_MS = 4000;

export default function FeaturedStorefronts() {
  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [loading, setLoading] = useState(true);

  const railRef = useRef<HTMLDivElement>(null);
  const hoverPause = useRef(false);
  const touchPause = useRef(false);
  const cancelTween = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    storefrontsApi
      .featured(12)
      .then((response) => {
        if (!cancelled) setStorefronts(response.data);
      })
      .catch(() => {
        if (!cancelled) setStorefronts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** rAF tween of the rail's own scrollLeft — identical to the other rails. */
  const animateTo = (targetLeft: number) => {
    const rail = railRef.current;
    if (!rail) return;
    cancelTween.current?.();
    const start = rail.scrollLeft;
    const delta = targetLeft - start;
    if (Math.abs(delta) < 1) return;
    rail.style.scrollSnapType = 'none';
    const duration = 450;
    const startedAt = performance.now();
    let raf = 0;
    const done = () => {
      rail.style.scrollSnapType = '';
      cancelTween.current = null;
    };
    const step = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      rail.scrollLeft = start + delta * eased;
      if (progress < 1) raf = window.requestAnimationFrame(step);
      else done();
    };
    raf = window.requestAnimationFrame(step);
    cancelTween.current = () => {
      window.cancelAnimationFrame(raf);
      done();
    };
  };

  /** One column = the scroll step (mydigipay pairs two stalls per column). */
  const columnStep = (rail: HTMLDivElement): number => {
    const first = rail.children[0] as HTMLElement | undefined;
    const width = first ? first.getBoundingClientRect().width : 0;
    return width > 0 ? width + 16 : Math.max(rail.clientWidth * 0.4, 160);
  };

  const scrollToColumn = (index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const unit = Math.max(columnStep(rail), 1);
    const at = rail.scrollLeft;
    const sign =
      at < 0 ? -1
      : at > 0 ? 1
      : getComputedStyle(rail).direction === 'rtl' ? -1 : 1;
    animateTo(sign * index * unit);
  };

  const move = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const unit = Math.max(columnStep(rail), 1);
    const travelled = Math.abs(rail.scrollLeft);
    const currentIndex = Number.isFinite(travelled / unit)
      ? Math.round(travelled / unit)
      : 0;
    const nextIndex = Math.min(
      Math.max(currentIndex + direction, 0),
      rail.children.length - 1,
    );
    scrollToColumn(nextIndex);
  };

  const inViewRef = useRef(false);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof IntersectionObserver === 'undefined') {
      inViewRef.current = true;
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { inViewRef.current = Boolean(entry?.isIntersecting); },
      { threshold: 0.35 },
    );
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);

  // Gentle autoplay, consistent with the home rails; pauses on hover/touch
  // and respects reduced-motion.
  useEffect(() => {
    if (loading || storefronts.length < 4) return;
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const timer = window.setInterval(() => {
      const rail = railRef.current;
      if (!rail || !inViewRef.current || hoverPause.current || touchPause.current) return;
      const maxScroll = rail.scrollWidth - rail.clientWidth;
      if (maxScroll <= 4) return;
      const unit = Math.max(columnStep(rail), 1);
      const travelled = Math.abs(rail.scrollLeft);
      const atEnd = travelled >= maxScroll - 4;
      const currentIndex = Number.isFinite(travelled / unit)
        ? Math.round(travelled / unit)
        : 0;
      if (atEnd) scrollToColumn(0);
      else scrollToColumn(Math.min(currentIndex + 1, rail.children.length - 1));
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [loading, storefronts.length]);

  useEffect(() => () => cancelTween.current?.(), []);

  if (loading || storefronts.length === 0) return null;

  // Pair stalls into columns of two, mydigipay-style; a leftover stall still
  // gets its own column so nothing drops silently.
  const columns: Storefront[][] = [];
  for (let i = 0; i < storefronts.length; i += 2) {
    columns.push(storefronts.slice(i, i + 2));
  }

  return (
    <section className="page-shell py-8" aria-labelledby="storefronts-heading">
      {/* Heading row: title + pitch on one side, «همه» on the far side. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="storefronts-heading"
            className="text-fluid-xl font-extrabold text-slate-800 dark:text-white"
          >
            غرفه‌های منتخب
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-fluid-sm font-semibold text-emerald-700 dark:text-lime-300">
            <Sprout size={16} aria-hidden="true" />
            مستقیم از غرفه کشاورزان — بدون واسطه، با قیمت درب مزرعه
          </p>
        </div>
        <Link
          to="/storefronts"
          className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-fluid-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-lime-300 dark:hover:bg-emerald-900"
        >
          همه
          <ArrowLeft size={14} aria-hidden="true" />
        </Link>
      </div>

      <div className="relative mt-5">
        <div
          ref={railRef}
          onPointerEnter={() => { hoverPause.current = true; }}
          onPointerLeave={() => { hoverPause.current = false; }}
          onTouchStart={() => {
            cancelTween.current?.();
            touchPause.current = true;
          }}
          onTouchEnd={() => {
            window.setTimeout(() => { touchPause.current = false; }, 2500);
          }}
          className="rail-scroll flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 touch-pan-x"
          role="region"
          aria-label="غرفه‌های منتخب، قابل پیمایش افقی"
        >
          {columns.map((column) => (
            <div key={column[0]!.id} className="flex shrink-0 snap-start flex-col gap-4">
              {column.map((storefront) => (
                <Link
                  key={storefront.id}
                  to={`/storefronts/${storefront.slug}`}
                  className="group flex w-24 flex-col items-center gap-1.5 sm:w-28"
                  aria-label={`غرفه ${storefront.name}`}
                >
                  {/* Logo tile — white elevated square, badges pinned to its
                      corner exactly like the digipay logo-wrapper. */}
                  <span className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-md dark:bg-emerald-950 dark:ring-emerald-800 sm:h-[88px] sm:w-[88px]">
                    {storefront.is_verified && (
                      <span
                        className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow ring-2 ring-white dark:ring-emerald-950"
                        title="غرفه تأییدشده"
                      >
                        <BadgeCheck size={12} aria-hidden="true" />
                      </span>
                    )}
                    <img
                      src={storefront.avatar_url || '/images/hero-farm.jpg'}
                      alt=""
                      width={60}
                      height={60}
                      loading="lazy"
                      decoding="async"
                      className="h-[60px] w-[60px] rounded-xl object-cover"
                    />
                  </span>
                  <span className="line-clamp-2 text-center text-fluid-xs font-bold leading-5 text-slate-700 group-hover:text-emerald-700 dark:text-emerald-100 dark:group-hover:text-lime-300">
                    {storefront.name}
                  </span>
                  <span className="text-center text-fluid-2xs text-slate-400 dark:text-emerald-300/70">
                    {storefront.seller_type_label}
                  </span>
                </Link>
              ))}
            </div>
          ))}

          {/* «بیشتر» tile — closes the rail like digipay's more tile. */}
          <div className="flex shrink-0 snap-start flex-col gap-4">
            <Link
              to="/storefronts"
              className="group flex w-24 flex-col items-center gap-1.5 sm:w-28"
              aria-label="مشاهده همه غرفه‌داران"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-md dark:bg-emerald-950 dark:ring-emerald-800 sm:h-[88px] sm:w-[88px]">
                <PlusCircle size={30} aria-hidden="true" className="text-emerald-600 dark:text-lime-300" />
              </span>
              <span className="text-center text-fluid-xs font-bold text-emerald-700 dark:text-lime-300">
                بیشتر
              </span>
            </Link>
          </div>
        </div>

        {/* Round edge arrows — desktop only; touch widths swipe natively. */}
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="غرفه‌های بعدی"
          className="absolute left-1 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:scale-105 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 md:flex dark:bg-emerald-950 dark:text-white dark:ring-emerald-700"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="غرفه‌های قبلی"
          className="absolute right-1 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:scale-105 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 md:flex dark:bg-emerald-950 dark:text-white dark:ring-emerald-700"
        >
          <ArrowLeft size={18} aria-hidden="true" className="rotate-180" />
        </button>
      </div>
    </section>
  );
}
