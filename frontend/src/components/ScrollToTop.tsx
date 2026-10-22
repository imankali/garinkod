import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router";

/**
 * Restores the document to the top whenever the active route changes.
 *
 * A single scrollTo races the new page's mounting content: cards fetch their
 * data and mount after the first paint, and framer-motion's whileInView
 * measurement restores the window scroll around each keyframe pass (its
 * measure step calls scrollTo(x, yAtMeasureTime)). That restore was landing
 * the storefronts page thousands of pixels deep on entry — the «صفحه بالا
 * نمی‌آید» bug — so the reset keeps re-asserting until the document has held
 * y=0 across two consecutive frames (bounded to ~1.5 s so a genuinely
 * unmountable page still settles rather than looping forever).
 */
// Per-history-entry scroll memory: React Router gives each entry a stable
// `key` in history.state, and saving/restoring against it makes Back land on
// «همان جایی که بودم» even though scrollRestoration='manual' (which the
// framer-motion fix below requires) silences the browser's own restore.
const scrollMemory = new Map<string, number>();

function currentEntryKey(): string {
  const state = history.state as { key?: string } | null;
  return state?.key ?? 'unknown';
}

export default function ScrollToTop() {
  const { pathname } = useLocation();
  // POP means the visitor used Back/Forward: restore the saved position for
  // that entry. PUSH/REPLACE get the reset.
  const navigationType = useNavigationType();

  // Save continuously (throttled to one write per frame at most) so a fresh
  // navigation away captures the depth the reader had reached.
  useEffect(() => {
    let queued = false;
    const save = () => {
      queued = false;
      scrollMemory.set(currentEntryKey(), window.scrollY);
    };
    const onScroll = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(save);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      save();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    if (history.scrollRestoration !== "manual") {
      history.scrollRestoration = "manual";
    }

    if (navigationType === 'POP') {
      const saved = scrollMemory.get(currentEntryKey());
      if (saved !== undefined) {
        // The restored page mounts progressively; keep re-asserting the saved
        // depth until the document is tall enough to hold it and it sticks.
        let raf = 0;
        const startedAt = performance.now();
        const restore = () => {
          window.scrollTo(0, saved);
          const settled = Math.abs(window.scrollY - saved) < 2;
          if (!settled && performance.now() - startedAt < 2000) {
            raf = requestAnimationFrame(restore);
          }
        };
        raf = requestAnimationFrame(restore);
        return () => cancelAnimationFrame(raf);
      }
      return;
    }

    window.scrollTo(0, 0);
    let raf = 0;
    let zeroStreak = 0;
    const startedAt = performance.now();
    const settle = () => {
      if (window.scrollY === 0) {
        zeroStreak += 1;
      } else {
        zeroStreak = 0;
        window.scrollTo(0, 0);
      }
      /* The watchdog window must outlive the route's data fetch + card mount
         (~1 s on a warm cache): the restore comes from keyframes measured
         after the content appears, not on the first paint. */
      if (zeroStreak < 4 && performance.now() - startedAt < 3000) {
        raf = requestAnimationFrame(settle);
      }
    };
    raf = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(raf);
  }, [pathname, navigationType]);

  return null;
}
