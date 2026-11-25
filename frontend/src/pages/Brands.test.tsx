// frontend/src/pages/Brands.test.tsx
//
// The brand index is the page every brand has to be reachable from. A brand is
// not the same animal as a department: its products are a \`brand_slug\` filter on
// the shop, so linking it into the catalogue landing route would have produced a
// page whose grid asks the wrong endpoint. One test holds that, and one holds the
// ordinary case beside it.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/services', () => ({
  catalogApi: { index: vi.fn() },
}));

import { catalogApi } from '../api/services';
import Brands from './Brands';
import { createQueryClient, Providers } from '../providers';

const card = (kind: 'brand' | 'category' | 'tag' | 'subcategory', title: string, slug: string) => ({
  kind,
  title,
  slug,
  image_url: '',
  description: '',
  count: 3,
  url: '',
});

const renderBrands = () =>
  render(
    <Providers client={createQueryClient()}>
      <MemoryRouter>
        <Brands />
      </MemoryRouter>
    </Providers>,
  );

beforeEach(() => {
  vi.mocked(catalogApi.index).mockResolvedValue({
    data: {
      brands: [card('brand', 'باغبان‌پرو', 'baghban-pro')],
      categories: [card('category', 'سموم دفع آفات', 'pesticide')],
      tags: [card('tag', 'ارگانیک', 'organic')],
    },
  } as never);
});

describe('Brands index', () => {
  it('links a brand to the shop filtered by that brand', async () => {
    renderBrands();

    const link = await screen.findByRole('link', { name: /باغبان‌پرو/ });
    expect(link).toHaveAttribute('href', '/products?brand_slug=baghban-pro');
  });

  it('links a department and a tag to their catalogue landing pages', async () => {
    renderBrands();

    expect(await screen.findByRole('link', { name: /سموم دفع آفات/ })).toHaveAttribute(
      'href',
      '/catalog/category/pesticide',
    );
    expect(screen.getByRole('link', { name: /ارگانیک/ })).toHaveAttribute('href', '/catalog/tag/organic');
  });
});
