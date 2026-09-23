// frontend/src/components/motion/Reveal.tsx

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Scroll-triggered entrance for home-page sections (the Digikala pattern,
 * rebuilt as a single reusable primitive).
 *
 * The element starts 24px lower at opacity 0 and settles into place once it
 * enters the viewport. Implementation notes:
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
        'transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
