// frontend/src/pages/Calculator.test.tsx
//
// Two things matter here. The arithmetic must be the server's — the page never
// multiplies an area by a rate it was handed, because a browser that disagrees
// with the label is a safety problem, not a rounding difference. And the
// warnings must be visible before the number, including the one that says the
// calculation does not replace an expert.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const inputs = vi.fn();
const crops = vi.fn();
const calculate = vi.fn();

vi.mock('../api/services', () => ({
  agriApi: {
    inputs: (...a: unknown[]) => inputs(...a),
    crops: (...a: unknown[]) => crops(...a),
    calculate: (...a: unknown[]) => calculate(...a),
  },
}));

import Calculator from './Calculator';

const urea = {
  id: 1,
  name: 'اوره',
  slug: 'اوره',
  kind: 'fertilizer',
  kind_label: 'کود',
  active_ingredient: 'نیتروژن ۴۶٪',
  formulation: 'گرانول',
  unit: 'کیلوگرم',
  product: null,
  product_slug: '',
  safety_notes: 'مصرف بیش از حد اوره باعث آبشویی نیترات می‌شود.',
  preharvest_interval_days: null,
  doses: [
    {
      id: 4,
      crop_name: 'برنج',
      target: 'تأمین نیتروژن',
      basis: 'per_hectare',
      basis_label: 'به ازای هکتار',
      min_rate: '100.000',
      max_rate: '150.000',
      rate_unit: 'کیلوگرم',
      notes: '',
    },
  ],
};

const result = {
  input: { id: 1, name: 'اوره', kind: 'fertilizer' },
  crop: 'برنج',
  target: 'تأمین نیتروژن',
  area: { value: '2', unit: 'hectare', unit_label: 'هکتار', hectares: '2.0000' },
  rate: { min: '100.000', max: '150.000', unit: 'کیلوگرم', basis: 'per_hectare', basis_label: 'به ازای هکتار' },
  total: { min: '200.000', max: '300.000', unit: 'کیلوگرم' },
  notes: 'در سه نوبت و همراه با مدیریت آب.',
  warnings: [
    'مصرف بیش از حد اوره باعث آبشویی نیترات و آلودگی آب زیرزمینی می‌شود؛ مصرف را تقسیط کنید.',
    'این محاسبه راهنماست و جایگزین توصیه کارشناس گیاه‌پزشکی یا آزمون خاک نیست.',
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Calculator />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  inputs.mockReset();
  crops.mockReset();
  calculate.mockReset();
  inputs.mockResolvedValue({ data: { count: 1, results: [urea] } });
  crops.mockResolvedValue({ data: { results: ['برنج', 'گندم', 'خیار'] } });
  calculate.mockResolvedValue({ data: result });
});

describe('Calculator', () => {
  it('offers only the crops the chosen input is registered for', async () => {
    renderPage();

    await screen.findByRole('option', { name: 'اوره' });
    await userEvent.selectOptions(screen.getByLabelText('نهاده'), '1');

    // «گندم» and «خیار» exist in the crop list but have no dose for urea;
    // offering them would produce an error the farmer cannot act on.
    await waitFor(() => expect(screen.getByRole('option', { name: 'برنج' })).toBeDefined());
    expect(screen.queryByRole('option', { name: 'گندم' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'خیار' })).toBeNull();
  });

  it('prints the server’s totals and never recomputes them', async () => {
    renderPage();

    await screen.findByRole('option', { name: 'اوره' });
    await userEvent.selectOptions(screen.getByLabelText('نهاده'), '1');
    await screen.findByRole('option', { name: 'برنج' });
    await userEvent.selectOptions(screen.getByLabelText('محصول'), 'برنج');
    await userEvent.type(screen.getByLabelText('مساحت'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'محاسبه' }));

    // The total is split across nodes by the unit span, so match on the label
    // and assert the numbers separately.
    expect(await screen.findByText(/مقدار برای ۲ هکتار/)).toBeDefined();
    expect(screen.getByText('200.000 – 300.000', { exact: false })).toBeDefined();
    expect(calculate.mock.calls[0]?.[0]).toEqual({
      input_id: 1,
      crop: 'برنج',
      area: 2,
      area_unit: 'hectare',
    });
    // The area is echoed back as the server understood it.
    expect(screen.getByText(/مقدار برای ۲ هکتار/)).toBeDefined();
    expect(screen.getByText(/معادل ۲ هکتار/)).toBeDefined();
  });

  it('shows the warnings, including the one that limits the whole answer', async () => {
    renderPage();

    await screen.findByRole('option', { name: 'اوره' });
    await userEvent.selectOptions(screen.getByLabelText('نهاده'), '1');
    await screen.findByRole('option', { name: 'برنج' });
    await userEvent.selectOptions(screen.getByLabelText('محصول'), 'برنج');
    await userEvent.type(screen.getByLabelText('مساحت'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'محاسبه' }));

    expect(await screen.findByText(/جایگزین توصیه کارشناس گیاه‌پزشکی/)).toBeDefined();
    expect(screen.getByText(/آبشویی نیترات/)).toBeDefined();
  });

  it('keeps the calculate button inert until the three inputs exist', async () => {
    renderPage();

    await screen.findByRole('option', { name: 'اوره' });
    expect(screen.getByRole('button', { name: 'محاسبه' }).hasAttribute('disabled')).toBe(true);

    await userEvent.selectOptions(screen.getByLabelText('نهاده'), '1');
    await screen.findByRole('option', { name: 'برنج' });
    await userEvent.selectOptions(screen.getByLabelText('محصول'), 'برنج');
    await userEvent.type(screen.getByLabelText('مساحت'), '2');

    expect(screen.getByRole('button', { name: 'محاسبه' }).hasAttribute('disabled')).toBe(false);
  });

  it('says so when the input table is empty instead of showing a dead form', async () => {
    inputs.mockResolvedValue({ data: { count: 0, results: [] } });
    renderPage();

    expect(await screen.findByText('جدول نهاده‌ها خالی است')).toBeDefined();
  });
});
