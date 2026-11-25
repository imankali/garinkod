// frontend/src/components/home/VoicesPanel.test.tsx
//
// /api/testimonials/ serves rated reviews in three named tiers, and the one
// thing a testimonial strip must never do is let a review with no purchase
// behind it read like a verified one. These tests hold the panel to the tier
// the server chose rather than to a badge it invented.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.fn();

vi.mock('../../api/services', () => ({
  testimonialsApi: { list: (...args: unknown[]) => list(...args) },
}));

import VoicesPanel from './VoicesPanel';

const item = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'صادق نهال‌کار',
  body: 'چاقوی خیلی تیزی داشت و پیوندهای امسال خوب جواب داد.',
  rating: 5,
  sticker: '',
  image_url: '',
  created: '2026-11-20',
  helpful_count: 14,
  verified_purchase: false,
  product: {
    title: 'کیت پیوندزنی حرفه‌ای',
    slug: 'grafting-kit',
    brand: 'دانو',
    image_url: '',
    url: '/products/grafting-kit',
  },
  ...over,
});

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VoicesPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  list.mockReset();
});

describe('VoicesPanel', () => {
  it('renders the reviews and links each to the product it is about', async () => {
    list.mockResolvedValue({ data: { mode: 'curated', total: 14, items: [item()] } });
    renderPanel();

    expect(await screen.findByText(/چاقوی خیلی تیزی/)).toBeDefined();
    expect(screen.getByText('صادق نهال‌کار')).toBeDefined();

    // The backend's own `product.url` is /products/<slug>, which is not a route;
    // the panel builds /product/<slug> instead.
    expect(screen.getByRole('link', { name: 'کیت پیوندزنی حرفه‌ای' })).toHaveAttribute(
      'href',
      '/product/grafting-kit',
    );
  });

  it('shows a verified badge only where the server says the purchase is real', async () => {
    list.mockResolvedValue({
      data: {
        mode: 'verified',
        total: 2,
        items: [item({ id: 1, verified_purchase: true }), item({ id: 2, verified_purchase: false })],
      },
    });
    renderPanel();

    // Two rows, so the caption text appears twice — wait on the count.
    await screen.findAllByText(/چاقوی خیلی تیزی/);
    // Two reviews on the page, exactly one badge.
    expect(screen.getAllByText('خرید تأییدشده')).toHaveLength(1);
  });

  it('names the open tier honestly instead of dressing it as purchases', async () => {
    list.mockResolvedValue({ data: { mode: 'open', total: 3, items: [item()] } });
    renderPanel();

    expect(await screen.findByRole('heading', { name: 'نظر کاربران' })).toBeDefined();
    expect(screen.getByText(/خرید این کاربران هنوز تأیید نشده است/)).toBeDefined();
    expect(screen.queryByText('تجربهٔ خریداران')).toBeNull();
  });

  it('does not grow an empty section when nothing has been reviewed', async () => {
    list.mockResolvedValue({ data: { mode: 'open', total: 0, items: [] } });
    renderPanel();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('تجربهٔ خریداران')).toBeNull();
    expect(screen.queryByText('نظر کاربران')).toBeNull();
  });
});
