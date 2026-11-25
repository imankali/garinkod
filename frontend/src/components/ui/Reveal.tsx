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
  // Content is visible by default. A section that starts at `opacity: 0` and waits
  // for an observer is a section that is blank whenever the browser has no
  // IntersectionObserver, or when the observer never fires because the element
  // arrived already in view. The hidden state is opt-in, set only once an observer
  // exists to reveal it again.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    // Start hidden, then reveal on the first intersection. `intersectionRatio`
    // is checked as well as `isIntersecting`, because a browser that computes
    // geometry late can report one without the other.
    setHidden(true);
    const show = () => setHidden(false);

    // A safety net: if the observer never reports an intersection (an element in a
    // collapsed container, a browser that hands geometry back late), the section
    // still appears. A one-off animation is not worth losing a whole block of the
    // page over.
    const fallback = window.setTimeout(show, 1200);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
          window.clearTimeout(fallback);
          show();
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.04 },
    );
    observer.observe(node);

    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        'transition-[opacity,transform] duration-[420ms] ease-[var(--ease-out)] motion-reduce:transition-none',
        hidden ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}
