// frontend/src/App.smoke.test.tsx
//
// A mount test for the real router.
//
// Unit tests cover each decision; this one answers a different question — does the
// assembled application render at all? It mounts `App` (the actual route table, the
// actual header and footer) against a stubbed API and asserts the things a broken
// import or a bad provider order would take away: the hero headline, the primary
// navigation, and the cart control in the header.
//
// It is deliberately shallow. It is not a replacement for the browser suite; it is
// the signal that survives when Playwright cannot run.

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from './api/client';
import App from './App';
import { Providers, createQueryClient } from './providers';

vi.mock('./api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const get = vi.mocked(apiClient.get);

/** Every endpoint the home page touches, answered with an empty-but-valid body. */
function answer(path: string) {
  if (path.includes('/products/')) return { count: 0, next: null, previous: null, results: [] };
  if (path.includes('/categories/')) return { count: 0, next: null, previous: null, results: [] };
  if (path.includes('/marketplace/storefronts/')) return { count: 0, next: null, previous: null, results: [] };
  if (path.includes('/articles/')) return [];
  if (path.includes('/cart/')) return { id: 0, items: [], total_price: 0, total_items: 0 };
  if (path.includes('/auth/me/') || path.includes('/users/me/')) return {};
  return {};
}

/** The real provider stack, with retries off so a failure surfaces immediately. */
function renderApp() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <Providers client={client}>
      <App />
    </Providers>,
  );
}

beforeEach(() => {
  get.mockImplementation((path: string) => Promise.resolve({ data: answer(path) }) as never);
});

afterEach(() => {
  get.mockReset();
});

describe('App', () => {
  it('mounts the whole shell and paints the home page', async () => {
    renderApp();

    // The hero's headline is the first thing the site says about itself.
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/نهاده‌های کشاورزی/),
    );

    // The chrome is present: navigation, cart, and the phone bar.
    expect(screen.getByRole('navigation', { name: 'ناوبری اصلی' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /سبد خرید/ })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'ناوبری پایین' })).toBeInTheDocument();
  });

  it('renders the skip link before anything else', () => {
    renderApp();
    const skip = screen.getByRole('link', { name: 'رفتن به محتوای اصلی' });
    expect(skip).toHaveAttribute('href', '#main');
  });

  it('shows the section headings the home page is built from', async () => {
    renderApp();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'پرفروش‌ترین کالاها' })).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'تازه‌های انبار' })).toBeInTheDocument();
  });

  it('does not crash when the API answers nothing', async () => {
    get.mockRejectedValue(new Error('network down'));
    renderApp();

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/نهاده‌های کشاورزی/),
    );
    // A failed section removes itself rather than printing an error box.
    expect(screen.queryByText('این صفحه باز نشد')).not.toBeInTheDocument();
  });
});
