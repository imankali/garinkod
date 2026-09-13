// frontend/src/components/home/RankedRail.test.tsx
//
// Every home rail (best sellers, newest, best rated) is one RankedRail with a
// different ordering. These tests pin that the ordering really reaches the
// API — a "best seller" rail sorted by anything else would be a silent lie —
// and that an empty rail removes itself.

import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrendingUp } from 'lucide-react';

import RankedRail from './RankedRail';
import { renderAppSettled } from '../../test/render';
import { productsApi } from '../../api/services';

vi.mock('../../api/services', () => ({ productsApi: { getAll: vi.fn() } }));

const PRODUCT = (over: Record<string, unknown> = {}) =>
  ({
    id: 1,
    title: 'سم کنفیدور',
    slug: 'confidor',
    price: 500000,
    discounted_price: 500000,
    discount_percent: 0,
    image_url: '/img/c.jpg',
    ...over,
  }) as never;

beforeEach(() => {
  vi.mocked(productsApi.getAll).mockResolvedValue({
    data: { results: [PRODUCT()], count: 1, next: null, previous: null },
  } as never);
});

const renderRail = () =>
  renderAppSettled(
    <RankedRail
      railId="best_sellers"
      title="پرفروش‌ترین کالاها"
      hint="بر اساس تعداد سفارش ثبت‌شده در گرین کود"
      icon={TrendingUp}
      params={{ ordering: '-sales_count' }}
      moreTo="/products?ordering=-sales_count"
    />,
    { route: '/' },
  );

describe('the ranked home rail', () => {
  it('sends its own ordering to the API', async () => {
    await renderRail();
    await screen.findByText('سم کنفیدور');
    expect(productsApi.getAll).toHaveBeenCalledWith({ ordering: '-sales_count', page_size: 10 });
  });

  it('shows the rating when the product has one', async () => {
    vi.mocked(productsApi.getAll).mockResolvedValue({
      data: {
        results: [PRODUCT({ avg_rating: 4.7, reviews_count: 23 })],
        count: 1,
        next: null,
        previous: null,
      },
    } as never);
    await renderRail();
    await screen.findByText('سم کنفیدور');
    expect(screen.getByText('۴.۷')).toBeInTheDocument();
    expect(screen.getByText('(۲۳)')).toBeInTheDocument();
  });

  it('links to the full sorted collection', async () => {
    await renderRail();
    const link = await screen.findByRole('link', { name: /دیدن همه/ });
    expect(link).toHaveAttribute('href', '/products?ordering=-sales_count');
  });

  it('removes itself when the rail is empty', async () => {
    vi.mocked(productsApi.getAll).mockResolvedValue({
      data: { results: [], count: 0, next: null, previous: null },
    } as never);
    await renderRail();
    await vi.waitFor(() => expect(productsApi.getAll).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: /پرفروش‌ترین/ })).not.toBeInTheDocument();
  });
});
