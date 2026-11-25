// frontend/src/pages/SitePage.test.tsx
//
// The operator authored «شماره حساب‌های گرین‌کود» — the page that tells a buyer
// which card numbers are legitimate before they pay — and no route rendered it.
// These tests hold the renderer to the blocks the API actually emits, including
// the two shapes that are easy to get wrong: a spec table with no head field,
// and a block type this file has never seen.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getBySlug = vi.fn();

vi.mock('../api/services', () => ({
  sitePagesApi: { getBySlug: (...args: unknown[]) => getBySlug(...args) },
}));

import SitePage from './SitePage';

const block = (over: Record<string, unknown>) => ({
  id: Math.random(),
  block_type: 'text',
  block_type_label: 'متن',
  title: '',
  text: '',
  rows: [] as string[][],
  image: null,
  image_url: '',
  video: null,
  video_url: '',
  link: '',
  data: {},
  position: 0,
  ...over,
});

const page = (blocks: Record<string, unknown>[]) => ({
  data: {
    id: 1,
    title: 'شماره حساب‌های گرین‌کود',
    slug: 'shomare-hesabha',
    kind: 'page',
    kind_label: 'صفحه اطلاعاتی',
    hero_text: 'واریز وجه فقط به شماره حسابی مجاز است که در همان سفارش اعلام شده است.',
    hero_image: null,
    hero_image_url: '',
    badge: '',
    product: null,
    cta_label: '',
    cta_url: '',
    blocks,
    published_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-20T00:00:00Z',
    updated_by: 'مدیر',
    seo_title: '',
    seo_description: '',
  },
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/page/shomare-hesabha']}>
        <Routes>
          <Route path="/page/:slug" element={<SitePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getBySlug.mockReset();
});

describe('SitePage', () => {
  it('renders the page the API returns, block by block', async () => {
    getBySlug.mockResolvedValue(
      page([
        block({ id: 1, block_type: 'heading', title: 'چگونه پرداخت کنیم؟' }),
        block({ id: 2, block_type: 'text', text: 'شماره کارتی که در پیام رسمی سفارش اعلام می‌شود تنها مرجع است.' }),
        block({
          id: 3,
          block_type: 'spec_table',
          title: 'مسیرهای پرداخت',
          rows: [
            ['پرداخت آنلاین', 'درگاه بانکی تأییدشده'],
            ['پرداخت هماهنگی', 'شماره کارت اعلام‌شده در همان سفارش'],
          ],
        }),
      ]),
    );
    renderPage();

    expect(await screen.findByRole('heading', { name: 'شماره حساب‌های گرین‌کود' })).toBeDefined();
    expect(screen.getByText('چگونه پرداخت کنیم؟')).toBeDefined();
    expect(screen.getByText(/تنها مرجع است/)).toBeDefined();
    // No `data.head` in the payload, so these are the operator's rows as
    // written — the first column bolded, no invented column titles.
    expect(screen.getByRole('cell', { name: 'پرداخت آنلاین' })).toBeDefined();
    expect(screen.queryByRole('columnheader')).toBeNull();
  });

  it('does not invent a table header the API did not send', async () => {
    getBySlug.mockResolvedValue(
      page([
        block({
          id: 1,
          block_type: 'spec_table',
          title: 'مسیرها',
          rows: [['گرید A', '۱۲۰٬۰۰۰ تومان']],
          data: {},
        }),
      ]),
    );
    renderPage();

    await screen.findByText('مسیرها');
    // The first data row must stay a row, not become the caption.
    expect(screen.queryByRole('columnheader')).toBeNull();
    expect(screen.getByRole('cell', { name: 'گرید A' })).toBeDefined();
  });

  it('prints an unknown block type rather than dropping it silently', async () => {
    getBySlug.mockResolvedValue(
      page([block({ id: 1, block_type: 'someday_new_type', text: 'متنی که نباید گم شود.' })]),
    );
    renderPage();

    // A page that silently loses a section is worse than one that shows it.
    expect(await screen.findByText('متنی که نباید گم شود.')).toBeDefined();
  });

  it('says the page is missing instead of rendering an empty shell', async () => {
    getBySlug.mockRejectedValue({ response: { status: 404, data: { detail: 'یافت نشد' } } });
    renderPage();

    expect(await screen.findByText('این صفحه پیدا نشد')).toBeDefined();
  });
});
