import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { withGsap } from '../../utils/motion/gsap';

type Props = {
  children: ReactNode;
  className?: string;
  /** Distance in pixels the element travels as it appears. */
  distance?: number;
  delay?: number;
  /**
   * Fire once and stop watching. Default true: a section that re-animates
   * every time the visitor scrolls back up to it stops being an entrance and
   * becomes a fidget.
   */
  once?: boolean;
};

/**
 * Fade-and-rise a block as it enters the viewport.
 *
 * The critical property: the element is visible *before* gsap loads. GSAP sets
 * the starting opacity inside the animation, so if the library never arrives —
 * slow network, blocked script, reduced motion — the content is simply already
 * there. The opposite ordering (hide with CSS, reveal with JS) is how a page
 * ends up permanently blank when one script fails, and it is the single most
 * common self-inflicted outage in animated sites.
 */
export default function Reveal({ children, className, distance = 28, delay = 0, once = true }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return withGsap(({ gsap }) => {
      const node = ref.current;
      if (!node) return;

      const tween = gsap.fromTo(
        node,
        { y: distance, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          delay,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: node,
            start: 'top 88%',
            once,
          },
        },
      );

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        // If the component unmounts mid-animation, do not leave the node at
        // opacity 0 — a later re-mount of the same DOM would be invisible.
        gsap.set(node, { clearProps: 'all' });
      };
    });
  }, [distance, delay, once]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
