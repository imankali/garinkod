import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { withGsap } from '../../utils/motion/gsap';

type Props = {
  children: ReactNode;
  className?: string;
  /**
   * Travel in pixels, positive = moves down the page relative to scroll.
   * Kept deliberately small: large parallax on a content page causes motion
   * sickness and, worse, makes text unreadable while it drifts.
   */
  distance?: number;
  /** 0 = starts when the element enters, 1 = when it has fully left. */
  scrub?: number | boolean;
};

/**
 * Scroll-linked parallax for a single element.
 *
 * `scrub` is used rather than a triggered tween, which means the movement is
 * tied to the scrollbar position instead of running on a timer. That is the
 * difference between parallax that feels attached to the page and parallax
 * that feels like a separate animation fighting the scroll.
 *
 * The element is translated with `yPercent`/`y` on a `will-change: transform`
 * element, never by animating top/margin — the latter forces layout on every
 * frame and drops the page to single-digit frame rates on mid-range phones.
 */
export default function Parallax({ children, className, distance = 40, scrub = 0.6 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return withGsap(({ gsap }) => {
      const node = ref.current;
      if (!node) return;

      const tween = gsap.to(node, {
        y: distance,
        ease: 'none', // scrubbed motion must be linear — easing a scrub wobbles
        scrollTrigger: {
          trigger: node,
          start: 'top bottom',
          end: 'bottom top',
          scrub,
          // Recompute on resize; without this a rotation from portrait to
          // landscape leaves the element parked at the wrong offset.
          invalidateOnRefresh: true,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    });
  }, [distance, scrub]);

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  );
}
