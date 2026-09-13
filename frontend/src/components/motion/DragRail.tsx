import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { withGsap } from '../../utils/motion/gsap';

type Props = {
  children: ReactNode;
  className?: string;
  /** Class of the individual draggable items, used to compute the bounds. */
  itemClassName?: string;
};

/**
 * A horizontally draggable strip — the touch equivalent of a carousel that has
 * no arrows.
 *
 * Draggable gives real pointer-and-touch dragging with inertia, which a
 * CSS-only overflow scroll cannot: it keeps the momentum, it snaps, and it
 * works with a mouse, not only with a finger.
 *
 * Two rules this follows:
 *
 * 1. IT IS STILL SCROLLABLE WITHOUT JS. The wrapper keeps `overflow-x-auto`,
 *    so if Draggable never loads the strip is an ordinary scrollable row. The
 *    drag is an enhancement of a working control, not the control.
 *
 * 2. KEYBOARD AND TOUCH ARE NOT STOLEN. `allowNativeTouchScrolling` is left
 *    on for the vertical axis so the page can still be scrolled while a finger
 *    is on the strip — otherwise dragging a product rail traps the visitor and
 *    they cannot get past it, which is both an accessibility failure and the
 *    kind of thing that gets described as "the site ate my scroll".
 */
export default function DragRail({ children, className, itemClassName }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return withGsap(({ Draggable }) => {
      const track = trackRef.current;
      const list = listRef.current;
      if (!track || !list) return;

      // Clamp to the content width, so the strip cannot be flung into
      // emptiness and left there.
      const measure = () => {
        const overflow = Math.max(0, list.scrollWidth - track.clientWidth);
        return { minX: -overflow, maxX: 0 };
      };

      const instance = Draggable.create(track, {
        type: 'x',
        inertia: true,
        bounds: measure(),
        cursor: 'grab',
        activeCursor: 'grabbing',
        edgeResistance: 0.85,
      });

      // Rotating a phone or resizing the window changes the content width;
      // without this the clamp keeps the old bounds and the strip either
      // refuses to reach the last card or drifts past it.
      const onResize = () => instance.forEach((d) => d.applyBounds(measure()));
      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('resize', onResize);
        instance.forEach((d) => d.kill());
      };
    });
  }, [itemClassName]);

  return (
    <div ref={listRef} className={`overflow-x-auto ${className ?? ''}`}>
      <div ref={trackRef} className="flex w-max min-w-full gap-4 will-change-transform">
        {children}
      </div>
    </div>
  );
}
