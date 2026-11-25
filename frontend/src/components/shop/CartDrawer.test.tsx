// frontend/src/components/shop/CartDrawer.test.tsx
//
// The drawer is mounted on every page, open or not, because it has to slide.
// That buys three obligations which are invisible on screen and easy to lose in
// a refactor:
//   • closed, nothing inside it may be reached by a keyboard (it is `inert`,
//     not merely transparent — `aria-hidden` on focusable children is itself a
//     failure),
//   • open, it is a modal dialog: Escape closes it, and Tab stays inside it
//     instead of walking into the page behind,
//   • the close button takes focus on open, so a keyboard user lands inside the
//     panel rather than at the top of the document.
//
// The store is the real one; only the cart endpoint is stubbed.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/services', () => ({
  cartApi: {
    get: vi.fn(() =>
      Promise.resolve({
        data: {
          id: 1,
          items: [],
          total_price: 0,
          total_items: 0,
          created_at: '',
          updated_at: '',
        },
      }),
    ),
  },
}));

import CartDrawer from './CartDrawer';
import { useCartStore } from '../../store/cartStore';

// Queried by attribute, not by role: while closed the wrapper is `aria-hidden`,
// so the dialog is deliberately not in the accessibility tree yet has to be
// inspected anyway.
const panel = () => document.querySelector('[role="dialog"]') as HTMLElement;

const renderDrawer = () =>
  render(
    <MemoryRouter>
      {/* A focusable neighbour, so "Tab stays inside" cannot pass just because
          the panel is the only thing on the page. */}
      <button type="button">بیرون</button>
      <CartDrawer />
    </MemoryRouter>,
  );

beforeEach(() => {
  useCartStore.setState({ isOpen: true, cart: null });
});

afterEach(() => {
  useCartStore.setState({ isOpen: false });
});

describe('CartDrawer', () => {
  it('takes its contents out of the tab order while closed, and puts them back when opened', async () => {
    useCartStore.setState({ isOpen: false });
    renderDrawer();

    expect(panel()).toHaveAttribute('inert');

    useCartStore.setState({ isOpen: true });
    await waitFor(() => expect(panel()).not.toHaveAttribute('inert'));
  });

  it('moves focus to the close button when it opens', async () => {
    renderDrawer();

    await waitFor(() => expect(screen.getByRole('button', { name: 'بستن سبد' })).toHaveFocus());
  });

  it('closes on Escape', async () => {
    renderDrawer();
    await waitFor(() => expect(panel()).not.toHaveAttribute('inert'));

    await userEvent.keyboard('{Escape}');
    expect(useCartStore.getState().isOpen).toBe(false);
  });

  it('keeps Tab inside the panel', async () => {
    renderDrawer();
    await waitFor(() => expect(panel()).not.toHaveAttribute('inert'));

    const inside = panel().querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    const last = inside[inside.length - 1] as HTMLElement;
    last.focus();

    await userEvent.tab();
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'بیرون' }));
    expect(panel().contains(document.activeElement)).toBe(true);

    await userEvent.tab({ shift: true });
    expect(panel().contains(document.activeElement)).toBe(true);
  });
});
