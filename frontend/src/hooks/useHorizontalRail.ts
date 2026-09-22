// frontend/src/hooks/useHorizontalRail.ts
//
// Shared behaviour for horizontal product/listing rails. The visual cards stay
// in their feature folders; scrolling, RTL math, autoplay and reduced-motion
// handling live here so a fix applies to every rail at once.

import { useCallback, useEffect, useRef, type RefObject } from 'react';

interface HorizontalRailOptions {
  itemCount: number;
  autoplayMs: number;
  /** Fallback visible-width ratio used before layout has measurable geometry. */
  fallbackRatio: number;
  /** Minimum fallback step in pixels for hidden/jsdom rails. */
  minimumStep: number;
}

export interface HorizontalRailControls {
  railRef: RefObject<HTMLDivElement>;
  move: (direction: -1 | 1) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
}

/**
 * Own the non-visual contract of a horizontal rail.
 *
 * The hook deliberately scrolls the rail element itself instead of calling
 * `scrollIntoView`: the latter can move the document vertically when a card is
 * near the viewport edge. Snap is suspended only during the rAF tween and is
 * restored before the next manual swipe.
 */
export function useHorizontalRail({
  itemCount,
  autoplayMs,
  fallbackRatio,
  minimumStep,
}: HorizontalRailOptions): HorizontalRailControls {
  const railRef = useRef<HTMLDivElement>(null);
  const hoverPause = useRef(false);
  const touchPause = useRef(false);
  const touchResumeTimer = useRef<number | null>(null);
  const cancelTween = useRef<(() => void) | null>(null);
  const inViewRef = useRef(false);

  const animateTo = useCallback((targetLeft: number) => {
    const rail = railRef.current;
    if (!rail) return;

    cancelTween.current?.();
    const start = rail.scrollLeft;
    const delta = targetLeft - start;
    if (Math.abs(delta) < 1) return;

    rail.style.scrollSnapType = 'none';
    const duration = 450;
    const startedAt = performance.now();
    let animationFrame = 0;
    const done = () => {
      rail.style.scrollSnapType = '';
      cancelTween.current = null;
    };
    const step = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      rail.scrollLeft = start + delta * eased;
      if (progress < 1) animationFrame = window.requestAnimationFrame(step);
      else done();
    };

    animationFrame = window.requestAnimationFrame(step);
    cancelTween.current = () => {
      window.cancelAnimationFrame(animationFrame);
      done();
    };
  }, []);

  const cardStep = useCallback((rail: HTMLDivElement): number => {
    const first = rail.children[0] as HTMLElement | undefined;
    const width = first?.getBoundingClientRect().width ?? 0;
    return width > 0 ? width + 12 : Math.max(rail.clientWidth * fallbackRatio, minimumStep);
  }, [fallbackRatio, minimumStep]);

  const scrollToCard = useCallback((index: number) => {
    const rail = railRef.current;
    if (!rail) return;

    const unit = Math.max(cardStep(rail), 1);
    const at = rail.scrollLeft;
    // Chromium reports negative scrollLeft for RTL overflow. Firefox/WebKit
    // can report a positive value, so infer the sign from the live position
    // and use computed direction only at the origin.
    const sign =
      at < 0 ? -1
      : at > 0 ? 1
      : getComputedStyle(rail).direction === 'rtl' ? -1 : 1;
    animateTo(sign * index * unit);
  }, [animateTo, cardStep]);

  const move = useCallback((direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;

    const unit = Math.max(cardStep(rail), 1);
    const travelled = Math.abs(rail.scrollLeft);
    const currentIndex = Number.isFinite(travelled / unit)
      ? Math.round(travelled / unit)
      : 0;
    const nextIndex = Math.min(
      Math.max(currentIndex + direction, 0),
      Math.max(rail.children.length - 1, 0),
    );
    scrollToCard(nextIndex);
  }, [cardStep, scrollToCard]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof IntersectionObserver === 'undefined') {
      inViewRef.current = true;
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => { inViewRef.current = Boolean(entry?.isIntersecting); },
      { threshold: 0.35 },
    );
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (itemCount < 2) return undefined;
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const timer = window.setInterval(() => {
      const rail = railRef.current;
      if (!rail || !inViewRef.current || hoverPause.current || touchPause.current) return;

      const maxScroll = rail.scrollWidth - rail.clientWidth;
      if (maxScroll <= 4) return;
      const unit = Math.max(cardStep(rail), 1);
      const travelled = Math.abs(rail.scrollLeft);
      const atEnd = travelled >= maxScroll - 4;
      const currentIndex = Number.isFinite(travelled / unit)
        ? Math.round(travelled / unit)
        : 0;

      if (atEnd) scrollToCard(0);
      else scrollToCard(Math.min(currentIndex + 1, rail.children.length - 1));
    }, autoplayMs);

    return () => window.clearInterval(timer);
  }, [autoplayMs, cardStep, itemCount, scrollToCard]);

  useEffect(() => () => {
    cancelTween.current?.();
    if (touchResumeTimer.current !== null) window.clearTimeout(touchResumeTimer.current);
  }, []);

  return {
    railRef,
    move,
    onPointerEnter: () => { hoverPause.current = true; },
    onPointerLeave: () => { hoverPause.current = false; },
    onTouchStart: () => {
      cancelTween.current?.();
      if (touchResumeTimer.current !== null) window.clearTimeout(touchResumeTimer.current);
      touchPause.current = true;
    },
    onTouchEnd: () => {
      touchResumeTimer.current = window.setTimeout(() => {
        touchPause.current = false;
        touchResumeTimer.current = null;
      }, 2500);
    },
  };
}
