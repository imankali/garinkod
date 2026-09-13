// frontend/src/components/home/AmazingOffers.test.tsx
//
// The flash-deal panel: it must show only real discounts, always disclose the
// original price next to the final one, run a countdown, and disappear when
// the shop has nothing discounted — an empty red panel would be a lie.

import { screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AmazingOffers from './AmazingOffers';
import { renderAppSettled } from '../../test/render';
import { productsApi } from '../../api/services';

vi.mock('../../api/services', () => ({ productsApi: { getAll: vi.fn() } }));

const PRODUCT = (over: Record<string, unknown> = {}) =>
  ({
    id: 1,
    title: 'کود نیتروژن',
    slug: 'nitrogen',
    price: 400000,
    discounted_price: 320000,
    discount_percent: 20,
    image_url: '/img/n.jpg',
    ...over,
  }) as never;

beforeEach(() => {
  vi.mocked(productsApi.getAll).mockResolvedValue({
    data: { results: [PRODUCT()], count: 1, next: null, previous: null },
  } as never);
});

describe('the flash-deal panel', () => {
  it('asks the API for the deepest discounts', async () => {
    await renderAppSettled(<AmazingOffers />, { route: '/' });
    await screen.findByText('کود نیتروژن');
    expect(productsApi.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ has_discount: true, ordering: '-discount_percent' }),
    );
  });

  it('shows badge, struck original price and final price', async () => {
    await renderAppSettled(<AmazingOffers />, { route: '/' });
    await screen.findByText('کود نیتروژن');
    expect(screen.getByText('۲۰٪')).toBeInTheDocument();
    expect(screen.getByText(/۴۰۰٬۰۰۰ تومان/)).toBeInTheDocument();
    expect(screen.getByText(/۳۲۰٬۰۰۰ تومان/)).toBeInTheDocument();
  });

  it('filters out items the API returned without a discount', async () => {
    vi.mocked(productsApi.getAll).mockResolvedValue({
      data: {
        results: [PRODUCT(), PRODUCT({ id: 2, title: 'بدون تخفیف', discount_percent: 0 })],
        count: 2,
        next: null,
        previous: null,
      },
    } as never);
    await renderAppSettled(<AmazingOffers />, { route: '/' });
    await screen.findByText('کود نیتروژن');
    expect(screen.queryByText('بدون تخفیف')).not.toBeInTheDocument();
  });

  it('links to the full discount collection', async () => {
    await renderAppSettled(<AmazingOffers />, { route: '/' });
    const link = await screen.findByRole('link', { name: /همه تخفیف‌ها/ });
    expect(link).toHaveAttribute('href', '/products?collection=discounted');
  });

  it('scrolls the rail with the round arrow buttons', async () => {
    await renderAppSettled(<AmazingOffers />, { route: '/' });
    await screen.findByText('کود نیتروژن');
    const rail = screen.getByRole('region', { name: 'کارت‌های قابل پیمایش افقی' });
    const scrollBy = vi.fn();
    rail.scrollBy = scrollBy;
    fireEvent.click(screen.getByRole('button', { name: 'محصولات بعدی' }));
    fireEvent.click(screen.getByRole('button', { name: 'محصولات قبلی' }));
    expect(scrollBy).toHaveBeenCalledTimes(2);
    expect(scrollBy).toHaveBeenNthCalledWith(1, { left: 280, behavior: 'smooth' });
    expect(scrollBy).toHaveBeenNthCalledWith(2, { left: -280, behavior: 'smooth' });
  });

  it('removes itself when nothing is discounted', async () => {
    vi.mocked(productsApi.getAll).mockResolvedValue({
      data: { results: [], count: 0, next: null, previous: null },
    } as never);
    await renderAppSettled(<AmazingOffers />, { route: '/' });
    await vi.waitFor(() => expect(productsApi.getAll).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: /شگفت‌انگیز/ })).not.toBeInTheDocument();
  });
});
