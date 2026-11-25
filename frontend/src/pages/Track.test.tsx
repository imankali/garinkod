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
});
