// frontend/src/components/home/OfferRail.test.tsx
//
// The rail's side of the auto-rotation bargain. Every timer assertion here is
// about a timer that must NOT exist: the flash-deal rail and the three ranked
// rails on the home page all move on their own every 2 seconds, and a visitor
// who has stopped that motion (or whose system asks for reduced motion) must
// not have a single one of those intervals running.

import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import OfferRail from './OfferRail';
import { renderAppSettled } from '../../test/render';
import {
  resetAutoRotatePreference,
  setAutoRotate,
} from '../../hooks/useAutoRotate';
import type { ProductList } from '@/types/shop';

const AUTOPLAY_MS = 2000;

const products = [
  { id: 1, title: 'کود اوره', slug: 'ure', price: 100000, discounted_price: 90000, discount_percent: 10 },
  { id: 2, title: 'کود پتاس', slug: 'potash', price: 200000, discounted_price: 180000, discount_percent: 10 },
  { id: 3, title: 'سم قارچ‌کش', slug: 'fungicide', price: 300000, discounted_price: 270000, discount_percent: 10 },
  { id: 4, title: 'بذر گوجه', slug: 'tomato-seed', price: 400000, discounted_price: 360000, discount_percent: 10 },
] as unknown as ProductList[];

/** Only the rail's own interval matters, not anything React or a lib schedules. */
function autoplayTicks() {
  return vi.mocked(window.setInterval).mock.calls.filter(([, delay]) => delay === AUTOPLAY_MS);
}

/** A plain browser: no reduced-motion preference expressed. */
function stubNoReducedMotion() {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

beforeEach(() => {
  // Tests share one jsdom document, so a stub installed by the previous test
  // (the reduced-motion one) would otherwise still be answering.
  stubNoReducedMotion();
  resetAutoRotatePreference();
  vi.spyOn(window, 'setInterval');
});

afterEach(() => {
  vi.mocked(window.setInterval).mockRestore();
  resetAutoRotatePreference();
});

describe('the offer rail', () => {
  it('rotates on its own while the visitor allows it', async () => {
    await renderAppSettled(<OfferRail products={products} />, { route: '/' });
    expect(autoplayTicks()).toHaveLength(1);
  });

  it('schedules nothing at all once auto-rotation is off', async () => {
    setAutoRotate(false);
    await renderAppSettled(<OfferRail products={products} />, { route: '/' });
    expect(autoplayTicks()).toHaveLength(0);
  });

  it('schedules nothing when the system asks for reduced motion', async () => {
    window.matchMedia = ((query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    resetAutoRotatePreference();

    await renderAppSettled(<OfferRail products={products} />, { route: '/' });
    expect(autoplayTicks()).toHaveLength(0);
  });

  it('stops the tick that is already running when the shared switch flips', async () => {
    await renderAppSettled(<OfferRail products={products} />, { route: '/' });
    // The return value of the live interval, not its arguments: the thing a
    // leak would leave firing is the timer, and that is what must be cleared.
    const tickingTimerId = vi.mocked(window.setInterval).mock.results.at(-1)?.value;
    expect(tickingTimerId).toBeDefined();

    const clear = vi.spyOn(window, 'clearInterval');
    vi.mocked(window.setInterval).mockClear();

    act(() => setAutoRotate(false));

    // The effect unsubscribes rather than leaving a timer that keeps firing and
    // returns early — same visible result, one fewer thing running on a page
    // that already has six of them.
    expect(clear).toHaveBeenCalledWith(tickingTimerId);
    expect(autoplayTicks()).toHaveLength(0);
    clear.mockRestore();
  });

  it('keeps the cards reachable without any of the motion', async () => {
    setAutoRotate(false);
    await renderAppSettled(<OfferRail products={products} />, { route: '/' });
    // Stopping the animation must never stop the shopping.
    expect(screen.getByRole('region', { name: 'کارت‌های قابل پیمایش افقی' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /کود اوره/ })).toHaveAttribute('href', '/products/ure');
    expect(screen.getByRole('button', { name: 'افزودن کود اوره به سبد خرید' })).toBeInTheDocument();
  });
});
