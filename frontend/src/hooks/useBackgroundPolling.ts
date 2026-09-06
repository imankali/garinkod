// frontend/src/hooks/useBackgroundPolling.ts
//
// One loop for the messenger's heartbeats, with the two behaviours the inbox
// actually needs:
//
// * a hidden tab is not somebody waiting for a message. Phones and laptops save
//   real work (and real rate-limit budget) by not polling a screen nobody is
//   looking at; the moment the tab becomes visible again a tick fires, so the
//   reader is never looking at stale data for longer than one interval;
// * a 429 means "come back later", not "come back sooner". The pause honours
//   the server's own `Retry-After`, which is what stops a throttled inbox from
//   turning into a wall of errors.
//
// The task may reject; the rejection is consumed here on purpose so a poll
// never becomes an unhandled promise rejection.

import { useEffect, useRef } from 'react';

import { parseApiError } from '../api/errors';

const MINIMUM_BACKOFF_SECONDS = 15;

export function useBackgroundPolling(
  task: () => Promise<unknown>,
  intervalMs: number,
  active = true,
): void {
  const blockedUntil = useRef(0);

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (Date.now() < blockedUntil.current) return;
      try {
        await task();
      } catch (caught) {
        const parsed = parseApiError(caught);
        if (parsed.code === 'throttled') {
          const wait = Math.max(parsed.retryAfter ?? 0, MINIMUM_BACKOFF_SECONDS);
          blockedUntil.current = Date.now() + wait * 1000;
        }
      }
    }

    void tick();
    const timer = window.setInterval(() => void tick(), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, intervalMs, task]);
}

export default useBackgroundPolling;
