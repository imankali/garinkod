// frontend/src/components/ui/Reveal.tsx

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '../../lib/cn';

/**
 * The page's ONE entrance animation.
 *
 * Purpose (Emil, step 2): prevent a jarring change. A section that appears
 * fully formed as the page scrolls is not jarring — but every section fading
 * up on its own timer *is*: the eye keeps catching movement at the edge of
 * the viewport and re-anchoring. So this primitive is used for exactly one
 * block per page (the "dealt moment" from the taste skill), never as a
 * blanket wrapper around every section.
 *
 * Mechanics: transform + opacity only; 16px of travel; 420ms ease-out (the
 * layout band of the duration table); IntersectionObserver, disconnected on
 * first reveal so it never loops; under `prefers-reduced-motion` the child is
 * rendered in its final state with no observer at all.
 */
export default function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
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
      { rootMargin: '0px 0px -10% 0px', threshold: 0.04 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        'transition-[opacity,transform] duration-[420ms] ease-[var(--ease-out)] motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
