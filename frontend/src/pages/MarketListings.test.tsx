// frontend/src/pages/MarketListings.test.tsx
//
// `/api/marketplace/listings/` served seven live آگهی — crop, harvest date,
// quantity, price per unit — and no page read it. The marketplace could only be
// browsed one stall at a time, so "who has پسته?" required already knowing who
// sells it.
//
// What these hold:
//   • the crop chips come from the server's own facet counts, with the count
//     printed, because a chip with nothing behind it is a dead end;
//   • the crop filter goes out under the parameter the API actually reads
//     (`crop`, not `crop_name` — the latter filters nothing and returns all
//     seven rows);
//   • a price on the card is the server's number, and the strikethrough only
//     appears when the discount is real.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMarketplace = vi.fn();
const listingFacets = vi.fn();

vi.mock('../api/services', () => ({
  agricultureApi: {
    listMarketplace: (...a: unknown[]) => listMarketplace(...a),
    listingFacets: (...a: unknown[]) => listingFacets(...a),
  },
}));

import MarketListings from './MarketListings';

const listing = (over: Record<string, unknown> = {}) => ({
  id: 5,
  title: 'پسته اکبری صادراتی',
  slug: 'پسته-رفسنجان-پسته-اکبری-صادراتی',
  crop_name: 'پسته',
  category_label: 'خشکبار',
  description: '',
  price: 890000,
  discounted_price: 890000,
  discount_percent: 0,
  unit: 'کیلوگرم',
  quantity_available: '800.00',
  min_order_quantity: '5.00',
  harvest_date: '2026-10-01',
  image_url: '',
  is_active: true,
  storefront: { id: 3, name: 'پسته رفسنجان', slug: 'پسته-رفسنجان', is_verified: true, province: 'کرمان' },
  ...over,
});

const results = (rows: unknown[], count = rows.length) => ({ data: { count, results: rows } });

function renderPage(path = '/market') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <MarketListings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listMarketplace.mockReset();
  listingFacets.mockReset();
  listMarketplace.mockResolvedValue(results([listing()]));
  listingFacets.mockResolvedValue({
    data: {
      brands: [],
      categories: [],
      subcategories: [],
      packages: [],
      units: [],
      max_price: 1850000000,
      crops: [
        { value: 'پسته', count: 1 },
        { value: 'پرتقال', count: 2 },
      ],
    },
  });
});

describe('MarketListings', () => {
  it('lists the آگهی with the numbers the server sent', async () => {
    renderPage();

    expect(await screen.findByText('پسته اکبری صادراتی')).toBeDefined();
    // The seller's name travels with the row; the buyer should know who it is.
    expect(screen.getByText('پسته رفسنجان')).toBeDefined();
    expect(screen.getByText('۸۰۰ کیلوگرم موجود')).toBeDefined();
  });

  it('filters by the crop under the parameter the API reads', async () => {
    renderPage();

    const chip = await screen.findByRole('button', { name: /پسته/ });
    await userEvent.click(chip);

    await waitFor(() =>
      expect(listMarketplace.mock.calls.at(-1)?.[0]).toMatchObject({ crop: 'پسته' }),
    );
    // `crop_name` is not a filter the API understands — it returns every row,
    // which looks like a working filter and is not one.
    expect(listMarketplace.mock.calls.at(-1)?.[0]).not.toHaveProperty('crop_name');
  });

  it('prints the facet count next to the crop', async () => {
    renderPage();

    const chip = await screen.findByRole('button', { name: /پرتقال/ });
    // Two rows behind it, as the server counted — not as the page guessed.
    expect(chip.textContent).toContain('۲');
  });

  it('shows a discount only when the server says there is one', async () => {
    listMarketplace.mockResolvedValue(
      results([
        listing({
          price: 1000000,
          discounted_price: 850000,
          discount_percent: 15,
        }),
      ]),
    );
    renderPage();

    await screen.findByText('پسته اکبری صادراتی');
    expect(screen.getByText('۱۵٪')).toBeDefined();
    expect(screen.getByText('۱٬۰۰۰٬۰۰۰ تومان')).toBeDefined();
  });

  it('offers a way out when nothing matches', async () => {
    listMarketplace.mockResolvedValue(results([], 0));
    renderPage();

    expect(await screen.findByText('آگهی‌ای با این مشخصات نیست')).toBeDefined();
    expect(screen.getByRole('link', { name: 'غرفه‌ها' })).toHaveAttribute('href', '/storefronts');
  });

  it('reads the crop from the address, so a link can point at one', async () => {
    renderPage('/market?crop=پسته');

    await waitFor(() =>
      expect(listMarketplace.mock.calls[0]?.[0]).toMatchObject({ crop: 'پسته' }),
    );
    expect(screen.getByRole('heading', { name: 'آگهی‌های پسته' })).toBeDefined();
  });
});
