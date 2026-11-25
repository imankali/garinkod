// frontend/src/components/shop/Reviews.test.tsx
//
// The review section had no tests. Two things it must not get wrong:
//
//   • the average and the count come from the server's summary, never from the
//     rows on screen — a page that averaged its own loaded page of reviews
//     would print a different score from the one the catalogue shows;
//   • the «از میان نظرهای دیگر کالاها» block shows only rows the server flagged
//     `is_featured`, and disappears when there are none. A block of the page's
//     own favourite comments would be the page reviewing itself.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getByProduct = vi.fn();
const getRatingSummary = vi.fn();
const getAll = vi.fn();
const create = vi.fn();

vi.mock('../../api/services', () => ({
  commentsApi: {
    getByProduct: (...a: unknown[]) => getByProduct(...a),
    getRatingSummary: (...a: unknown[]) => getRatingSummary(...a),
    getAll: (...a: unknown[]) => getAll(...a),
    create: (...a: unknown[]) => create(...a),
    toggleHelpful: vi.fn(),
    report: vi.fn(),
  },
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean; user: unknown }) => unknown) =>
    selector({ isAuthenticated: false, user: null }),
}));

import Reviews from './Reviews';

const review = (over: Record<string, unknown> = {}) => ({
  id: 1,
  product: 7,
  name: 'مریم احمدی',
  email: '',
  body: 'روی علف‌های هرز گندم‌زار خوب جواب داد.',
  image: null,
  sticker: '',
  rating: 4,
  is_verified_purchase: true,
  is_featured: false,
  parent: null,
  replies: [],
  helpful_count: 0,
  created: '2026-11-20T10:00:00+03:30',
  updated: '2026-11-20T10:00:00+03:30',
  ...over,
});

function renderReviews() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Reviews slug="glyphosate" productId={7} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getByProduct.mockReset();
  getRatingSummary.mockReset();
  getAll.mockReset();
  // getByProduct answers with a bare array, not a paginated envelope.
  getByProduct.mockResolvedValue({ data: [review()] });
  getRatingSummary.mockResolvedValue({
    data: { average: 4.5, reviews_count: 21, distribution: { 5: 12, 4: 6, 3: 2, 2: 1, 1: 0 } },
  });
  getAll.mockResolvedValue({ data: { count: 0, results: [] } });
});

describe('Reviews', () => {
  it('prints the average the server computed, not one from the rows on screen', async () => {
    renderReviews();

    // One loaded review of 4 stars; the summary says 4.5 over 21. The page must
    // report the server's figure.
    expect(await screen.findByText('۴٫۵')).toBeDefined();
    expect(screen.getByText(/از ۲۱ نظر/)).toBeDefined();
  });

  it('shows only the rows the server flagged as featured', async () => {
    getAll.mockResolvedValue({
      data: {
        count: 3,
        results: [
          review({ id: 2, name: 'حسین', body: 'بسته‌بندی سالم رسید.', is_featured: true, rating: 5 }),
          review({ id: 3, name: 'زهرا', body: 'این یکی منتخب نیست.', is_featured: false }),
        ],
      },
    });
    renderReviews();

    expect(await screen.findByText('بسته‌بندی سالم رسید.')).toBeDefined();
    expect(screen.queryByText('این یکی منتخب نیست.')).toBeNull();
  });

  it('grows no featured block when nothing is flagged', async () => {
    getAll.mockResolvedValue({
      data: { count: 1, results: [review({ id: 4, is_featured: false })] },
    });
    renderReviews();

    await waitFor(() => expect(getAll).toHaveBeenCalled());
    expect(screen.queryByText('از میان نظرهای دیگر کالاها')).toBeNull();
  });

  it('marks the reviews the server calls verified purchases', async () => {
    renderReviews();

    expect(await screen.findByText(/خرید تأییدشده/)).toBeDefined();
  });
});
