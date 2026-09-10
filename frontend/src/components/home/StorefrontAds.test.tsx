// frontend/src/components/home/StorefrontAds.test.tsx
//
// The home page's seller rows. The rule this guards is the one that makes an ads
// rail trustworthy: every row asks the server for stock on hand, the discount row
// asks for the discount flag rather than filtering the first page in the browser,
// and a rail with nothing in it does not appear at all.

import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StorefrontAds from './StorefrontAds';
import { renderAppSettled } from '../../test/render';
import { agricultureApi } from '../../api/services';

vi.mock('../../api/services', () => ({ agricultureApi: { listMarketplace: vi.fn() } }));

vi.mock('../MarketplaceListingCard', () => ({
  default: ({ listing, variant }: { listing: { title: string }; variant?: string }) => (
    <div data-testid={`card-${variant ?? 'default'}`}>{listing.title}</div>
  ),
}));

const rows = (count: number) => ({
  data: {
    results: Array.from({ length: count }, (_, index) => ({ id: index, title: `آگهی ${index}` })),
    count,
  },
});

beforeEach(() => {
  vi.mocked(agricultureApi.listMarketplace).mockResolvedValue(rows(2) as never);
});

function renderRails() {
  return renderAppSettled(<StorefrontAds />, { route: '/' });
}

describe('the three rows', () => {
  it('asks for best sellers, discounts and fresh listings in that order', async () => {
    await renderRails();
    await screen.findAllByTestId('card-default');
    const titles = (await screen.findAllByRole('heading')).map(
      (heading) => (heading.textContent ?? '').trim(),
    );
    const at = (needle: string) => titles.findIndex((title) => title.includes(needle));
    expect(at('پرفروش‌ترین محصولات غرفه‌ها')).toBeGreaterThanOrEqual(0);
    expect(at('پرفروش‌ترین')).toBeLessThan(at('پرتخفیف‌ترین'));
    expect(at('پرتخفیف‌ترین')).toBeLessThan(at('جدیدترین آگهی‌ها'));
  });

  it('never offers a sold-out ad on the home page', async () => {
    await renderRails();
    await screen.findAllByTestId('card-default');
    for (const call of vi.mocked(agricultureApi.listMarketplace).mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ in_stock: '1', page: 1 }));
    }
  });

  it('asks for the discount flag instead of filtering the page afterwards', async () => {
    await renderRails();
    await vi.waitFor(() =>
      expect(agricultureApi.listMarketplace).toHaveBeenCalledWith(
        expect.objectContaining({ ordering: '-discount_percent', has_discount: '1' }),
      ),
    );
  });

  it('gives the watermark treatment to the discounted row only', async () => {
    await renderRails();
    await screen.findAllByTestId('card-discount');
    expect(screen.getAllByTestId('card-default')).toHaveLength(4);
    expect(screen.getAllByTestId('card-discount')).toHaveLength(2);
  });

  it('hides a row with nothing in it, heading and link included', async () => {
    vi.mocked(agricultureApi.listMarketplace).mockResolvedValue(rows(0) as never);
    await renderRails();
    // A rail that comes back empty removes its own heading — and the wait is the
    // point: before the requests settle, the skeleton row is still on screen with
    // its heading, so an immediate absence check would pass for the wrong reason.
    await vi.waitFor(
      () => {
        expect(screen.queryByText('پرفروش‌ترین محصولات غرفه‌ها')).not.toBeInTheDocument();
        expect(screen.queryByText('پرتخفیف‌ترین محصولات غرفه‌ها')).not.toBeInTheDocument();
        expect(screen.queryByText('جدیدترین آگهی‌ها')).not.toBeInTheDocument();
      },
      { timeout: 4000 },
    );
    expect(screen.queryByRole('link', { name: /مشاهده همه/ })).not.toBeInTheDocument();
  });

  it('links each row to the same question, filtered in the catalogue', async () => {
    await renderRails();
    const links = await screen.findAllByRole('link', { name: /مشاهده همه/ });
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('/products?source=marketplace'));
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('ordering=-sales_count'));
  });
});
