// frontend/src/App.routes.test.tsx
//
// Every route, mounted for real.
//
// The browser suite cannot run in this sandbox (no Chromium), so this is the only
// place the assembled application meets each page: the real router, the real
// header and footer, the real page component, against a stubbed API. It catches
// what a per-component test cannot — a page that throws on a null response, a
// provider a page assumes, a hook called after an early return, a route wired to
// the wrong component.
//
// `App` renders its own `BrowserRouter`, which reads `window.location`; jsdom lets
// the path be set before the render, so no test-only prop is needed.

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from './api/client';
import App from './App';
import { Providers, createQueryClient } from './providers';

vi.mock('./api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(apiClient.get);

const product = {
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
  price_tiers: [],
};

const storefront = {
  id: 1,
  name: 'غرفهٔ سبز دشت',
  slug: 'sabz-dasht',
  seller_type: 'farmer',
  seller_type_label: 'کشاورز',
  bio: 'کشت گندم و جو در دشت.',
  avatar: null,
  avatar_url: '',
  cover: null,
  cover_url: '',
  province: 'خراسان رضوی',
  city: 'نیشابور',
  is_verified: true,
  is_active: true,
  commission_rate: '5.00',
  rating: '4.5',
  sales_count: 12,
  followers_count: 3,
  listing_count: 1,
  is_following: false,
  is_owner: false,
  has_active_stories: false,
  has_unseen_stories: false,
  owner_name: 'علی رضایی',
  created_at: '2026-01-01T00:00:00Z',
};

const listing = {
  id: 9,
  storefront,
  title: 'گندم دوروم — برداشت آبان',
  slug: 'wheat-durum',
  crop_name: 'گندم',
  description: 'گندم دوروم خشک و بوجاری‌شده.',
  price: 22000,
  unit: 'کیلوگرم',
  quantity_available: '5000.00',
  min_order_quantity: '500.00',
  minimum_order: 500,
  harvest_date: '2026-11-01',
  production_date: null,
  expiry_date: null,
  image: null,
  image_url: '',
  status: 'active',
  status_label: 'فعال',
  is_purchasable: true,
  discount_percent: 0,
  sales_count: 4,
  discounted_price: 22000,
  rejection_reason: '',
  reviewed_at: null,
  attributes: [],
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
};

const article = {
  id: 1,
  title: 'برنامهٔ کوددهی گندم در فصل سرد',
  slug: 'wheat-feed-winter',
  kind: 'guide',
  kind_label: 'راهنمای کشت',
  crop: 'گندم',
  excerpt: 'چه زمانی و چقدر کود بدهیم.',
  cover_url: '',
  reading_minutes: 6,
  author_name: 'کارشناس گرین‌کود',
  views: 120,
  is_featured: false,
  products_count: 0,
};

const page = { count: 1, next: null, previous: null, results: [product] };

/** Answers every endpoint the pages under test can reach. */
function answer(url: string) {
  if (url.includes('/products/') && url.includes('similar')) return [product];
  if (/\/products\/[^/]+\/$/.test(url)) return { ...product, gallery: [], attributes: [], rating_summary: { average: 4.5, reviews_count: 2, distribution: {} } };
  if (url.includes('/products/')) return page;
  if (/\/marketplace\/storefronts\/[^/]+\/profile\/$/.test(url)) {
    return { storefront, listings: [listing], posts: [], stories: [], highlights: [], counts: { listings: 1, followers: 3, posts: 0 } };
  }
  if (url.includes('/marketplace/listings/') && url.match(/listings\/[^/]+\/$/)) return listing;
  if (url.includes('/marketplace/')) return { count: 1, next: null, previous: null, results: [storefront] };
  if (url.includes('/categories/')) return { count: 1, next: null, previous: null, results: [{ id: 1, name: 'کود', slug: 'fertilizer', image: null, product_count: 5 }] };
  if (url.includes('/articles/') && url.match(/articles\/[^/]+\/$/)) {
    return { ...article, body: '<p>متن مقاله</p>', products: [], listings: [], related_articles: [], headings: [], author: null };
  }
  if (url.includes('/articles/')) return [article];
  if (url.includes('/legal/') && url.match(/legal\/[^/]+\/$/)) {
    return { slug: 'terms', title: 'شرایط استفاده', short_title: 'شرایط', group: 'core', group_label: 'پایه', icon: '', summary: 'خلاصه', source: 'code', updated_at: null, url: '', blocks: [], sections: [{ title: 'کلیات', body: 'متن' }] };
  }
  if (url.includes('/legal/')) {
    return {
      groups: [{ id: 'core', label: 'پایه', items: [{ slug: 'terms', title: 'شرایط استفاده', short_title: 'شرایط', group: 'core', group_label: 'پایه', icon: '', summary: 'خلاصه', source: 'code', updated_at: null, url: '' }] }],
      documents: [{ slug: 'terms', title: 'شرایط استفاده', short_title: 'شرایط', group: 'core', group_label: 'پایه', icon: '', summary: 'خلاصه', source: 'code', updated_at: null, url: '' }],
      version: 'v1',
    };
  }
  if (url.includes('/catalog/index/')) {
    return {
      categories: [{ kind: 'category', title: 'سموم', slug: 'pesticide', image_url: '', description: '', count: 5, url: '' }],
      tags: [],
      brands: [{ kind: 'brand', title: 'کیمیا سبز', slug: 'kimia', image_url: '', description: '', count: 3, url: '' }],
    };
  }
  if (url.includes('/catalog/landing/')) {
    return {
      kind: 'category', title: 'سموم دفع آفات', slug: 'pesticide', description: 'توضیح', image_url: '', seo_title: '', seo_description: '',
      breadcrumb: [{ title: 'فروشگاه', url: '/products' }], filters: { category: 'pesticide' }, children: [], siblings: [],
      count: 1, avg_rating: 4.2,
      facets: { brands: [], packages: [], price: { min: 0, max: 0, average: 0 }, has_expiring_soon: false },
      articles: [],
    };
  }
  if (url.includes('/site/contact/')) {
    return { address: 'تهران', provinces_note: '', phones: ['02100000000'], emails: ['a@b.ir'], working_hours: '۹ تا ۱۷', whatsapp_number: '', telegram_url: '', instagram_url: '', eitaa_url: '', map_lat: null, map_lng: null, map_note: '', expert_name: 'رضا', expert_role: 'کارشناس', expert_photo: null, expert_photo_url: '', expert_note: '', updated_at: '' };
  }
  if (url.includes('/site/policies/')) {
    return {
      return_window_days: 7,
      return_window_label: '۷ روز ضمانت بازگشت کالا',
      return_conditions: 'کالا باید بازنکرده و سالم باشد.',
      express_shipping: { enabled: false, fee: 0 },
      updated_at: '',
    };
  }
  if (url.includes('/site/about/')) {
    return { team: [], brands: [], stats: { products: 32, storefronts: 5, listings: 7, articles: 10, orders: 0, provinces: 6 }, contact: { address: '', provinces_note: '', phones: [], emails: [], working_hours: '', whatsapp_number: '', telegram_url: '', instagram_url: '', eitaa_url: '', map_lat: null, map_lng: null, map_note: '', expert_name: '', expert_role: '', expert_photo: null, expert_photo_url: '', expert_note: '', updated_at: '' } };
  }
  if (url.includes('/services/catalog/')) return [];
  if (url.includes('/cart/')) {
    // One line in the basket, so checkout renders its form rather than the
    // "empty basket" state (which is asserted separately).
    return {
      id: 1,
      items: [
        {
          id: 1, kind: 'product', product, listing: null, title: product.title,
          quantity: 1, unit_price: 327250, total_price: 327250,
          available_quantity: 150, min_order_quantity: 1, is_in_stock: true,
        },
      ],
      total_price: 327250,
      total_items: 1,
      created_at: '',
      updated_at: '',
    };
  }
  if (url.includes('/auth/session/')) {
    // Signed in, so /account and /orders render their real pages instead of the
    // signed-out empty state.
    return {
      user: { id: 1, username: 'buyer', email: 'buyer@example.com', first_name: 'مریم', last_name: 'احمدی' },
      account: {
        id: 1, username: 'buyer', email: 'buyer@example.com', full_name: 'مریم احمدی',
        phone: '09120000000', phone_verified_at: null, gender: 'female', address: 'تهران',
        avatar: null, avatar_url: '', level: 1, level_label: 'خریدار', level_short_label: 'خریدار',
        has_storefront: false, created: '', updated: '',
      },
    };
  }
  if (url.includes('/orders/')) return [];
  if (url.includes('/affiliate/')) return { profile: null, conversions: [], ledger: [] };
  return {};
}

beforeEach(() => {
  get.mockImplementation((url: string) => Promise.resolve({ data: answer(url) }) as never);
});

afterEach(() => {
  get.mockReset();
  window.history.replaceState({}, '', '/');
});

function renderAt(path: string) {
  window.history.replaceState({}, '', path);
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <Providers client={client}>
      <App />
    </Providers>,
  );
}

