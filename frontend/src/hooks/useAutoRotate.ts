// frontend/src/hooks/useAutoRotate.ts
//
// One switch for every piece of content that moves on its own.
//
// WCAG 2.2.2 (Pause, Stop, Hide) requires a mechanism to pause moving or
// auto-updating content that starts by itself and runs for more than five
// seconds. Before this hook the home page had *six* such regions at once — the
// hero slider (6s), the flash-deal rail (2s), three ranked rails sharing
// OfferRail (2s each) and the featured-storefronts rail (4s) — and the only way
// to stop any of them was to hold the pointer still over the exact rail you
// wanted quiet, which a touch user cannot do at all and which never stopped the
// other five.
//
// They also each re-read the OS reduced-motion query on mount, so a preference
// expressed through `prefers-reduced-motion` was honoured only as a snapshot:
// changing it mid-session, or stopping one rail, did nothing to the rest.
//
// This module is the single source of that decision:
//
//   - `prefers-reduced-motion: reduce` turns auto-rotation off and keeps it off
//     (the media query is live, not a snapshot).
//   - An explicit choice by the user wins over that default and persists in
//     localStorage, so stopping motion once stops it everywhere, including on
//     the next page and the next visit — a user who has been made dizzy by a
//     moving carousel should not have to fight it again on every route.
//   - Every rail and slider subscribes to the same store, so one control stops
//     all of them and the others update their labels in the same tick.
//
// The store is deliberately plain module state with `useSyncExternalStore`
// rather than Context: the consumers are scattered across the page tree (and a
// rail can be rendered inside a modal or a storefront page), so a provider
// would have to wrap the entire app to work, and a half-wired provider fails
// silently by simply never stopping anything.

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'auto-rotate-preference';

/** The user's explicit choice, or `null` while the OS default is in charge. */
let userChoice: 'on' | 'off' | null = null;
/** Live `prefers-reduced-motion` state; only consulted while userChoice is null. */
let systemReducedMotion = false;
let initialised = false;

const listeners = new Set<() => void>();

/** Cached snapshot: `useSyncExternalStore` compares by identity each render. */
let snapshot = false;

function computeSnapshot(): boolean {
  return userChoice === null ? !systemReducedMotion : userChoice === 'on';
}

function publish(): void {
  const next = computeSnapshot();
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function readStoredChoice(): 'on' | 'off' | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'on' || stored === 'off' ? stored : null;
  } catch {
    // Private mode, disabled storage, or a non-browser test environment: the
    // preference simply does not persist, which must not break the page.
    return null;
  }
}

function persistChoice(choice: 'on' | 'off'): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Same as above — a page that keeps working without storage is correct.
  }
}

let mediaQuery: MediaQueryList | null = null;
let detachMediaQuery: (() => void) | null = null;

function handleMediaChange(event: MediaQueryListEvent): void {
  systemReducedMotion = event.matches;
  publish();
}

/**
 * Attach the media-query listener once, on the first subscriber, and detach it
 * when the last one leaves. A long-lived listener on a page-level singleton is
 * the usual React leak; this keeps the module inert when nothing renders.
 *
 * The current value is re-read on every attach. Detaching while nothing is
 * subscribed means a change made in that window would otherwise be missed, and
 * the next rail to mount would inherit a stale answer — which is exactly the
 * "read the media query once at mount" bug this module replaced.
 */
function ensureMediaWatcher(): void {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  if (!mediaQuery) {
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  }
  systemReducedMotion = mediaQuery.matches;
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleMediaChange);
    detachMediaQuery = () => mediaQuery?.removeEventListener('change', handleMediaChange);
  } else if (mediaQuery.addListener) {
    // Safari < 14.
    mediaQuery.addListener(handleMediaChange);
    detachMediaQuery = () => mediaQuery?.removeListener(handleMediaChange);
  }
}

function initOnce(): void {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;
  userChoice = readStoredChoice();
  ensureMediaWatcher();
  snapshot = computeSnapshot();
}

function subscribe(listener: () => void): () => void {
  initOnce();
  // Re-read on every attach: the listener is gone between subscribers.
  ensureMediaWatcher();
  publish();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      detachMediaQuery?.();
      detachMediaQuery = null;
      mediaQuery = null;
    }
  };
}

function getSnapshot(): boolean {
  initOnce();
  return snapshot;
}

function getServerSnapshot(): boolean {
  // No window on the server; motion defaults to on until hydration reads the
  // real preference, matching what the pre-hydration HTML looks like.
  return true;
}

/** Set the shared preference. Exported for tests and for non-React callers. */
export function setAutoRotate(playing: boolean): void {
  initOnce();
  userChoice = playing ? 'on' : 'off';
  persistChoice(userChoice);
  publish();
}

/**
 * Reset the store to "no explicit choice yet".
 *
 * Only for tests: a module-level singleton otherwise leaks a preference written
 * by one test file into the next one in the same worker.
 */
export function resetAutoRotatePreference(): void {
  userChoice = null;
  // Forget the attached query as well, so the next read answers from the
  // current environment rather than from the one this module was first used in.
  detachMediaQuery?.();
  detachMediaQuery = null;
  mediaQuery = null;
  ensureMediaWatcher();
  publish();
}

export interface UseAutoRotateResult {
  /** True while autonomous motion is allowed. */
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  toggle: () => void;
  /** True when the OS asked for reduced motion and the user has not overridden it. */
  systemPreference: boolean;
}

export function useAutoRotate(): UseAutoRotateResult {
  const playing = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    playing,
    setPlaying: setAutoRotate,
    toggle: () => setAutoRotate(!getSnapshot()),
    systemPreference: systemReducedMotion,
  };
}
