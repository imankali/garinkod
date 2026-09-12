import { useEffect, useRef } from 'react';
import type { ElementType, ReactNode } from 'react';

import { withGsap } from '../../utils/motion/gsap';

type Props = {
  /** The heading tag to render. Defaults to h2 to match the existing pages. */
  as?: ElementType;
  children: ReactNode;
  className?: string;
  /** 'chars' is the calmest split; 'words' is heavier and better for long lines. */
  split?: 'chars' | 'words' | 'lines';
  /** Per-character stagger in seconds. Kept small on purpose — see below. */
  stagger?: number;
  id?: string;
};

/**
 * A heading whose characters settle into place once, on load.
 *
 * SplitText works by wrapping every character in a span. That has two
 * consequences this component has to handle:
 *
 * 1. SCREEN READERS. A heading split into `<span>ن</span><span>ه</span>…` is
 *    read character by character, which is unusable. SplitText 3.13+ writes an
 *    `aria-label` on the parent and marks the spans `aria-hidden`, so the
 *    accessible name stays the whole sentence. We additionally keep the real
 *    text in the DOM and never replace it — if SplitText fails to load, the
 *    heading is simply an ordinary heading.
 *
 * 2. RTL. Persian runs right-to-left. GSAP staggers in DOM order, which for
 *    RTL means the reveal travels right-to-left. That is the correct reading
 *    direction, so nothing special is needed — but it is worth stating, because
 *    the obvious "fix" of reversing the stagger would make it wrong.
 *
 * The stagger is 0.018s per character, capped by the fact that a long heading
 * must not take longer to settle than the eye takes to start reading it. A
 * 40-character headline at a large stagger is still animating when the visitor
 * has finished reading, which turns a flourish into an obstacle.
 */
export default function SplitHeading({
  as: Tag = 'h2',
  children,
  className,
  split = 'chars',
  stagger = 0.018,
  id,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return withGsap(({ gsap, SplitText }) => {
      const node = ref.current;
      if (!node) return;

      const instance = new SplitText(node, {
        type: split,
        // Keeps the accessible name intact (see the note above).
        autoSplit: true,
        tag: 'span',
      });

      const targets = split === 'chars' ? instance.chars : split === 'words' ? instance.words : instance.lines;

      const tween = gsap.fromTo(
        targets,
        { yPercent: 110, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.55,
          stagger,
          ease: 'power3.out',
          // If anything interrupts the tween, land on the readable state.
          onComplete: () => gsap.set(targets, { clearProps: 'all' }),
        },
      );

      return () => {
        tween.kill();
        instance.revert();
      };
    });
  }, [split, stagger]);

  return (
    <Tag ref={ref as never} id={id} className={className}>
      {children}
    </Tag>
  );
}
