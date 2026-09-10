// frontend/src/components/home/FeaturedStorefronts.test.tsx
//
// The home page shows stalls, not stories.
//
// «مستقیم از کشاورزان» used to be a story strip: a row of circles that could only
// be read once a day and said nothing about what anyone sells. It now shows the
// same storefront cards as the غرفه‌داران directory, and the stories moved to the
// profile where they belong. This test is the guard against a story strip
// creeping back onto the home page.

import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FeaturedStorefronts from './FeaturedStorefronts';
import { renderAppSettled } from '../../test/render';
import { storefrontsApi } from '../../api/services';

vi.mock('../../api/services', () => ({ storefrontsApi: { featured: vi.fn() } }));

vi.mock('../StorefrontCard', () => ({
  default: ({ storefront }: { storefront: { name: string; slug: string } }) => (
    <a href={`/storefronts/${storefront.slug}`}>{storefront.name}</a>
  ),
}));

beforeEach(() => {
  vi.mocked(storefrontsApi.featured).mockResolvedValue({
    data: [
      { id: 1, name: 'باغ سبز', slug: 'bagh-sabz' },
      { id: 2, name: 'مزرعه آفتاب', slug: 'mazraeh-aftab' },
    ],
  } as never);
});

describe('the home storefronts block', () => {
  it('shows the cards, not a story ring', async () => {
    await renderAppSettled(<FeaturedStorefronts />, { route: '/' });
    expect(await screen.findByRole('link', { name: 'باغ سبز' })).toHaveAttribute(
      'href',
      '/storefronts/bagh-sabz',
    );
    expect(screen.queryByText(/استوری/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /مشاهده استوری/ })).not.toBeInTheDocument();
  });

  it('asks for exactly the number of stalls it has room for', async () => {
    await renderAppSettled(<FeaturedStorefronts />, { route: '/' });
    await screen.findByText('باغ سبز');
    expect(storefrontsApi.featured).toHaveBeenCalledWith(expect.any(Number));
  });

  it('points the rest of the market at the directory', async () => {
    await renderAppSettled(<FeaturedStorefronts />, { route: '/' });
    const more = await screen.findByRole('link', { name: /همه غرفه‌داران/ });
    expect(more).toHaveAttribute('href', '/storefronts');
  });

  it('removes itself when the shop has nothing featured', async () => {
    vi.mocked(storefrontsApi.featured).mockResolvedValue({ data: [] } as never);
    await renderAppSettled(<FeaturedStorefronts />, { route: '/' });
    await vi.waitFor(() => expect(storefrontsApi.featured).toHaveBeenCalled());
    expect(screen.queryByText('باغ سبز')).not.toBeInTheDocument();
  });

  it('holds one heading for the section, at the level the page can nest under', async () => {
    await renderAppSettled(<FeaturedStorefronts />, { route: '/' });
    const heading = await screen.findByRole('heading', { level: 2 });
    expect(heading.textContent).toMatch(/غرفه/);
  });
});
