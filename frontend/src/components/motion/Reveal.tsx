// frontend/src/components/motion/Reveal.tsx

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Scroll-triggered entrance for home-page sections.
 *
 * Purpose (Emil gate, step 2): preventing a jarring change — a section that
 * teleports into the viewport as the page scrolls reads as broken. The
 * motion bridges that change; it is not decoration, and it is the only
 * scroll-linked motion on the page (Taste: "scrolling moves nothing but the
 * dealt moment"; Impeccable: a generic fade-and-rise on every section is
 * not a motion thesis, so this one primitive carries the whole page).
 *
 * Emil ingredients: transform + opacity only (never layout properties),
 * ease-out (entering), 400ms (layout/view transition band 300–500ms — the
 * old 700ms made every section feel like it was still arriving after the
 * reader had started reading it), 16px travel (was 24px: enough to bridge,
 * not enough to feel like a separate animation fighting the scroll).
 * Reduced motion keeps the opacity bridge and drops the travel.
 *
 * Implementation notes:
 *  - One IntersectionObserver per node, disconnected on first reveal — the
 *    animation plays exactly once per visit, never in a loop.
 *  - `prefers-reduced-motion: reduce` → rendered in its final state
 *    immediately; no motion at all.
 *  - Without JS the children still render (the wrapper is a plain div and the
 *    transition classes only affect decoration).
 */
export default function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'li';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -48px 0px', threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        'transition-[transform,opacity] duration-400 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
