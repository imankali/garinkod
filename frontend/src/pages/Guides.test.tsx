// frontend/src/pages/Guides.test.tsx
//
// `/articles/guides/` and `/guides/index/` both served data nothing read.
// The magazine mixes news with guides, and `related_articles` only reaches the
// neighbours of the piece you are already on — so «راهنمای گندم دارید؟» had no
// destination.
//
// What these hold:
//   • the guides page lists only what `/articles/guides/` returned, not the
//     mixed magazine feed;
//   • a department with `guide_count: 0` is stated as uncovered and is not
//     turned into a link — the seeded index really does report six departments
//     with zero guides, and pretending otherwise would be the exact overstatement
//     this page exists to avoid;
//   • the crop filter is local and reverses, so a crop link cannot strand a
//     visitor on an empty list with no way back.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getGuides = vi.fn();
const getGrowingIndex = vi.fn();

vi.mock('../api/services', () => ({
  articlesApi: { getGuides: (...a: unknown[]) => getGuides(...a) },
  siteInfoApi: { getGrowingIndex: (...a: unknown[]) => getGrowingIndex(...a) },
}));

import Guides from './Guides';

const guide = (over: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'راهنمای کامل کشت گوجه‌فرنگی گلخانه‌ای',
  slug: 'tomato-growing-guide',
  kind: 'guide',
  kind_label: 'راهنمای کشت',
  excerpt: 'از انتخاب بذر هیبرید تا برداشت.',
  crop: 'گوجه‌فرنگی',
  cover: null,
  cover_url: '',
  author_name: 'کارشناس',
  reading_minutes: 7,
  products_count: 3,
  is_featured: false,
  published_at: '2026-11-20T00:00:00+03:30',
  updated_at: '2026-11-20T00:00:00+03:30',
  views: 12,
  ...over,
});

function renderPage(path = '/guides') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Guides />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getGuides.mockReset();
  getGrowingIndex.mockReset();
  getGuides.mockResolvedValue({
    data: [
      guide(),
      guide({ id: 2, title: 'راهنمای تغذیه گندم', slug: 'wheat-fertilizing-guide', crop: 'گندم' }),
    ],
  });
  getGrowingIndex.mockResolvedValue({
    data: {
      categories: [
        { name: 'کود کشاورزی', slug: 'fertilizer', product_count: 5, guide_count: 1 },
        { name: 'آبیاری', slug: 'irrigation', product_count: 5, guide_count: 0 },
      ],
      crops: [
        { crop: 'گندم', guide_count: 1 },
        { crop: 'گوجه‌فرنگی', guide_count: 1 },
      ],
    },
  });
});

describe('Guides', () => {
  it('lists the growing guides, not the whole magazine', async () => {
    renderPage();

    expect(await screen.findByText('راهنمای کامل کشت گوجه‌فرنگی گلخانه‌ای')).toBeDefined();
    expect(screen.getByText('راهنمای تغذیه گندم')).toBeDefined();
    expect(getGuides).toHaveBeenCalled();
  });

  it('links a guide to its article page', async () => {
    renderPage();

    const link = await screen.findByRole('link', {
      name: /راهنمای کامل کشت گوجه‌فرنگی گلخانه‌ای/,
    });
    expect(link).toHaveAttribute('href', '/magazine/tomato-growing-guide');
  });

  it('says which department has no guide instead of implying coverage', async () => {
    renderPage();

    // `guide_count` is 0 for آبیاری: the copy must admit it, not hide the shelf.
    expect(await screen.findByText(/هنوز برای آبیاری راهنمایی نوشته نشده است/)).toBeDefined();
    // The covered department is a link; the uncovered one is only named in text.
    expect(screen.getByRole('link', { name: 'کود کشاورزی' })).toHaveAttribute(
      'href',
      '/catalog/category/fertilizer',
    );
    expect(screen.queryByRole('link', { name: 'آبیاری' })).toBeNull();
  });

  it('filters to one crop from the address', async () => {
    renderPage('/guides?crop=گندم');

    expect(await screen.findByText('راهنمای تغذیه گندم')).toBeDefined();
    // The other crop's guide is filtered out locally — no second request.
    expect(screen.queryByText('راهنمای کامل کشت گوجه‌فرنگی گلخانه‌ای')).toBeNull();
    expect(getGuides).toHaveBeenCalledTimes(1);
  });

  it('lets the visitor back out of a crop with no guides', async () => {
    getGuides.mockResolvedValue({ data: [guide()] });
    renderPage('/guides?crop=پسته');

    expect(await screen.findByText('برای پسته راهنمایی نیست')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'همهٔ راهنماها' }));

    // Back to the full list, not to a dead end.
    await waitFor(() =>
      expect(screen.getByText('راهنمای کامل کشت گوجه‌فرنگی گلخانه‌ای')).toBeDefined(),
    );
  });
});
