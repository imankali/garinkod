// frontend/src/hooks/useDragToScroll.ts
//
// Mouse drag-to-scroll for horizontal rails — the pointer pattern the
// storefront rails (ListingRail & friends) established, extracted once every
// rail needed it: touch already pans natively, so only the mouse path is
// hijacked, and a 5px dead-zone keeps genuine clicks (افزودن به سبد, links,
// tabs) working after a grab.
//
// Details the pattern cannot get wrong, each paid for by a real bug:
// 1. Pointer capture and grab styling wait for the first real movement —
//    capturing on pointerdown makes Chromium retarget the following click to
//    the rail and silently swallow every button inside it.
// 2. A click that follows a drag is suppressed in the capture phase, so the
//    card under the cursor never activates.
// 3. scroll-snap is disabled while dragging — snap-mandatory would yank the
//    rail back to the nearest snap point after every programmatic scrollBy.
// 4. The content follows the pointer like paper: drag right and the cards
//    move right. The first implementation scrolled with `+dx`, which felt
//    inverted to everyone who tried it, so the sign is fixed here once.
// 5. Releasing a flick glides to a stop (momentum) instead of freezing.
// 6. The rail marks its own overflow (`data-overflow`, `data-edge-*`) so CSS
//    can fade the cut-off edge and show the grab cursor only when there is
//    something left to drag.

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type {
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

interface DragState {
  pointerId: number;
  startX: number;
  lastX: number;
  lastAt: number;
  /** Scroll velocity in px/ms, already in scrollLeft units (grab direction). */
  velocity: number;
  moved: boolean;
  active: boolean;
}

/** Movement below this is a click with a shaky hand, not a drag. */
const DEAD_ZONE = 5;
/** Frame-to-frame decay of a released flick (~60fps). */
const FRICTION = 0.93;
/** Flicks slower than this stop immediately (px/ms). */
const MIN_VELOCITY = 0.02;
/** A flick faster than this is clamped — prevents a whole-rail jump. */
const MAX_VELOCITY = 3;

interface DragToScrollOptions {
  /** Make the rail itself a tab stop (default true). A rail that already
   *  contains a managed composite widget — the tablist of message channels —
   *  turns this off so the ARIA pattern keeps its own focus order. */
  focusable?: boolean;
}

export function useDragToScroll<T extends HTMLElement>(
  /** A rail that already owns its ref (for autoplay tweens) can hand it over
   *  instead of threading a second ref through every scroll calculation. */
  externalRef?: RefObject<T>,
  options: DragToScrollOptions = {},
) {
  const focusable = options.focusable !== false;
  const internalRef = useRef<T>(null);
  const ref = externalRef ?? internalRef;
  const drag = useRef<DragState | null>(null);
  const glideFrame = useRef<number | null>(null);
  const clearMovedTimer = useRef<number | null>(null);

  const stopGlide = () => {
    if (glideFrame.current !== null) {
      cancelAnimationFrame(glideFrame.current);
      glideFrame.current = null;
    }
  };

  const resetGestureStyles = (el: HTMLElement, keepSnap = false) => {
    if (!keepSnap) el.style.scrollSnapType = '';
    el.style.userSelect = '';
    el.style.cursor = '';
  };

  /** Momentum after a flick: keep moving with friction until the rail stops
   *  or hits an edge, then hand snap back. */
  const glide = (el: HTMLElement, initialVelocity: number) => {
    stopGlide();
    let velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, initialVelocity));
    // The first frame borrows a nominal 60fps slice: rAF timestamps and
    // performance.now() can share neither origin nor resolution.
    let last: number | null = null;

    const step = (now: number) => {
      glideFrame.current = null;
      const dt = last === null ? 16.667 : Math.max(0, Math.min(now - last, 48));
      last = now;
      const before = el.scrollLeft;
      el.scrollBy({ left: velocity * dt, behavior: 'instant' as ScrollBehavior });
      velocity *= Math.pow(FRICTION, dt / 16.667);
      const hitEdge = el.scrollLeft === before;
      if (hitEdge || Math.abs(velocity) < MIN_VELOCITY) {
        resetGestureStyles(el);
        return;
      }
      glideFrame.current = requestAnimationFrame(step);
    };

    glideFrame.current = requestAnimationFrame(step);
  };

  const endDrag = (el: HTMLElement | null, momentum: boolean) => {
    const state = drag.current;
    const wasDrag = Boolean(state?.moved);
    const velocity = state?.velocity ?? 0;
    if (state) state.active = false;

    const target = el ?? ref.current;
    if (target) {
      // Cursor/user-select go immediately; snap waits for the glide to settle.
      target.style.userSelect = '';
      target.style.cursor = '';
      if (!wasDrag) {
        target.style.scrollSnapType = '';
      } else if (momentum && Math.abs(velocity) >= MIN_VELOCITY) {
        glide(target, velocity);
      } else {
        target.style.scrollSnapType = '';
      }
    }

    // `moved` has to survive until the click that follows pointerup has been
    // swallowed — but not a session: a keyboard Enter or a click far later
    // must not be eaten by an old drag.
    if (wasDrag) {
      if (clearMovedTimer.current !== null) window.clearTimeout(clearMovedTimer.current);
      clearMovedTimer.current = window.setTimeout(() => {
        if (drag.current && !drag.current.active) drag.current.moved = false;
      }, 250);
    } else {
      drag.current = null;
    }
  };

  const onPointerDown = (event: ReactPointerEvent<T>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    // A running glide must stop the moment the visitor grabs the rail again.
    stopGlide();
    el.style.scrollSnapType = '';
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      lastAt: event.timeStamp || performance.now(),
      velocity: 0,
      moved: false,
      active: true,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<T>) => {
    const state = drag.current;
    const el = ref.current;
    if (!state?.active || !el || event.pointerId !== state.pointerId) return;

    const dx = event.clientX - state.lastX;
    state.lastX = event.clientX;
    const now = event.timeStamp || performance.now();
    const dt = Math.max(now - state.lastAt, 1);
    state.lastAt = now;

    if (!state.moved) {
      // Dead-zone: under ~5px the gesture is a click, not a drag.
      if (Math.abs(event.clientX - state.startX) < DEAD_ZONE) return;
      state.moved = true;
      el.style.scrollSnapType = 'none';
      el.style.userSelect = 'none';
      el.style.cursor = 'grabbing';
      try { el.setPointerCapture(event.pointerId); } catch { /* older browsers */ }
    }

    // Grab-the-paper: the content follows the pointer, so a rightward drag
    // scrolls the rail toward its start (scrollLeft decreases).
    el.scrollBy({ left: -dx, behavior: 'instant' as ScrollBehavior });

    // Smoothed velocity for the throw after release.
    const instant = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, -dx / dt));
    state.velocity = state.velocity * 0.6 + instant * 0.4;
  };

  const onPointerUp = (event: ReactPointerEvent<T>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointerId) return;
    endDrag(ref.current, true);
  };

  const onPointerCancel = (event: ReactPointerEvent<T>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointerId) return;
    endDrag(ref.current, false);
  };

  const onLostPointerCapture = () => {
    // Browsers drop capture when the window loses focus (alt-tab mid-drag);
    // the gesture is over even though pointerup may never arrive.
    if (drag.current?.active) endDrag(ref.current, false);
  };

  /** Keyboard alternative to dragging (WCAG 2.2 SC 2.5.7): a rail that can be
   *  dragged with a mouse must be scrollable from the keyboard too. Only acts
   *  when the rail itself has focus, so tab strips and chip rows inside keep
   *  their own arrow-key behaviour. */
  const onKeyDown = (event: ReactKeyboardEvent<T>) => {
    const el = ref.current;
    if (!el || event.target !== el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    const page = Math.max(el.clientWidth * 0.8, 120);
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        // Follow the physical arrow: ArrowRight moves the viewport right,
        // which in RTL means scrolling toward the start of the content.
        const forward = event.key === 'ArrowRight';
        const delta = (rtl ? !forward : forward) ? page : -page;
        el.scrollBy({ left: delta, behavior });
        break;
      }
      case 'Home':
        el.scrollTo({ left: 0, behavior });
        break;
      case 'End':
        el.scrollTo({ left: rtl ? -max : max, behavior });
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onClickCapture = (event: ReactMouseEvent) => {
    // A drag must not activate the card or button the mouse released over.
    if (drag.current?.moved) {
      event.preventDefault();
      event.stopPropagation();
      drag.current.moved = false;
    }
  };

  const onNativeDragStart = (event: ReactDragEvent<T>) => {
    // Links and images start an HTML5 drag on their own, which cancels the
    // pointermove stream mid-gesture — the rail would freeze after ~10px.
    // Cancelling the native drag keeps the pan running over the cards too.
    event.preventDefault();
  };

  // Overflow markers: `data-overflow` gates the grab cursor, and the edge
  // flags drive the CSS fades that reveal there is more content.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.dataset.dragScroll = '';

    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const overflow = max > 4;
      el.dataset.overflow = overflow ? '1' : '0';
      if (!overflow) {
        el.dataset.edgeLeft = '0';
        el.dataset.edgeRight = '0';
        return;
      }
      const rtl = getComputedStyle(el).direction === 'rtl';
      const position = el.scrollLeft;
      const atInlineStart = rtl ? position >= -2 : position <= 2;
      const atInlineEnd = rtl ? position <= -max + 2 : position >= max - 2;
      // CSS fades are physical sides; map the inline edges onto them.
      el.dataset.edgeLeft = (rtl ? !atInlineEnd : !atInlineStart) ? '1' : '0';
      el.dataset.edgeRight = (rtl ? !atInlineStart : !atInlineEnd) ? '1' : '0';
    };

    update();
    const onScroll = () => update();
    el.addEventListener('scroll', onScroll, { passive: true });
    // Late-arriving images or cards change scrollWidth without resizing the
    // container, so watch loads and child additions too.
    el.addEventListener('load', update, true);
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    const mutations =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(update)
        : null;
    mutations?.observe(el, { childList: true });
    window.addEventListener('resize', update);
    const settle = window.setTimeout(update, 400);

    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('load', update, true);
      observer?.disconnect();
      mutations?.disconnect();
      window.removeEventListener('resize', update);
      window.clearTimeout(settle);
      if (glideFrame.current !== null) cancelAnimationFrame(glideFrame.current);
      if (clearMovedTimer.current !== null) window.clearTimeout(clearMovedTimer.current);
    };
    // `ref` is a stable ref object (the rail's own, when one is supplied).
  }, [ref]);

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
      onClickCapture,
      onKeyDown,
      onDragStart: onNativeDragStart,
      // A scrollable region must be reachable without a pointer, otherwise
      // the drag becomes the only way to see the cut-off end of the rail.
      tabIndex: focusable ? 0 : undefined,
    },
  };
}
