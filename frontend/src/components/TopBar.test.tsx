import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TopBar from './TopBar';
import { resetAutoRotatePreference, setAutoRotate } from '../hooks/useAutoRotate';

/**
 * The ticker in the top strip.
 *
 * Two properties matter, and neither is about the animation itself — that needs
 * a real engine, and the e2e sweep in navigation.spec.ts measures it:
 *
 *   1. the strip renders the message list twice, because the loop travels
 *      exactly one copy; a list rendered once would visibly jump at the seam;
 *   2. the message stays readable when rotation is switched off, instead of
 *      being frozen at whatever offset the animation had reached.
 */

const matchMedia = (reduce: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reduce : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
};

const message = '🚚 ارسال رایگان برای خرید بالای ۳ میلیون تومان، مطابق شرایط سفارش';

describe('TopBar ticker', () => {
  beforeEach(() => {
    window.localStorage.clear();
    matchMedia(false);
    // The preference lives in a module-level store, so it has to be handed back
    // between tests rather than inherited by the next one.
    resetAutoRotatePreference();
  });

  it('renders the message list twice, so the loop can travel one copy', () => {
    const { container } = render(<TopBar />);

    expect(container.querySelectorAll('.animate-marquee')).toHaveLength(1);
    expect(screen.getAllByText(message)).toHaveLength(2);
  });

  it('shows one stationary message once the reader pauses rotation', () => {
    const { container } = render(<TopBar />);

    act(() => setAutoRotate(false));

    expect(container.querySelector('.animate-marquee')).toBeNull();
    expect(screen.getAllByText(message)).toHaveLength(1);
  });

  it('stops the strip for a reader whose system asks for reduced motion', () => {
    matchMedia(true);
    resetAutoRotatePreference();
    const { container } = render(<TopBar />);

    expect(container.querySelector('.animate-marquee')).toBeNull();
    expect(screen.getAllByText(message)).toHaveLength(1);
  });
});
