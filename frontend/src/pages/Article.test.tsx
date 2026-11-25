// frontend/src/pages/Article.test.tsx
//
// `/articles/:slug/related/` and `/articles/crops/` were both served and both
// uncalled. A magazine with no «بیشتر بخوانید» is a set of pages that happen to
// share a header: a reader who finishes the tomato guide has no route to the
// cucumber one.
//
// The other thing held here: an article with no related pieces and no products
// must not grow two empty sections.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getBySlug = vi.fn();

vi.mock('../api/services', () => ({
  articlesApi: { getBySlug: (...a: unknown[]) => getBySlug(...a) },
  // ProductCard pulls its own services in; it is not under test here.
  productsApi: { getAll: vi.fn(), getFeatured: vi.fn() },
}));

vi.mock('../components/shop/ProductCard', () => ({
  default: ({ product }: { product: { title: string } }) => <p>{product.title}</p>,
}));

import Article from './Article';

const article = (over: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'راهنمای کامل کشت گوجه‌فرنگی گلخانه‌ای',
  slug: 'tomato-growing-guide',
  kind: 'guide',
  kind_label: 'راهنمای کشت',
  excerpt: 'از نشا تا برداشت.',
  body: '<p>بستر، دما و آبیاری.</p>',
  cover_url: '',
  crop: 'گوجه‌فرنگی',
  reading_minutes: 7,
  products: [],
  listings: [],
  related_articles: [],
  headings: [],
  published_at: '2026-11-01T00:00:00+03:30',
  ...over,
});

const relatedRow = {
  id: 2,
  title: 'مدیریت آفات گلخانه',
  slug: 'greenhouse-pests',
  kind: 'guide',
  kind_label: 'راهنمای کشت',
  excerpt: '',
  crop: 'خیار',
  reading_minutes: 5,
  cover_url: '',
  published_at: '2026-11-02T00:00:00+03:30',
};

function renderArticle() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/magazine/tomato-growing-guide']}>
        <Routes>
          <Route path="/magazine/:slug" element={<Article />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getBySlug.mockReset();
  getBySlug.mockResolvedValue({ data: article() });
});

describe('Article', () => {
  it('renders the piece and links on to its related reading', async () => {
    // `related_articles` is in the detail response the page already fetches —
    // no second request, and the page used to throw the field away.
    getBySlug.mockResolvedValue({ data: article({ related_articles: [relatedRow] }) });
    renderArticle();

    expect(await screen.findByText('راهنمای کامل کشت گوجه‌فرنگی گلخانه‌ای')).toBeDefined();

    const link = await screen.findByRole('link', { name: /مدیریت آفات گلخانه/ });
    expect(link).toHaveAttribute('href', '/magazine/greenhouse-pests');
  });

  it('links a guide to the farmers selling the crop it is about', async () => {
    getBySlug.mockResolvedValue({
      data: article({
        listings: [
          {
            id: 5,
            title: 'گوجه گلخانه‌ای تازه',
            slug: 'golhane-tomato',
            crop_name: 'گوجه',
            price: 35000,
            unit: 'کیلوگرم',
            image_url: '',
            storefront_name: 'گلخانه بهاران',
            storefront_slug: 'golhane-baharan',
          },
        ],
      }),
    });
    renderArticle();

    const link = await screen.findByRole('link', { name: /گوجه گلخانه‌ای تازه/ });
    expect(link).toHaveAttribute('href', '/listing/golhane-tomato');
    expect(screen.getByText('گلخانه بهاران')).toBeDefined();
  });

  it('grows no empty section when there is nothing related and nothing to buy', async () => {
    renderArticle();

    await screen.findByText('راهنمای کامل کشت گوجه‌فرنگی گلخانه‌ای');
    expect(screen.queryByText('بیشتر بخوانید')).toBeNull();
    expect(screen.queryByText('کالاهای مرتبط با این نوشته')).toBeNull();
    expect(screen.queryByText('از غرفه‌داران')).toBeNull();
  });

  it('keeps the related list below the products, not above the text', async () => {
    getBySlug.mockResolvedValue({
      data: article({
        products: [{ id: 9, title: 'بذر گوجه گلخانه‌ای', slug: 'tomato-seed' }],
        related_articles: [relatedRow],
      }),
    });
    renderArticle();

    const body = await screen.findByText('بستر، دما و آبیاری.');
    const products = screen.getByText('کالاهای مرتبط با این نوشته');
    const more = screen.getByText('بیشتر بخوانید');
    // Reading order is the reader's order: text, then what it refers to, then
    // where to go next.
    expect(body.compareDocumentPosition(products) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(products.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
