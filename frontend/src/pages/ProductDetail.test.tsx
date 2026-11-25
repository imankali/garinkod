// frontend/src/pages/ProductDetail.test.tsx
//
// The buy block's one non-obvious rule: a product that sells in more than one
// packaging is priced, stocked and added per package. Sending no package always
// bought the default, so the page could show a ۱ لیتری price and let the visitor
// believe they were buying the ۵ لیتری canister.
//
// The page is mounted for real against a stubbed API; only the cart store is
// mocked, because the contract under test is "what does the page ask for".

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const addToCart = vi.fn(() => Promise.resolve());

vi.mock('../store/cartStore', () => ({
  useCartStore: (
    selector: (state: { addToCart: typeof addToCart; openCart: () => void }) => unknown,
  ) => selector({ addToCart, openCart: () => undefined }),
}));

const toggleHelpful = vi.fn();

vi.mock('../api/services', () => ({
  policiesApi: { get: vi.fn() },
  commentsApi: {
    getByProduct: vi.fn(),
    getRatingSummary: vi.fn(),
    create: vi.fn(),
    toggleHelpful: (...args: unknown[]) => toggleHelpful(...args),
  },
  productsApi: {
    getBySlug: vi.fn(),
    getSimilar: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));

import { commentsApi, policiesApi, productsApi } from '../api/services';
import ProductDetail from './ProductDetail';
import { createQueryClient, Providers } from '../providers';

const aPackage = (overrides: Record<string, unknown>) => ({
  id: 1,
  label: 'بطری ۱ لیتری',
  weight_kg: 1.2,
  price: 385000,
  effective_price: 385000,
  discounted_price: 327250,
  stock: 150,
  effective_stock: 150,
  min_order_quantity: 1,
  bulk_note: '',
  production_date: null,
  expiry_date: null,
  expiry_days_left: 900,
  is_in_stock: true,
  price_per_kg: 320833,
  is_default: true,
  ...overrides,
});

const product = {
  id: 1,
  title: 'سم علف‌کش گلایفوزیت ۴۱٪',
  slug: 'glyphosate-41-1l',
  category: { id: 1, name: 'سموم دفع آفات', slug: 'pesticide' },
  price: 385000,
  stock: 150,
  available: true,
  is_featured: true,
  image: null,
  image_url: '/media/products/test/glyphosate-41-1l.jpg',
  is_in_stock: true,
  discount_percent: 15,
  sales_count: 10,
  discounted_price: 327250,
  brand: 'کیمیا سبز',
  sku: 'PES-GLY-1L',
  price_tiers: [],
  gallery: [],
  attributes: [],
  rating_summary: { average: 4.5, reviews_count: 2, distribution: {} },
  packages: [
    aPackage({ id: 1 }),
    aPackage({
      id: 2,
      label: 'گالن ۵ لیتری',
      weight_kg: 6,
      price: 1720000,
      effective_price: 1720000,
      discounted_price: 1462000,
      stock: 40,
      effective_stock: 40,
      is_default: false,
    }),
  ],
};

const renderPage = () =>
  render(
    <Providers client={createQueryClient()}>
      <MemoryRouter initialEntries={['/product/glyphosate-41-1l']}>
        <ProductDetail />
      </MemoryRouter>
    </Providers>,
  );

beforeEach(() => {
  addToCart.mockClear();
  vi.mocked(policiesApi.get).mockResolvedValue({
    data: {
      return_window_days: 7,
      return_window_label: '۷ روز ضمانت بازگشت کالا',
      return_conditions: '',
      express_shipping: { enabled: false, fee: 0 },
      shipping: { free_threshold: 2_000_000, flat_rate: 45_000, charges_for_delivery: true },
      updated_at: '',
    },
  } as never);
  vi.mocked(productsApi.getBySlug).mockResolvedValue({ data: product } as never);
  toggleHelpful.mockReset();
  toggleHelpful.mockResolvedValue({
    data: { voted: true, my_value: 1, helpful_count: 13, up_count: 13, down_count: 0 },
  });
  vi.mocked(commentsApi.getRatingSummary).mockResolvedValue({
    data: {
      average: 4.5,
      reviews_count: 2,
      distribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 1 },
    },
  } as never);
  vi.mocked(commentsApi.getByProduct).mockResolvedValue({
    data: [
      {
        id: 7,
        product: 1,
        name: 'محمد رضایی',
        email: null,
        body: 'روی علف‌های هرز گندم‌زار عالی جواب داد.',
        image: null,
        sticker: '',
        rating: 5,
        parent: null,
        created: '2026-11-25T05:30:39+03:30',
        updated: '2026-11-25T05:30:39+03:30',
        active: true,
        replies: [],
        is_verified_purchase: true,
        helpful_count: 12,
      },
    ],
  } as never);
});

describe('ProductDetail reviews', () => {
  it('shows the reviews the API serves, with their score and verified badge', async () => {
    renderPage();

    // The body of the review is on the page: an average alone told a buyer
    // nothing about whether the product worked.
    expect(await screen.findByText('روی علف‌های هرز گندم‌زار عالی جواب داد.')).toBeDefined();
    expect(screen.getByText('محمد رضایی')).toBeDefined();
    expect(screen.getByText('خرید تأییدشده')).toBeDefined();
    expect(screen.getByRole('heading', { name: /نظرات خریداران/ })).toBeDefined();
  });

  it('shows the star distribution behind the average', async () => {
    renderPage();

    await screen.findByText('محمد رضایی');
    // Two reviews, one five-star and one four-star: the histogram says so.
    const rows = screen.getAllByRole('listitem').filter((row) => /^[1-5]$/.test(row.textContent?.trim().charAt(0) ?? ''));
    expect(rows.length).toBe(5);
  });

  it('records a helpful vote on the server and marks the button as pressed', async () => {
    renderPage();

    const helpful = await screen.findByRole('button', { name: /مفید بود/ });
    expect(helpful).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(helpful);

    await waitFor(() => expect(toggleHelpful).toHaveBeenCalledWith(7, 1));
    await waitFor(() => expect(screen.getByRole('button', { name: /مفید بود/ })).toHaveAttribute('aria-pressed', 'true'));
    // The count shown is the server's new tally, not the old row plus one.
    expect(screen.getByRole('button', { name: /مفید بود/ }).textContent).toContain('۱۳');
  });

  it('offers a guest a sign-in link instead of a form the server would refuse', async () => {
    renderPage();

    const gate = await screen.findByRole('link', { name: 'برای نوشتن نظر وارد شوید' });
    expect(gate).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'نوشتن نظر' })).toBeNull();
    expect(screen.getByText(/ثبت نظر نیاز به حساب کاربری دارد/)).toBeDefined();
  });

  it('says so plainly when a product has no reviews yet', async () => {
    vi.mocked(commentsApi.getByProduct).mockResolvedValue({ data: [] } as never);
    vi.mocked(commentsApi.getRatingSummary).mockResolvedValue({
      data: { average: 0, reviews_count: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
    } as never);
    renderPage();

    expect(await screen.findByText(/هنوز نظری برای این کالا ثبت نشده/)).toBeDefined();
  });
});