/** Routes that must paint a heading, and the text that heading carries. */
const CASES: Array<{ path: string; heading: RegExp }> = [
  { path: '/', heading: /نهاده‌های کشاورزی/ },
  { path: '/products', heading: /فروشگاه گرین‌کود/ },
  { path: '/product/glyphosate-41-1l', heading: /گلایفوزیت/ },
  { path: '/offers', heading: /تخفیف‌های فعال/ },
  { path: '/storefronts', heading: /بازار کشاورزان/ },
  { path: '/storefront/sabz-dasht', heading: /غرفهٔ سبز دشت/ },
  { path: '/listing/wheat-durum', heading: /گندم دوروم/ },
  { path: '/services', heading: /خدمات کشاورزی/ },
  { path: '/farmers', heading: /محصولت را مستقیم بفروش/ },
  { path: '/magazine', heading: /مجلهٔ کشاورزی/ },
  { path: '/magazine/wheat-feed-winter', heading: /برنامهٔ کوددهی گندم/ },
  { path: '/support', heading: /پشتیبانی/ },
  { path: '/about', heading: /گرین‌کود، فروشگاه نهاده/ },
  { path: '/contact', heading: /تماس با گرین‌کود/ },
  { path: '/legal', heading: /اسناد و شرایط/ },
  { path: '/legal/terms', heading: /شرایط استفاده/ },
  { path: '/brands', heading: /برندها و مسیرهای کاتالوگ/ },
  { path: '/catalog/category/pesticide', heading: /سموم دفع آفات/ },
  { path: '/track', heading: /پیگیری سفارش/ },
  { path: '/login', heading: /ورود به گرین‌کود/ },
  { path: '/account', heading: /مریم احمدی/ },
  { path: '/orders', heading: /سفارش‌های من/ },
  { path: '/checkout', heading: /تسویه حساب/ },
  { path: '/affiliate', heading: /همکاری در فروش/ },
  { path: '/no-such-page', heading: /این نشانی وجود ندارد/ },
];

describe('every route renders', () => {
  it.each(CASES)('$path paints «$heading»', async ({ path, heading }) => {
    renderAt(path);

    await waitFor(
      () => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading),
      { timeout: 4000 },
    );

    // The crash boundary's copy must never be what the visitor sees.
    expect(screen.queryByText('این صفحه باز نشد')).not.toBeInTheDocument();
  });
});
