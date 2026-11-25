// frontend/src/pages/PhotoCheck.test.tsx
//
// `trustApi.visualSearch` was the last buyer-facing endpoint with no caller.
//
// The estimates come from a mean-colour reading of the photograph, so the page
// has to be honest about what it is: a screening hint with a percentage on it.
// These tests hold the two things that keep it from being dangerous — the
// server's own disclaimer is on screen with every result, and the safety notes
// of a suggested input are printed rather than its name alone (spraying is the
// step where being wrong costs a crop).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const visualSearch = vi.fn();

vi.mock('../api/services', () => ({
  trustApi: { visualSearch: (...a: unknown[]) => visualSearch(...a) },
}));

import PhotoCheck from './PhotoCheck';

const diagnosis = {
  status: 'completed',
  key: 'chlorosis_iron_deficiency',
  title: 'کلروز و کمبود عناصر غذایی (به‌ویژه آهن و ازت)',
  category: 'deficiency',
  confidence_score: 0.88,
  confidence_percent: 88,
  symptoms: ['زردی عمومی یا لکه‌ای بین رگبرگ‌ها', 'کاهش شادابی سبزینگی و کلروفیل برگ'],
  treatment_advice: 'مصرف کودهای کلات آهن و NPK و اصلاح بافت یا pH خاک با مشورت کارشناس.',
  image_meta: { width: 800, height: 600, dominant_hue: 'زرد/قهوه‌ای' },
  suggested_inputs: [
    {
      id: 2,
      name: 'سولفات آهن',
      kind: 'fertilizer',
      active_ingredient: 'آهن ۲۰٪',
      safety_notes: 'با سم‌پاشی قارچ‌کش در یک نوبت مخلوط نشود.',
      preharvest_interval_days: null,
    },
  ],
  suggested_products: [
    { id: 7, title: 'کلات آهن', slug: 'iron-chelate', price: 450000, in_stock: true },
  ],
  disclaimer:
    'این ارزیابی هوشمند کمکی است و جایگزین بازدید میدانی کارشناس گیاه‌پزشکی یا آزمون خاک آزمایشگاهی نمی‌شود.',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PhotoCheck />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** A real File the component will accept. */
function photo() {
  return new File([new Uint8Array([1, 2, 3])], 'leaf.jpg', { type: 'image/jpeg' });
}

beforeEach(() => {
  visualSearch.mockReset();
  visualSearch.mockResolvedValue({
    data: {
      request: { id: 1, target: 'pest', status: 'completed', status_label: 'انجام شد', result_payload: {}, created_at: '' },
      diagnosis,
      message: 'تحلیل هوشمند تصویر انجام شد',
    },
  });
});

describe('PhotoCheck', () => {
  it('will not send anything until a photo is chosen', async () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'بررسی عکس' }).hasAttribute('disabled')).toBe(true);
    expect(visualSearch).not.toHaveBeenCalled();
  });

  it('sends the photo and renders the estimate with its caveat', async () => {
    renderPage();

    await userEvent.upload(screen.getByLabelText('عکس برگ'), photo());
    await userEvent.click(screen.getByRole('button', { name: 'بررسی عکس' }));

    await waitFor(() => expect(visualSearch).toHaveBeenCalled());
    expect((visualSearch.mock.calls[0]?.[0] as File).name).toBe('leaf.jpg');

    expect(await screen.findByText(/کلروز و کمبود عناصر غذایی/)).toBeDefined();
    // The heading refuses to call it a diagnosis.
    expect(screen.getByText('برآورد — نه تشخیص')).toBeDefined();
    // And the server's sentence is on screen, not in a footer.
    expect(screen.getByText(/جایگزین بازدید میدانی کارشناس/)).toBeDefined();
  });

  it('prints the safety note of a suggested input, not just its name', async () => {
    renderPage();

    await userEvent.upload(screen.getByLabelText('عکس برگ'), photo());
    await userEvent.click(screen.getByRole('button', { name: 'بررسی عکس' }));

    expect(await screen.findByText('سولفات آهن')).toBeDefined();
    expect(screen.getByText(/با سم‌پاشی قارچ‌کش در یک نوبت مخلوط نشود/)).toBeDefined();
  });

  it('links a suggested product, including one that is out of stock', async () => {
    visualSearch.mockResolvedValue({
      data: {
        request: { id: 1, target: 'pest', status: 'completed', status_label: 'انجام شد', result_payload: {}, created_at: '' },
        diagnosis: {
          ...diagnosis,
          suggested_products: [{ id: 8, title: 'قارچ‌کش مانکوزب', slug: 'mancozeb', price: 120000, in_stock: false }],
        },
        message: '',
      },
    });
    renderPage();

    await userEvent.upload(screen.getByLabelText('عکس برگ'), photo());
    await userEvent.click(screen.getByRole('button', { name: 'بررسی عکس' }));

    const link = await screen.findByRole('link', { name: /قارچ‌کش مانکوزب/ });
    expect(link).toHaveAttribute('href', '/product/mancozeb');
    // An out-of-stock suggestion says so rather than hiding its price behind
    // a number the buyer cannot act on.
    expect(screen.getByText('ناموجود')).toBeDefined();
  });

  it('shows the server’s refusal instead of a blank result column', async () => {
    visualSearch.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: 'فرمت تصویر باید JPG، PNG یا WebP باشد.' }, status: 400 },
    });
    renderPage();

    await userEvent.upload(screen.getByLabelText('عکس برگ'), photo());
    await userEvent.click(screen.getByRole('button', { name: 'بررسی عکس' }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toContain('JPG');
  });
});
