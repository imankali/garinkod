// frontend/src/pages/Orders.test.tsx
//
// `ordersApi.cancel` was served from the first commit and no screen called it,
// so a buyer who wanted to cancel an order had to phone support — for an action
// the API performs itself, keyed on the code and phone already in the row.
//
// The rule that matters is not the button but the absence of it:
// `Order.cancel_and_restore_stock` refuses a paid order (it needs a refund
// workflow) and refuses anything past `confirmed`. A page that shows the button
// anyway produces a 409 after the buyer has decided to cancel. So each test
// below pins one branch of that rule, and the reason is printed instead.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mine = vi.fn();
const cancel = vi.fn();

vi.mock('../api/services', () => ({
  ordersApi: {
    mine: (...a: unknown[]) => mine(...a),
    cancel: (...a: unknown[]) => cancel(...a),
  },
}));

const auth = vi.hoisted(() => ({ signedIn: true }));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: auth.signedIn }),
}));

import Orders from './Orders';

const order = (over: Record<string, unknown> = {}) => ({
  id: 2,
  code: 'GK-TEST-0002',
  customer_name: 'خریدار تستی',
  phone: '09120000001',
  email: '',
  province: 'تهران',
  city: 'تهران',
  address: 'خیابان نمونه',
  postal_code: '',
  latitude: null,
  longitude: null,
  notes: '',
  subtotal: 100000,
  total_price: 145000,
  total_items: 2,
  status: 'awaiting_review',
  status_label: 'در انتظار بررسی',
  payment_status: 'unpaid',
  payment_status_label: 'پرداخت‌نشده',
  created_at: '2026-11-25T06:00:00+03:30',
  updated_at: '2026-11-25T06:00:00+03:30',
  ...over,
});

function renderOrders() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.signedIn = true;
  mine.mockReset();
  cancel.mockReset();
  mine.mockResolvedValue({ data: [order()] });
  cancel.mockResolvedValue({
    data: { order: order({ status: 'cancelled', status_label: 'لغو شده' }), message: 'سفارش لغو شد.' },
  });
});

describe('Orders — cancelling', () => {
  it('asks before cancelling, then sends the code and phone the row already has', async () => {
    renderOrders();

    await userEvent.click(await screen.findByRole('button', { name: 'لغو سفارش' }));
    // Nothing has been cancelled by opening the confirmation.
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.getByText(/موجودی رزروشدهٔ این سفارش آزاد می‌شود/)).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'بله، لغو کن' }));
    await waitFor(() =>
      expect(cancel).toHaveBeenCalledWith('GK-TEST-0002', '09120000001'),
    );
  });

  it('does not offer to cancel a paid order, and says why', async () => {
    mine.mockResolvedValue({
      data: [order({ status: 'shipped', status_label: 'ارسال شده', payment_status: 'paid', payment_status_label: 'پرداخت‌شده' })],
    });
    renderOrders();

    await screen.findByText(/GK-TEST-0002/);
    // The server would answer 409: a paid order needs a refund workflow.
    expect(screen.queryByRole('button', { name: 'لغو سفارش' })).toBeNull();
    expect(screen.getByText(/فرایند بازپرداخت/)).toBeDefined();
  });

  it('does not offer to cancel an order that has already shipped', async () => {
    mine.mockResolvedValue({
      data: [order({ status: 'shipped', status_label: 'ارسال شده' })],
    });
    renderOrders();

    await screen.findByText(/GK-TEST-0002/);
    expect(screen.queryByRole('button', { name: 'لغو سفارش' })).toBeNull();
    expect(screen.getByText(/از مرحلهٔ لغو توسط خریدار گذشته است/)).toBeDefined();
  });

  it('surfaces the server’s refusal instead of swallowing it', async () => {
    cancel.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: 'درخواست پرداخت فعال است؛ ابتدا نتیجه درگاه مشخص شود.' }, status: 409 },
    });
    renderOrders();

    await userEvent.click(await screen.findByRole('button', { name: 'لغو سفارش' }));
    await userEvent.click(screen.getByRole('button', { name: 'بله، لغو کن' }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toContain('درخواست پرداخت فعال است');
  });

  it('offers nothing to cancel on an order that is already cancelled', async () => {
    mine.mockResolvedValue({ data: [order({ status: 'cancelled', status_label: 'لغو شده' })] });
    renderOrders();

    // The status line and the reason sentence both say «لغو شده»; wait on the
    // one that only exists once the row is rendered.
    expect(await screen.findByText('این سفارش قبلاً لغو شده است.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'لغو سفارش' })).toBeNull();
  });
});
