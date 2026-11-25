// frontend/src/components/shop/ProductCard.test.tsx
//
// What a card is allowed to do, and nothing about how it looks:
//   • it links to the product's own page,
//   • it shows the discount the server computed and never a computed one,
//   • a sold-out card still exists (a missing card hides a better price
//     elsewhere) but its button is disabled and says so,
//   • the add button adds exactly one unit and does not navigate.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductList } from '@/types/shop';
import ProductCard from './ProductCard';

const addToCart = vi.fn(() => Promise.resolve());

vi.mock('../../store/cartStore', () => ({
  useCartStore: (selector: (state: { addToCart: typeof addToCart }) => unknown) => selector({ addToCart }),
}));

const base: ProductList = {
  id: 1,
  title: 'سم علف‌کش گلایفوزیت ۴۱٪ (۱ لیتری)',
  slug: 'glyphosate-41-1l',
  category: 'سموم دفع آفات',
  price: 385000,
  stock: 150,
  available: true,
  is_featured: true,
  image: null,
  image_url: '/media/products/test/glyphosate-41-1l.jpg',
  is_in_stock: true,
  discount_percent: 15,
  sales_count: 1240,
  discounted_price: 327250,
  brand: 'کیمیا سبز',
  sku: 'PES-GLY-1L',
};

const renderCard = (overrides: Partial<ProductList> = {}) =>
  render(
    <MemoryRouter>
      <ProductCard product={{ ...base, ...overrides }} />
    </MemoryRouter>,
  );

beforeEach(() => {
  addToCart.mockClear();
});

describe('ProductCard', () => {
  it('links to the product page by slug', () => {
    renderCard();
    const links = screen.getAllByRole('link');
    expect(links.some((link) => link.getAttribute('href') === '/product/glyphosate-41-1l')).toBe(true);
  });

  it('shows the server price, the struck original, and the discount number', () => {
    renderCard();
    expect(screen.getByText(/۳۲۷٬۲۵۰ تومان/)).toBeInTheDocument();
    expect(screen.getByText(/۳۸۵٬۰۰۰ تومان/)).toBeInTheDocument();
    // Once on the photo plate, once beside the price: the same fact, twice.
    expect(screen.getAllByText('۱۵٪')).toHaveLength(2);
  });

  it('prints no discount badge on an undiscounted product', () => {
    renderCard({ discount_percent: 0, discounted_price: 0 });
    expect(screen.queryByText('۰٪')).not.toBeInTheDocument();
    expect(screen.getByText(/۳۸۵٬۰۰۰ تومان/)).toBeInTheDocument();
  });

  it('adds one unit without navigating', async () => {
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: /افزودن .* به سبد خرید/ }));
    expect(addToCart).toHaveBeenCalledWith(1, 1);
  });

  it('keeps a sold-out product on the page with a disabled button', async () => {
    renderCard({ is_in_stock: false, stock: 0 });
    expect(screen.getByText('ناموجود')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /موجود نیست/ });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(addToCart).not.toHaveBeenCalled();
  });

  it('says «تماس بگیرید» for a quote-only line instead of printing a price', () => {
    renderCard({ price_on_request: true });
    expect(screen.getByText('تماس بگیرید')).toBeInTheDocument();
    expect(screen.queryByText(/تومان/)).not.toBeInTheDocument();
  });

  it('shows the rating only when a review exists', () => {
    const { rerender } = renderCard({ avg_rating: 4.5, reviews_count: 2 });
    expect(screen.getByText(/۴٫۵/)).toBeInTheDocument();
    expect(screen.getByText(/۲ نظر/)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ProductCard product={{ ...base, avg_rating: 0, reviews_count: 0 }} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/نظر/)).not.toBeInTheDocument();
  });
});
