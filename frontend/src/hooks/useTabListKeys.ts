// frontend/src/hooks/useTabListKeys.ts
//
// Arrow-key navigation for every role="tablist" on the site.
//
// An element with `role="tab"` is a promise: the WAI-ARIA tabs pattern says
// the group is entered once with Tab and then navigated with ← → Home End,
// activating as you go. Ten tablists on this site declared the role and only
// implemented the click, so a keyboard user could still reach every tab — by
// tabbing through all of them — but a screen-reader user was told "tab, 1 of 5"
// inside a widget that ignored the keys the pattern promises.
//
// The hook is deliberately tiny and layout-agnostic: it reads the tabs from
// the DOM at key time (so conditional tabs need no bookkeeping), keeps the
// direction RTL-aware, and wraps at both ends.

import { useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';

export function useTabListKeys<T extends HTMLElement>(externalRef?: RefObject<T>) {
  const internalRef = useRef<T>(null);
  const ref = externalRef ?? internalRef;

  const onKeyDown = (event: ReactKeyboardEvent<T>) => {
    const list = ref.current;
    if (!list) return;
    const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'))
      .filter((tab) => tab.getAttribute('aria-disabled') !== 'true' && !(tab as HTMLButtonElement).disabled);
    if (tabs.length < 2) return;

    const index = tabs.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;

    // `dir` may be inherited from <html> or any ancestor; jsdom's
    // getComputedStyle does not resolve that, so read the DOM first.
    const rtl =
      list.closest('[dir]')?.getAttribute('dir')?.toLowerCase() === 'rtl' ||
      getComputedStyle(list).direction === 'rtl';
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = index + (rtl ? -1 : 1);
        break;
      case 'ArrowLeft':
        next = index + (rtl ? 1 : -1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const target = tabs[(next + tabs.length) % tabs.length];
    if (!target) return;
    target.focus();
    // Automatic activation is the pattern's recommended behaviour for cheap
    // panels (all of ours just switch a local state).
    target.click();
  };

  return { ref, onKeyDown };
}
