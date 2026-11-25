// frontend/src/pages/Track.test.tsx
//
// Tracking is a guard as much as a screen: nothing is requested until *both* the
// order code and the phone number are present, because the pair is what the
// server checks before it returns an address. A regression here would leak a
// delivery address to anyone holding a guessed code.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Track from './Track';

const lookup = vi.fn();

vi.mock('../api/services', () => ({
  ordersApi: { lookup: (...args: unknown[]) => lookup(...args) },
}));

function renderTrack() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/track']}>
        <Track />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  lookup.mockReset();
});

describe('Track', () => {
  it('keeps the submit button disabled until both fields are filled', async () => {
    renderTrack();
    const submit = screen.getByRole('button', { name: /پیدا کردن سفارش/ });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('کد سفارش'), 'GK-1001');
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('شمارهٔ همراه'), '09120000000');
    expect(submit).toBeEnabled();
  });

  it('sends the code and the phone together, then shows the order', async () => {
    lookup.mockResolvedValue({
      data: {
        id: 7,
        code: 'GK-1001',
        status: 'processing',
        status_label: 'در حال آماده‌سازی',
        payment_status_label: 'پرداخت در محل هماهنگی',
        total_items: 2,
        total_price: 500000,
        items: [],
        city: 'تهران',
        address: 'خیابان نمونه',
      },
    });

    renderTrack();
    await userEvent.type(screen.getByLabelText('کد سفارش'), 'GK-1001');
    await userEvent.type(screen.getByLabelText('شمارهٔ همراه'), '09120000000');
    await userEvent.click(screen.getByRole('button', { name: /پیدا کردن سفارش/ }));

    await waitFor(() => expect(lookup).toHaveBeenCalledWith('GK-1001', '09120000000'));
    expect(await screen.findByText(/سفارش GK-1001/)).toBeInTheDocument();
  });

  it('offers an explanation, not a bare failure, when the pair does not match', async () => {
    lookup.mockRejectedValue(new Error('404'));

    renderTrack();
    await userEvent.type(screen.getByLabelText('کد سفارش'), 'GK-0000');
    await userEvent.type(screen.getByLabelText('شمارهٔ همراه'), '09120000000');
    await userEvent.click(screen.getByRole('button', { name: /پیدا کردن سفارش/ }));

    expect(await screen.findByText(/سفارشی با این کد و شماره پیدا نشد/)).toBeInTheDocument();
    // The reason is stated under the heading, whichever the server gave.
    expect(screen.getByRole('heading', { name: /سفارشی با این کد و شماره پیدا نشد/ }).nextElementSibling).not.toBeEmptyDOMElement();
  });

  it('shows the carrier\'s own trail with its tracking code and times', async () => {
    lookup.mockResolvedValue({
      data: {
        id: 7,
        code: 'GK-1001',
        status: 'shipped',
        status_label: 'ارسال شده',
        payment_status_label: 'پرداخت در محل هماهنگی',
        total_items: 1,
        total_price: 500000,
        items: [],
        city: 'شیراز',
        address: 'خیابان نمونه',
        shipments: [
          {
            id: 'a1',
            provider: 'manual',
            provider_label: 'ثبت دستی',
            service_name: 'استاندارد',
            status: 'in_transit',
            status_label: 'در مسیر',
            tracking_code: 'TRK-TEST-0001',
            tracking_url: 'https://example.com/track/TRK-TEST-0001',
            shipping_cost: 0,
            shipped_at: null,
            delivered_at: null,
            last_event_at: null,
            created_at: '',
            updated_at: '',
            events: [
              {
                id: 1,
                status: 'in_transit',
                status_label: 'در مسیر',
                description: 'مرسوله در مسیر شیراز است.',
                location: 'اصفهان',
                occurred_at: '2026-11-24T06:18:29+03:30',
              },
            ],
          },
        ],
      },
    });

    renderTrack();
    await userEvent.type(screen.getByLabelText('کد سفارش'), 'GK-1001');
    await userEvent.type(screen.getByLabelText('شمارهٔ همراه'), '09120000000');
    await userEvent.click(screen.getByRole('button', { name: /پیدا کردن سفارش/ }));

    expect(await screen.findByText(/کد رهگیری TRK-TEST-0001/)).toBeInTheDocument();
    expect(screen.getByText('مرسوله در مسیر شیراز است.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /پیگیری روی سایت باربری/ })).toHaveAttribute(
      'href',
      'https://example.com/track/TRK-TEST-0001',
    );
  });
});
