/**
 * The GSAP layer — and, more importantly, the rules it lives by.
 *
 * GSAP is a DOM animation library in a React app, which is a real hazard: it
 * mutates nodes React owns, and a ScrollTrigger that outlives its component
 * leaks a listener and keeps animating a detached element. So every rule below
 * exists because of that, not because it is fashionable.
 *
 * 1. LAZY. gsap + ScrollTrigger + SplitText + Draggable is roughly 60 kB of
 *    JavaScript. None of it is needed to paint the page, so it is imported
 *    dynamically and never appears in the initial bundle. Components render
 *    their final, readable state first and animate *from* it only once the
 *    library lands. A visitor on a slow connection sees the content; they do
 *    not see a page waiting for an animation library.
 *
 * 2. ONE SCROLL CLOCK. ScrollTrigger is registered exactly once, globally.
 *    Individual components never create their own scroller; they create
 *    triggers on the shared one. Two scroll clocks drift, and drift reads as
 *    judder.
 *
 * 3. DEGRADE TO CALM, NOT TO NOTHING. `prefers-reduced-motion` disables the
 *    animation but never hides the content. The failure mode to avoid is a
 *    heading that GSAP set to opacity 0 and never revealed because the trigger
 *    never fired — so every effect here starts from a state where the content
 *    is already fully visible, and animates as a *departure* from that, or is
 *    skipped entirely.
 *
 * 4. CLEANUP IS NOT OPTIONAL. Every helper returns a teardown function that
 *    kills its ScrollTrigger and Draggable instances. React StrictMode mounts
 *    twice in development; without this you get doubled animations and leaked
 *    listeners.
 */

import type gsapCore from 'gsap';
import type ScrollTriggerPlugin from 'gsap/ScrollTrigger';
import type SplitTextPlugin from 'gsap/SplitText';
import type DraggablePlugin from 'gsap/Draggable';

/**
 * The four things every component needs, as a plain object rather than a
 * patched-up module namespace. Keeping them as named members means a component
 * destructures `{ gsap, ScrollTrigger }` and TypeScript can check it, instead
 * of us asserting that a mutated module shape is something it is not.
 */
export type GsapBundle = {
  gsap: typeof gsapCore;
  ScrollTrigger: typeof ScrollTriggerPlugin;
  SplitText: typeof SplitTextPlugin;
  Draggable: typeof DraggablePlugin;
};

let bundlePromise: Promise<GsapBundle> | null = null;

/**
 * Load and register the plugins exactly once.
 *
 * Returns a rejected promise's *caller* handles the failure — this function
 * itself never throws synchronously, so a failed network import degrades to
 * "no animation" instead of a crash.
 */
export function loadGsap(): Promise<GsapBundle> {
  if (bundlePromise) return bundlePromise;

  bundlePromise = Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
    import('gsap/SplitText'),
    import('gsap/Draggable'),
  ]).then(([gsapModule, scrollTrigger, splitText, draggable]) => {
    const gsap = gsapModule.default ?? (gsapModule as unknown as typeof import('gsap').default);

    // Registered once. gsap's own registerPlugin is idempotent, but doing it
    // here keeps the "one scroll clock" guarantee in a single readable place.
    gsap.registerPlugin(
      scrollTrigger.default ?? scrollTrigger,
      splitText.default ?? splitText,
      draggable.default ?? draggable,
    );

    // One global default easing. The codebase already standardised on
    // ease-out-decelerate for entrances; declaring it once here stops each
    // component inventing its own curve, which is how a page ends up feeling
    // like four different websites.
    gsap.defaults({ ease: 'power3.out', duration: 0.6 });

    // ScrollTrigger must be told about the real scroller if the app ever
    // adopts a smooth-scroll wrapper. Today the page scrolls on the document,
    // so this is a no-op that documents the intent.
    (scrollTrigger.default ?? scrollTrigger).defaults({});

    return {
      gsap,
      ScrollTrigger: scrollTrigger.default ?? scrollTrigger,
      SplitText: splitText.default ?? splitText,
      Draggable: draggable.default ?? draggable,
    };
  });

  // A rejected import must not poison the module for the rest of the session;
  // clear the cache so a later navigation can retry.
  bundlePromise.catch(() => {
    bundlePromise = null;
  });

  return bundlePromise;
}

/**
 * True when the visitor asked for less motion, or the environment cannot
 * answer (server-side render, jsdom without matchMedia).
 *
 * Defaulting to `true` when `matchMedia` is missing is deliberate: in a test
 * environment or an SSR pass we would rather not start an animation that
 * nothing will ever finish.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Subscribe to changes in the reduced-motion preference.
 *
 * Users flip this setting without reloading, and an animation that ignores the
 * flip is the bug that gets an accessibility report. Returns an unsubscribe.
 */
export function onReducedMotionChange(handler: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listener = (event: MediaQueryListEvent) => handler(event.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

/**
 * Run `setup` once gsap is ready, unless motion is reduced.
 *
 * This is the only entry point components should use. It bundles the three
 * guards that are easy to forget individually: the lazy import, the
 * reduced-motion check, and the "the component may already be unmounted by the
 * time the import resolves" check.
 *
 * @returns a teardown function safe to hand straight to a `useEffect` cleanup.
 */
export function withGsap(
  setup: (gsap: GsapBundle) => (() => void) | void,
): () => void {
  let cancelled = false;
  let teardown: (() => void) | void;

  if (prefersReducedMotion()) {
    return () => {};
  }

  loadGsap()
    .then((gsap) => {
      // The component unmounted while the bundle was in flight. Starting the
      // animation now would attach triggers to nodes React has discarded.
      if (cancelled) return;
      teardown = setup(gsap);
    })
    .catch(() => {
      /* no gsap, no animation — the content is already on screen */
    });

  return () => {
    cancelled = true;
    if (typeof teardown === 'function') teardown();
  };
}

/**
 * The shared entrance easing, exported so components and tests agree.
 *
 * `power3.out` is a decelerate curve: fast off the mark, settling gently. The
 * two curves this codebase deliberately avoids are `back`/`bounce` (an
 * overshoot on a headline reads as a toy) and `linear` (nothing in the real
 * world moves at a constant rate).
 */
export const ENTRANCE_EASE = 'power3.out';
