// frontend/src/components/layout/Header.test.tsx
//
// The header is on every page, so its two promises are worth a test each:
//   • the current destination is announced, not only coloured (`aria-current`),
//   • the phone sheet is a modal dialog: Escape closes it, and the body cannot
//     scroll behind it.
//
// Nothing here asserts appearance — the tokens own that.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/services', () => ({
  productsApi: { suggest: vi.fn(() => Promise.resolve({ data: [] })) },
}));

import Header from './Header';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Header />
    </MemoryRouter>,
  );

beforeEach(() => {
  useAuthStore.setState({ isAuthenticated: false, user: null });
  useCartStore.setState({ cart: null, isOpen: false });
  document.body.style.overflow = '';
});

afterEach(() => {
  document.body.style.overflow = '';
});

describe('Header', () => {
  it('marks the current destination with aria-current, and only that one', () => {
    renderAt('/products');

    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', '/products');
  });

  it('marks nothing on a page that is not a destination', () => {
    renderAt('/product/glyphosate-41-1l');

    expect(
      screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page'),
    ).toEqual([]);
  });

  it('opens the phone sheet as a dialog, locks the body, and closes on Escape', async () => {
    renderAt('/');

    await userEvent.click(screen.getByRole('button', { name: 'منو' }));

    const sheet = screen.getByRole('dialog', { name: 'منوی سایت' });
    expect(sheet).toBeDefined();
    expect(document.body.style.overflow).toBe('hidden');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(document.body.style.overflow).toBe(''));
    expect(screen.queryByRole('dialog', { name: 'منوی سایت' })).toBeNull();
  });

  it('sends a signed-out visitor to the login page from the sheet', async () => {
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'منو' }));

    expect(screen.getByRole('link', { name: 'ورود / ثبت‌نام' })).toHaveAttribute('href', '/login');
  });

  it('names the basket and its count for screen readers', async () => {
    useCartStore.setState({
      cart: { id: 1, items: [], total_price: 0, total_items: 3, created_at: '', updated_at: '' },
    });
    renderAt('/');

    expect(screen.getByRole('button', { name: 'سبد خرید، 3 کالا' })).toBeDefined();
  });
});