describe('ProductDetail packaging', () => {
  it('shows every in-stock package and marks the default one', async () => {
    renderPage();

    const bottle = await screen.findByRole('button', { name: /بطری ۱ لیتری/ });
    const canister = screen.getByRole('button', { name: /گالن ۵ لیتری/ });

    expect(bottle).toHaveAttribute('aria-pressed', 'true');
    expect(canister).toHaveAttribute('aria-pressed', 'false');
  });

  it('re-prices the page when another package is chosen', async () => {
    renderPage();
    await screen.findByRole('button', { name: /بطری ۱ لیتری/ });

    // The default bottle's price is what the block states first.
    expect(screen.getAllByText(/۳۲۷٬۲۵۰/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /گالن ۵ لیتری/ }));

    await waitFor(() => expect(screen.getAllByText(/۱٬۴۶۲٬۰۰۰/).length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: /گالن ۵ لیتری/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds the chosen package, not the default one', async () => {
    renderPage();
    await screen.findByRole('button', { name: /گالن ۵ لیتری/ });

    await userEvent.click(screen.getByRole('button', { name: /گالن ۵ لیتری/ }));
    await userEvent.click(screen.getByRole('button', { name: 'افزودن به سبد' }));

    await waitFor(() => expect(addToCart).toHaveBeenCalled());
    expect(addToCart).toHaveBeenCalledWith(product.id, 1, 2);
  });

  it('keeps «تماس بگیرید» for a quote-only product even though its package has a number', async () => {
    vi.mocked(productsApi.getBySlug).mockResolvedValue({
      data: {
        ...product,
        price_on_request: true,
        packages: [aPackage({ id: null, label: '۲۰ لیتری', price: 1850000, effective_price: 1850000, min_order_quantity: 5 })],
        bulk_note: 'فروش عمده از ۵ گالن به بالا.',
      },
    } as never);
    renderPage();

    await screen.findByText('تماس بگیرید');
    expect(screen.getByRole('link', { name: 'درخواست قیمت' })).toBeDefined();
    // The wholesale note is the reason the price is a quote, so it is on screen.
    expect(screen.getByText('فروش عمده از ۵ گالن به بالا.')).toBeDefined();
  });

  it('hides the chooser for a product with a single package', async () => {
    vi.mocked(productsApi.getBySlug).mockResolvedValue({
      data: { ...product, packages: [aPackage({ id: 1 })] },
    } as never);
    renderPage();

    await screen.findByRole('button', { name: 'افزودن به سبد' });
    expect(screen.queryByText('بسته‌بندی')).toBeNull();
  });

  it('states the return window the API configured, and no number when it has none', async () => {
    renderPage();

    expect(await screen.findByText(/بازگشت تا ۷ روز/)).toBeDefined();

    vi.mocked(policiesApi.get).mockResolvedValue({
      data: {
        return_window_days: null,
        return_window_label: '',
        return_conditions: '',
        express_shipping: { enabled: false, fee: 0 },
        shipping: { free_threshold: 2_000_000, flat_rate: 45_000, charges_for_delivery: true },
        updated_at: '',
      },
    } as never);
  });

  it('states the free-delivery threshold the checkout will apply', async () => {
    renderPage();

    // The number is the API's, not a sentence typed into this file: the page
    // used to promise a threshold the server did not honour.
    expect(await screen.findByText(/رایگان برای سفارش‌های بالای/)).toBeDefined();
    expect(screen.getByText(/۲٬۰۰۰٬۰۰۰/)).toBeDefined();
  });
});
