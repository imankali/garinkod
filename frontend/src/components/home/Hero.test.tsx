// frontend/src/components/home/Hero.test.tsx
//
// The hero has two jobs and they must not interfere: it is the page's one
// authored moment (so it has to render exactly as designed when the operator
// has published nothing), and it is the place a seasonal campaign appears (so
// when slides *are* published they must actually reach the page — every one a
// manager scheduled before this change went out to nobody).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.fn();

vi.mock('../../api/services', () => ({
  heroSlidesApi: { list: (...args: unknown[]) => list(...args) },
}));

import Hero from './Hero';

function renderHero() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const slide = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  kicker: 'فصل کشت پاییزه',
  title: 'کود پایه با ارسال رایگان تا پایان آبان',
  body: 'سفارش‌های بالای سقف تعیین‌شده بدون هزینه ارسال می‌شوند.',
  cta_label: 'دیدن کودهای پایه',
  cta_url: '/catalog/category/fertilizer',
  background_url: '',
  gradient: '',
  ...overrides,
});

beforeEach(() => {
  list.mockReset();
  list.mockResolvedValue({ data: [] });
});

describe('Hero campaigns', () => {
  it('renders the designed band untouched when the operator published no slides', async () => {
    renderHero();

    // The current state of the site: nothing scheduled. The page must look
    // exactly as it was designed, with no empty campaign furniture.
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    expect(await screen.findByText('ارسال سراسری')).toBeDefined();
    expect(screen.queryByRole('region', { name: 'پیشنهادهای این فصل' })).toBeNull();
  });

  it('shows a published campaign above the fixed band', async () => {
    list.mockResolvedValue({ data: [slide()] });
    renderHero();

    const campaign = await screen.findByRole('region', { name: 'پیشنهادهای این فصل' });
    expect(campaign).toBeDefined();
    expect(screen.getByText('فصل کشت پاییزه')).toBeDefined();
    expect(screen.getByText('کود پایه با ارسال رایگان تا پایان آبان')).toBeDefined();
    // The authored headline still owns the page.
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
  });

  it('keeps an internal call to action inside the app, and an external one out of it', async () => {
    list.mockResolvedValue({ data: [slide()] });
    renderHero();

    const internal = await screen.findByRole('link', { name: 'دیدن کودهای پایه' });
    expect(internal).toHaveAttribute('href', '/catalog/category/fertilizer');
  });

  it('treats an absolute campaign link as off-site, not as a router path', async () => {
    list.mockResolvedValue({
      data: [slide({ cta_label: 'خبرنامه', cta_url: 'https://example.com/campaign' })],
    });
    renderHero();

    // Operator content is not trusted with the router: a slide pointing at
    // another origin gets rel=nofollow/noopener and opens away from the site.
    const external = await screen.findByRole('link', { name: 'خبرنامه' });
    expect(external).toHaveAttribute('href', 'https://example.com/campaign');
    expect(external).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(external).toHaveAttribute('target', '_blank');
  });

  it('pages through several campaigns without losing the first', async () => {
    list.mockResolvedValue({
      data: [
        slide({ id: 1, title: 'کمپین اول' }),
        slide({ id: 2, title: 'کمپین دوم' }),
      ],
    });
    renderHero();

    expect(await screen.findByText('کمپین اول')).toBeDefined();
    expect(screen.queryByText('کمپین دوم')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'پیشنهاد بعدی' }));
    expect(screen.getByText('کمپین دوم')).toBeDefined();

    // Wraps back around rather than dead-ending.
    await userEvent.click(screen.getByRole('button', { name: 'پیشنهاد بعدی' }));
    expect(screen.getByText('کمپین اول')).toBeDefined();
  });
});
