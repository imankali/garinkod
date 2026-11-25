// frontend/src/pages/Shop.test.tsx
//
// The catalogue's pagination, which is the one control on the page that cannot
// be checked by looking at a screenshot:
//   • the page number lives in the URL, so a filtered view is shareable and the
//     back button works,
//   • «بعدی» asks the server for the next page instead of re-requesting a
//     bigger list — the previous page is what is still on screen while the next
//     one loads,
//   • the buttons are disabled at the ends rather than leading somewhere empty.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogApi, categoriesApi, productsApi } from '../api/services';
import { createQueryClient, Providers } from '../providers';
import Shop from './Shop';

vi.mock('../api/services', () => ({
  catalogApi: { index: vi.fn() },
  categoriesApi: { getAll: vi.fn() },
  productsApi: { getAll: vi.fn() },
}));

const card = (id: number) => ({
  id,
  title: `کود اوره ${id}`,
  slug: `urea-${id}`,
  category: 'کود',
  price: 100000,
  stock: 10,
  available: true,
  is_featured: false,
  image: null,
  image_url: `/media/products/urea-${id}.jpg`,
  is_in_stock: true,
  discount_percent: 0,
  sales_count: 1,
  discounted_price: 100000,
  brand: 'کیمیا سبز',
  sku: `UREA-${id}`,
});

const results = (page: number, count = 60) => ({
  data: {
    count,
    next: page * 24 < count ? `?page=${page + 1}` : null,
    previous: page > 1 ? `?page=${page - 1}` : null,
    results: Array.from({ length: 24 }, (_, index) => card(page * 100 + index)),
  },
});

const renderShop = (path = '/products') =>
  render(
    <Providers client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Shop />
      </MemoryRouter>
    </Providers>,
  );

beforeEach(() => {
  vi.mocked(categoriesApi.getAll).mockResolvedValue({ data: { count: 0, results: [] } } as never);
  vi.mocked(catalogApi.index).mockResolvedValue({
    data: {
      categories: [],
      brands: [{ kind: 'brand', title: 'باغبان‌پرو', slug: 'baghban-pro', image_url: '', description: '', count: 3, url: '' }],
      tags: [{ kind: 'tag', title: 'ارگانیک', slug: 'organic', image_url: '', description: '', count: 1, url: '' }],
    },
  } as never);
  vi.mocked(productsApi.getAll).mockReset();
  vi.mocked(productsApi.getAll).mockImplementation((params) =>
    Promise.resolve(results(params?.page ?? 1) as never),
  );
});

describe('Shop pagination', () => {
  it('asks for page 1 and offers only «بعدی» there', async () => {
    renderShop();

    await waitFor(() => expect(screen.getAllByRole('article').length).toBe(24));
    expect(vi.mocked(productsApi.getAll).mock.calls[0]?.[0]).toMatchObject({ page: 1, page_size: 24 });
    expect(screen.getByRole('button', { name: 'صفحهٔ قبل' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'صفحهٔ بعد' })).toBeEnabled();
  });

  it('reads the page from the URL, so a page of the catalogue can be linked', async () => {
    renderShop('/products?page=3');

    await waitFor(() => expect(screen.getAllByRole('article').length).toBe(24));
    expect(vi.mocked(productsApi.getAll).mock.calls[0]?.[0]).toMatchObject({ page: 3 });
    expect(screen.getByText(/صفحهٔ ۳ از ۳/)).toBeDefined();
  });

  it('moves to the next page with «بعدی», and disables it on the last one', async () => {
    renderShop();

    await waitFor(() => expect(screen.getAllByRole('article').length).toBe(24));
    await userEvent.click(screen.getByRole('button', { name: 'صفحهٔ بعد' }));

    await waitFor(() =>
      expect(vi.mocked(productsApi.getAll).mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 }),
    );
  });

  it('drops the parameter on the first page instead of writing ?page=1', async () => {
    renderShop('/products?page=2');

    await waitFor(() => expect(screen.getAllByRole('article').length).toBe(24));
    await userEvent.click(screen.getByRole('button', { name: 'صفحهٔ قبل' }));

    await waitFor(() =>
      expect(vi.mocked(productsApi.getAll).mock.calls.at(-1)?.[0]).toMatchObject({ page: 1 }),
    );
  });

  it('hides the whole control when everything fits on one page', async () => {
    vi.mocked(productsApi.getAll).mockImplementation(() =>
      Promise.resolve({ data: { ...results(1, 12).data, count: 12 } } as never),
    );
    renderShop();

    await waitFor(() => expect(screen.getAllByRole('article').length).toBe(24));
    expect(screen.queryByRole('navigation', { name: 'صفحه‌بندی کالاها' })).toBeNull();
  });

  it('filters by brand from the URL and names the brand in the chip', async () => {
    renderShop('/products?brand_slug=baghban-pro');

    await waitFor(() =>
      expect(vi.mocked(productsApi.getAll).mock.calls[0]?.[0]).toMatchObject({ brand_slug: 'baghban-pro' }),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'باغبان‌پرو' })).toBeDefined();
    expect(screen.getByRole('button', { name: /برند: باغبان‌پرو/ })).toBeDefined();
  });

  it('passes a tag through and clears both filters with one chip', async () => {
    renderShop('/products?brand_slug=baghban-pro&tag=organic');

    await waitFor(() =>
      expect(vi.mocked(productsApi.getAll).mock.calls[0]?.[0]).toMatchObject({ tag: 'organic' }),
    );

    await userEvent.click(screen.getByRole('button', { name: /برند:/ }));

    await waitFor(() => {
      const last = vi.mocked(productsApi.getAll).mock.calls.at(-1)?.[0];
      expect(last).not.toHaveProperty('brand_slug');
      expect(last).not.toHaveProperty('tag');
    });
  });
});
