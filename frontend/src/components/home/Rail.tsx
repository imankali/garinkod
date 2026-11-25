// frontend/src/components/home/Rail.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../../lib/cn';

/**
 * A horizontally scrolling strip of cards with two arrows.
 *
 * Deliberate limits:
 *  - No autoplay. A rail that moves on its own takes a title out of the
 *    reading line every few seconds, and it is the single most common cause
 *    of "the page kept moving while I was reading". The taste skill asks for
 *    exactly one moving element per page — the hero earns it, this does not.
 *  - No custom tween engine. Native `scrollBy` with `behavior: 'smooth'`
 *    respects the OS motion preference, keeps momentum scrolling on touch,
 *    and is one line instead of a requestAnimationFrame loop.
 *  - Drag-to-scroll on mouse, because a desktop pointer cannot pan.
 *  - Arrows disappear at the ends rather than looping, so the rail never
 *    pretends there is more content than there is.
 */
export default function Rail({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  /** Accessible name of the scroll region. */
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    // RTL: scrollLeft runs from 0 (start) to -max in Chromium.
    const max = node.scrollWidth - node.clientWidth;
    const position = Math.abs(node.scrollLeft);
    setAtStart(position < 4);
    setAtEnd(position >= max - 4);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    update();
    node.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      node.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [update]);

  function step(direction: -1 | 1) {
    const node = ref.current;
    if (!node) return;
    const first = node.firstElementChild as HTMLElement | null;
    const width = first?.getBoundingClientRect().width ?? node.clientWidth * 0.8;
    node.scrollBy({ left: direction * -(width + 12), behavior: 'smooth' });
  }

  // Mouse drag. Touch already pans; this is only for pointer devices and it
  // never swallows a click that was not a drag.
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  return (
    <div className={cn('group/rail relative', className)}>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse') return;
          const node = ref.current;
          if (!node) return;
          drag.current = { active: true, startX: event.clientX, startLeft: node.scrollLeft, moved: false };
        }}
        onPointerMove={(event) => {
          if (!drag.current.active) return;
          const node = ref.current;
          if (!node) return;
          const delta = event.clientX - drag.current.startX;
          if (Math.abs(delta) > 4) drag.current.moved = true;
          node.scrollLeft = drag.current.startLeft + delta;
        }}
        onPointerUp={() => {
          drag.current.active = false;
        }}
        onPointerLeave={() => {
          drag.current.active = false;
        }}
        onClickCapture={(event) => {
          if (drag.current.moved) {
            event.preventDefault();
            event.stopPropagation();
            drag.current.moved = false;
          }
        }}
        className="rail focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="قبلی"
        disabled={atStart}
        className={cn(
          'absolute end-0 top-[38%] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-pill border border-line bg-paper text-ink shadow-[var(--shadow-card)] md:flex',
          'transition-[opacity,background-color] duration-150 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-0',
          'dark:border-night-line dark:bg-night-soft dark:text-white dark:hover:bg-night',
        )}
      >
        <ChevronRight size={17} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="بعدی"
        disabled={atEnd}
        className={cn(
          'absolute start-0 top-[38%] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-pill border border-line bg-paper text-ink shadow-[var(--shadow-card)] md:flex',
          'transition-[opacity,background-color] duration-150 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-0',
          'dark:border-night-line dark:bg-night-soft dark:text-white dark:hover:bg-night',
        )}
      >
        <ChevronLeft size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
