// frontend/src/hooks/useDragToScroll.ts
//
// Mouse drag-to-scroll for horizontal rails — the pointer pattern the
// storefront rails (ListingRail & friends) established, extracted once every
// rail needed it: touch already pans natively, so only the mouse path is
// hijacked, and a 5px dead-zone keeps genuine clicks (افزودن به سبد, links,
// tabs) working after a grab.
//
// Three details the pattern cannot get wrong, each paid for by a real bug:
// 1. Pointer capture and grab styling wait for the first real movement —
//    capturing on pointerdown makes Chromium retarget the following click to
//    the rail and silently swallow every button inside it.
// 2. A click that follows a drag is suppressed in the capture phase, so the
//    card under the cursor never activates.
// 3. scroll-snap is disabled while dragging — snap-mandatory would yank the
//    rail back to the nearest snap point after every programmatic scrollBy.

import { useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

interface DragState {
  pointerId: number;
  startX: number;
  lastX: number;
  moved: boolean;
  active: boolean;
}

export function useDragToScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const drag = useRef<DragState | null>(null);

  const endDrag = () => {
    const state = drag.current;
    const el = ref.current;
    if (state) state.active = false;
    if (el) {
      el.style.scrollSnapType = '';
      el.style.userSelect = '';
      el.style.cursor = '';
    }
  };

  const onPointerDown = (event: ReactPointerEvent<T>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if (!ref.current) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, lastX: event.clientX, moved: false, active: true };
  };

  const onPointerMove = (event: ReactPointerEvent<T>) => {
    const state = drag.current;
    const el = ref.current;
    if (!state?.active || !el || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.lastX;
    state.lastX = event.clientX;
    if (!state.moved) {
      // Dead-zone: under ~5px the gesture is a click, not a drag.
      if (Math.abs(event.clientX - state.startX) < 5) return;
      state.moved = true;
      el.style.scrollSnapType = 'none';
      el.style.userSelect = 'none';
      el.style.cursor = 'grabbing';
      try { el.setPointerCapture(event.pointerId); } catch { /* older browsers */ }
    }
    // Pan the rail like a sheet of paper; scrollBy handles the browser's
    // RTL scrollLeft sign convention for us.
    el.scrollBy({ left: dx, behavior: 'instant' as ScrollBehavior });
  };

  const onClickCapture = (event: ReactMouseEvent) => {
    // A drag must not activate the card or button the mouse released over.
    if (drag.current?.moved) {
      event.preventDefault();
      event.stopPropagation();
      drag.current.moved = false;
    }
  };

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onPointerLeave: endDrag,
      onClickCapture,
    },
  };
}
