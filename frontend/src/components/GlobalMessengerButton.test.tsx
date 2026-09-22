// frontend/src/components/GlobalMessengerButton.test.tsx
//
// Pin the floating buttons' coexistence rules. These were complaints: the
// messenger button floated on top of the open messages drawer, and both
// floating buttons sit over the cart drawer's checkout CTA. So "a covering
// drawer is open ⇒ the floating buttons step aside" is a rule, not a nicety.
// The cart drawer is state-lifted in App, so tests drive it via the prop.

import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderApp } from '../test/render';
import { useDirectStore } from '../store/directStore';

import GlobalMessengerButton from './GlobalMessengerButton';
import BackToTopButton from './BackToTopButton';

describe('GlobalMessengerButton', () => {
  it('opens the chooser sheet when clicked', async () => {
    renderApp(<GlobalMessengerButton />, { route: '/products/grafting-kit-pro' });

    await userEvent.click(screen.getByRole('button', { name: /باز کردن پیام‌رسان/ }));

    // The chooser sheet appears over a backdrop.
    expect(await screen.findByRole('dialog', { name: 'پیام‌رسان گارین‌کود' })).toBeInTheDocument();
  });

  it('disappears entirely while the messages drawer is open, and returns when it closes', async () => {
    renderApp(<GlobalMessengerButton />, { route: '/products/grafting-kit-pro' });

    expect(screen.getByRole('button', { name: /باز کردن پیام‌رسان/ })).toBeInTheDocument();

    // Simulate the drawer being opened from anywhere (sheet, storefront chat…).
    act(() => {
      useDirectStore.setState({ open: true });
    });

    expect(
      screen.queryByRole('button', { name: /باز کردن پیام‌رسان/ }),
    ).not.toBeInTheDocument();

    // Closing the drawer brings the floating button back.
    act(() => {
      useDirectStore.setState({ open: false });
    });
    expect(screen.getByRole('button', { name: /باز کردن پیام‌رسان/ })).toBeInTheDocument();
  });

  it('stays out of the way while the cart drawer is open, and returns when it closes', () => {
    const closed = renderApp(<GlobalMessengerButton />, {
      route: '/products/grafting-kit-pro',
    });
    expect(screen.getByRole('button', { name: /باز کردن پیام‌رسان/ })).toBeInTheDocument();
    closed.unmount();

    renderApp(<GlobalMessengerButton cartDrawerOpen />, {
      route: '/products/grafting-kit-pro',
    });
    expect(
      screen.queryByRole('button', { name: /باز کردن پیام‌رسان/ }),
    ).not.toBeInTheDocument();

    // Back to closed state on a fresh mount (App passes the prop down).
    cleanup();
    renderApp(<GlobalMessengerButton />, { route: '/products/grafting-kit-pro' });
    expect(screen.getByRole('button', { name: /باز کردن پیام‌رسان/ })).toBeInTheDocument();
  });

  it('stays hidden on the dedicated messages route', () => {
    renderApp(<GlobalMessengerButton />, { route: '/messages' });

    expect(
      screen.queryByRole('button', { name: /باز کردن پیام‌رسان/ }),
    ).not.toBeInTheDocument();
  });
});

describe('BackToTopButton', () => {
  beforeEach(() => {
    // Past the visibility threshold, as if the shopper had scrolled.
    Object.defineProperty(window, 'scrollY', {
      value: 600,
      writable: true,
      configurable: true,
    });
  });

  it('yields to the cart drawer via the lifted prop, and returns when it closes', () => {
    renderApp(<BackToTopButton />, { route: '/products/grafting-kit-pro' });
    expect(screen.getByRole('button', { name: 'بازگشت به بالای صفحه' })).toBeInTheDocument();
    cleanup();

    renderApp(<BackToTopButton cartDrawerOpen />, { route: '/products/grafting-kit-pro' });
    expect(screen.queryByRole('button', { name: 'بازگشت به بالای صفحه' })).not.toBeInTheDocument();

    cleanup();
    renderApp(<BackToTopButton />, { route: '/products/grafting-kit-pro' });
    expect(screen.getByRole('button', { name: 'بازگشت به بالای صفحه' })).toBeInTheDocument();
  });

  it('yields to the messages drawer too', () => {
    renderApp(<BackToTopButton />, { route: '/products/grafting-kit-pro' });

    act(() => {
      useDirectStore.setState({ open: true });
    });
    expect(screen.queryByRole('button', { name: 'بازگشت به بالای صفحه' })).not.toBeInTheDocument();

    act(() => {
      useDirectStore.setState({ open: false });
    });
    expect(screen.getByRole('button', { name: 'بازگشت به بالای صفحه' })).toBeInTheDocument();
  });
});
