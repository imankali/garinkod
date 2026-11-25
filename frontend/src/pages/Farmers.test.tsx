// frontend/src/pages/Farmers.test.tsx
//
// The page told a farmer «محصولت را مستقیم بفروش» and offered a login form.
// `agricultureApi.requestProcurement` was served and never called, so there was
// no way to say "I have a ton of tomatoes ready next week" until after building
// a stall — the wrong order for the farmer.
//
// What these hold:
//   • the offer goes to the real endpoint with the numbers the API expects;
//   • an empty price field sends no `requested_price` at all, because zero and
//     "no idea, tell me the market rate" are different answers;
//   • the code the server returns is what the page shows back.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestProcurement = vi.fn();
const provinces = vi.fn();
const cities = vi.fn();
const search = vi.fn();

vi.mock('../api/services', () => ({
  agricultureApi: { requestProcurement: (...a: unknown[]) => requestProcurement(...a) },
  locationsApi: {
    provinces: (...a: unknown[]) => provinces(...a),
    cities: (...a: unknown[]) => cities(...a),
    search: (...a: unknown[]) => search(...a),
  },
}));

import Farmers from './Farmers';

function renderFarmers() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Farmers />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillOffer(price?: string) {
  await userEvent.type(screen.getByLabelText('نام و نام خانوادگی'), 'کشاورز آزمایشی');
  await userEvent.type(screen.getByLabelText('شمارهٔ همراه'), '09120000009');
  await userEvent.type(screen.getByLabelText('محصول'), 'گوجه‌فرنگی');
  await userEvent.type(screen.getByLabelText('مقدار'), '1500');
  await waitFor(() => expect(screen.getByRole('option', { name: 'فارس' })).toBeDefined());
  await userEvent.selectOptions(screen.getByLabelText('استان'), 'فارس');
  await waitFor(() => expect(screen.getByRole('option', { name: 'شیراز' })).toBeDefined());
  await userEvent.selectOptions(screen.getByLabelText('شهر'), 'شیراز');
  if (price) await userEvent.type(screen.getByLabelText('قیمت پیشنهادی هر واحد (تومان)'), price);
}

beforeEach(() => {
  requestProcurement.mockReset();
  provinces.mockReset();
  cities.mockReset();
  search.mockReset();
  provinces.mockResolvedValue({
    data: {
      count: 1,
      results: [{ id: 1, name: 'فارس', slug: 'fars', kind: 'province', parent: null, province_name: 'فارس' }],
    },
  });
  cities.mockResolvedValue({
    data: {
      count: 1,
      results: [{ id: 327, name: 'شیراز', slug: 'فارس-شیراز', kind: 'city', parent: 326, province_name: 'فارس' }],
    },
  });
  search.mockResolvedValue({ data: { count: 0, results: [] } });
});

describe('Farmers — the procurement offer', () => {
  it('files an offer on the procurement endpoint and shows the code back', async () => {
    requestProcurement.mockResolvedValue({
      data: {
        request: { code: 'PR-261125-ABCDEF12' },
        message: 'درخواست فروش محصول ثبت شد و پس از ارزیابی با شما تماس می‌گیریم.',
      },
    });
    renderFarmers();

    await fillOffer();
    await userEvent.click(screen.getByRole('button', { name: 'ثبت درخواست فروش' }));

    await waitFor(() => expect(requestProcurement).toHaveBeenCalledTimes(1));
    expect(requestProcurement.mock.calls[0]?.[0]).toMatchObject({
      farmer_name: 'کشاورز آزمایشی',
      crop_name: 'گوجه‌فرنگی',
      quantity: 1500,
      unit: 'کیلوگرم',
      province: 'فارس',
      city: 'شیراز',
    });
    expect(await screen.findByText(/PR-261125-ABCDEF12/)).toBeDefined();
  });

  it('sends no price when the farmer does not know one', async () => {
    requestProcurement.mockResolvedValue({
      data: { request: { code: 'PR-1' }, message: '' },
    });
    renderFarmers();

    await fillOffer();
    await userEvent.click(screen.getByRole('button', { name: 'ثبت درخواست فروش' }));

    await waitFor(() => expect(requestProcurement).toHaveBeenCalled());
    // Zero would read as "free"; absent reads as "you suggest the price".
    expect(requestProcurement.mock.calls[0]?.[0]).not.toHaveProperty('requested_price');
  });

  it('sends the price as a number when it is given', async () => {
    requestProcurement.mockResolvedValue({
      data: { request: { code: 'PR-2' }, message: '' },
    });
    renderFarmers();

    await fillOffer('35000');
    await userEvent.click(screen.getByRole('button', { name: 'ثبت درخواست فروش' }));

    await waitFor(() => expect(requestProcurement).toHaveBeenCalled());
    expect(requestProcurement.mock.calls[0]?.[0]).toMatchObject({ requested_price: 35000 });
  });

  it('keeps what was typed when the server refuses', async () => {
    requestProcurement.mockRejectedValue({
      response: { data: { error: 'شمارهٔ همراه معتبر نیست.' } },
    });
    renderFarmers();

    await fillOffer();
    await userEvent.click(screen.getByRole('button', { name: 'ثبت درخواست فروش' }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect((screen.getByLabelText('محصول') as HTMLInputElement).value).toBe('گوجه‌فرنگی');
  });

  it('cannot submit an offer with no quantity', async () => {
    renderFarmers();

    // The button is disabled until the fields the API requires are all there.
    expect(screen.getByRole('button', { name: 'ثبت درخواست فروش' })).toBeDisabled();
  });

  it('fills province and city from a search, so the pair cannot disagree', async () => {
    search.mockResolvedValue({
      data: {
        count: 1,
        results: [{ id: 327, name: 'شیراز', slug: 'فارس-شیراز', kind: 'city', parent: 326, province_name: 'فارس' }],
      },
    });
    renderFarmers();

    await userEvent.type(screen.getByLabelText('جست‌وجوی استان یا شهر'), 'شیراز');

    const hit = await screen.findByRole('button', { name: /شیراز/ });
    await userEvent.click(hit);

    // A city hit sets both selectors at once — the buyer filter and the stored
    // offer then carry the same province the server knows.
    expect((screen.getByLabelText('استان') as HTMLSelectElement).value).toBe('فارس');
    await waitFor(() => expect((screen.getByLabelText('شهر') as HTMLSelectElement).value).toBe('شیراز'));
  });
});
