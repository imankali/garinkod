// frontend/src/hooks/useTabKeyboard.ts
//
// The keyboard half of `role="tab"`.
//
// The whole site uses the tabs pattern for its speakers — login method, product
// sections, catalogue source, storefront content, blog filter, land-calendar
// filter, desk channels. Every one of them announced itself to assistive
// technology as a tab list, and not one of them implemented the keyboard model
// that role promises: arrow keys move between tabs, Home/End jump to the ends,
// and only the selected tab is a Tab stop. A screen reader user was told
// "tab, 2 of 3", pressed the arrow keys, and nothing happened — the widget
// lied about how it works. axe cannot see this: `role="tab"` has no required
// children and no rule that checks for the keys.
//
// Rather than repeat twenty lines of key handling in nine files, every tab list
// now gets the same one. The list container owns the handler (key events bubble
// from the focused tab); the hook finds the tabs from the DOM, so a caller does
// not have to thread refs through its markup.
//
// RTL: ArrowLeft selects the next tab and ArrowRight the previous one, matching
// the direction of reading and the rest of this codebase's carousels.

import type { KeyboardEvent } from 'react';

/**
 * Values the hook needs to know about: the order of the tabs, which one is
 * selected, and what selecting means for this caller (a URL parameter, local
 * state, a route).
 */
export interface TabKeyboardOptions<T extends string> {
  values: readonly T[];
  current: T;
  onSelect: (value: T) => void;
}

export interface TabKeyboardResult {
  /** Spread onto the `role="tablist"` element. */
  tabListProps: {
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  };
  /**
   * Spread onto each `role="tab"` element. Keeps exactly one tab in the tab
   * order, which is what makes Tab leave the widget instead of walking it.
   */
  tabProps: (value: string) => { tabIndex: number };
}

export function useTabKeyboard<T extends string>({
  values,
  current,
  onSelect,
}: TabKeyboardOptions<T>): TabKeyboardResult {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    const tab = target?.closest<HTMLElement>('[role="tab"]');
    if (!tab) return;

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'),
    );
    const index = tabs.indexOf(tab);
    if (index === -1) return;

    let next: number | null = null;
    switch (event.key) {
      case 'ArrowLeft': // RTL: the next tab is to the left
      case 'ArrowDown':
        next = index + 1;
        break;
      case 'ArrowRight': // RTL: the previous tab is to the right
      case 'ArrowUp':
        next = index - 1;
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
    event.stopPropagation();

    const wrapped = ((next % tabs.length) + tabs.length) % tabs.length;
    const value = values[wrapped];
    if (value !== undefined) onSelect(value);

    // Focus moves with the selection, and the tab elements themselves never
    // change identity, so focusing the neighbour works before React re-renders.
    const sibling = tabs[wrapped];
    sibling?.focus();
    // A caller whose selection is derived from state that arrives later (a
    // fetched panel) still gets the selection; focus is best-effort.
    if (!sibling) {
      event.currentTarget
        .querySelectorAll<HTMLElement>('[role="tab"]')[wrapped]
        ?.focus();
    }
  };

  return {
    tabListProps: { onKeyDown: handleKeyDown },
    tabProps: (value: string) => ({ tabIndex: value === current ? 0 : -1 }),
  };
}
