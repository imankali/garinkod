// frontend/src/pages/ServiceDetail.test.tsx
//
// `farmServicesApi.getBySlug` had no caller. Each of the six services ships a
// 200–500 character body and a cover image, and the only surface was a card
// with a summary — so someone deciding whether to pay for «آزمایش و بهبود خاک»
// got one line.
//
// What these hold:
//   • the body renders as sections, because `## ` is the only markup the
//     content studio produces in it;
//   • the price note is the studio's sentence, printed as-is — the page never
//     computes a number from it;
//   • a slug the API does not know lands on an empty state with a way back,
//     not a blank page.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getBySlug = vi.fn();

vi.mock('../api/services', () => ({
  farmServicesApi: { getBySlug: (...a: unknown[]) => getBySlug(...a) },
}));

import ServiceDetail from './ServiceDetail';

const service = (over: Record<string, unknown> = {}) => ({
  id: 3,
  title: 'آزمایش و بهبود خاک',
  slug: 'ازمایش-و-بهبود-خاک',
  code: 'soil',
  summary: 'نمونه‌برداری، آزمون و برنامهٔ اصلاح.',
  body: '## چه چیزی تحویل می‌گیرید\nنمونه‌برداری از چهار نقطه و گزارش کامل.\n\n## زمان انجام\nپنج روز کاری.',
  highlights: ['گزارش آزمایشگاه', 'برنامهٔ اصلاح خاک'],
  icon: '',
  image: null,
  image_url: 'https://example.test/soil.jpg',
  price_note: 'از ۲ میلیون تومان، بر اساس تعداد نمونه',
  order: 3,
  seo_title: '',
  seo_description: '',
  ...over,
});

function renderAt(slug = 'ازمایش-و-بهبود-خاک') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/services/${slug}`]}>
        <Routes>
          <Route path="/services/:slug" element={<ServiceDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getBySlug.mockReset();
  getBySlug.mockResolvedValue({ data: service() });
});

describe('ServiceDetail', () => {
  it('reads the service the address names', async () => {
    renderAt();

    expect(await screen.findByRole('heading', { name: 'آزمایش و بهبود خاک' })).toBeDefined();
    expect(getBySlug).toHaveBeenCalledWith('ازمایش-و-بهبود-خاک');
  });

  it('renders the body as sections instead of one wall of text', async () => {
    renderAt();

    expect(await screen.findByRole('heading', { name: 'چه چیزی تحویل می‌گیرید' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'زمان انجام' })).toBeDefined();
    expect(screen.getByText(/نمونه‌برداری از چهار نقطه/)).toBeDefined();
    // The raw `##` markers must not survive into the copy.
    expect(screen.queryByText(/#{1,2} /)).toBeNull();
  });

  it('prints the price note as the studio wrote it', async () => {
    renderAt();

    // Not «۲٬۰۰۰٬۰۰۰ تومان»: the page must not turn a sentence into a number.
    expect(await screen.findByText('از ۲ میلیون تومان، بر اساس تعداد نمونه')).toBeDefined();
  });

  it('offers a way back when the slug does not exist', async () => {
    getBySlug.mockRejectedValue({ response: { status: 404 } });
    renderAt('ناشناخته');

    expect(await screen.findByText('این خدمت پیدا نشد')).toBeDefined();
    expect(screen.getByRole('link', { name: 'همهٔ خدمات' })).toHaveAttribute('href', '/services');
  });
});
