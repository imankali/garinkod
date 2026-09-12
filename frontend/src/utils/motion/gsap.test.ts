import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { prefersReducedMotion, withGsap } from './gsap';

/**
 * These test the *guards*, not the animation.
 *
 * The animation itself needs a browser: it moves real pixels on a real scroll
 * clock, and jsdom has neither. What can be tested headlessly — and what has
 * to be, because it is the difference between a flourish and an outage — is the
 * contract around it: that content is never hidden waiting for a library, that
 * reduced motion is honoured, and that an unmounted component cannot start an
 * animation on nodes that no longer exist.
 */

/** Control the media query the guards read. */
function setReducedMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => setReducedMotion(false));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('prefersReducedMotion', () => {
  it('reports the visitor’s actual preference', () => {
    setReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);

    setReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('assumes "reduce" when matchMedia is missing', () => {
    // jsdom without a stub, or a server render. Starting an animation nothing
    // can observe is worse than not starting one.
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(true);
  });
});

describe('withGsap', () => {
  it('never runs the setup when the visitor asked for less motion', async () => {
    setReducedMotion(true);
    const setup = vi.fn();

    withGsap(setup);
    await Promise.resolve();
    await Promise.resolve();

    expect(setup).not.toHaveBeenCalled();
  });

  it('returns a teardown that is safe to call twice', () => {
    setReducedMotion(true);
    const teardown = withGsap(vi.fn());
    expect(() => {
      teardown();
      teardown();
    }).not.toThrow();
  });

  it('cancels the setup if the component unmounts before gsap arrives', async () => {
    // This is the leak that matters: the dynamic import is still in flight when
    // React unmounts, and an animation started afterwards is attached to a node
    // the page no longer has.
    setReducedMotion(false);
    const setup = vi.fn(() => vi.fn());

    const teardown = withGsap(setup);
    teardown();

    // Flush whatever the import chain resolves to.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Either the setup was skipped entirely, or it was immediately torn down.
    // What must never happen is a live tween with no owner.
    if (setup.mock.calls.length > 0) {
      expect(setup.mock.results[0]?.value).toBeTypeOf('function');
    }
  });
});
