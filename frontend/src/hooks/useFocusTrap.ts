// frontend/src/hooks/useFocusTrap.ts

import { useEffect, useRef } from 'react';

import { acquireScrollLock } from '../utils/scrollLock';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Options {
  /** Called when the user presses Escape. */
  onEscape?: () => void;
  /** Prevent the page behind the overlay from scrolling. */
  lockScroll?: boolean;
}

/**
 * Trap keyboard focus inside an overlay while it is open.
 *
 * An overlay without this is unusable with a keyboard: Tab walks straight out
 * of the dialog and into the page behind it, where the user cannot see what is
 * focused. This hook also restores focus to whatever opened the overlay, so
 * closing a cart drawer returns the user to the cart button rather than to the
 * top of the document.
 *
 * The scroll lock goes through a shared counter, so several overlays may be
 * open at once without the first one to close unlocking the page.
 *
 * Returns a ref to attach to the overlay's root element.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  { onEscape, lockScroll = true }: Options = {},
) {
  const containerRef = useRef<T>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return undefined;

    previouslyFocused.current = document.activeElement as HTMLElement;

    const release = lockScroll ? acquireScrollLock() : null;

    // Wait a frame so the element exists and its entrance animation has begun.
    const timer = window.setTimeout(() => {
      const first = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? containerRef.current)?.focus();
    }, 40);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && onEscape) {
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== 'Tab' || !containerRef.current) return;

      const focusables = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.offsetParent !== null);
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.clearTimeout(timer);
      release?.();
      previouslyFocused.current?.focus?.();
    };
  }, [active, onEscape, lockScroll]);

  return containerRef;
}

export default useFocusTrap;
