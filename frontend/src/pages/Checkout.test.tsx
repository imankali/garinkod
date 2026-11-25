// frontend/src/pages/Checkout.test.tsx
//
// The address fields on checkout, which are the one place the browser decides
// what the shipping quote is built from:
//   • the province is chosen from the country's published list, not typed,
//   • the city list follows the province and nothing else,
//   • changing the province drops a city that no longer belongs to it —
//     otherwise «نیشابور» survives a switch to «فارس» and the order ships to a
//     place that does not exist.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/services', () => ({
  locationsApi: { provinces: vi.fn(), cities: vi.fn() },
  ordersApi: { checkout: vi.fn() },
  paymentsApi: { options: vi.fn() },
  rewardsApi: { wallet: vi.fn() },
  shippingApi: { quote: vi.fn() },
}));

import { locationsApi, ordersApi, paymentsApi, rewardsApi, shippingApi } from '../api/services';
import Checkout from './Checkout';
import { createQueryClient, Providers } from '../providers';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';

const province = (id: number, name: string) => ({
  id,
  name,
  slug: name,
  kind: 'province' as const,
  parent: null,
  province_name: name,
});

const city = (id: number, name: string, provinceName: string) => ({
  id,
  name,
  slug: `${provinceName}-${name}`,
  kind: 'city' as const,
  parent: 1,
  province_name: provinceName,
});

const renderCheckout = () =>
  render(
    <Providers client={createQueryClient()}>
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>
    </Providers>,
  );

beforeEach(() => {
  useCartStore.setState({
    isOpen: false,
    cart: {
      id: 1,
      items: [
        {
          id: 1,
          kind: 'product',
          product: null,
          listing: null,
          title: 'کود اوره',
          quantity: 1,
          unit_price: 100000,
          total_price: 100000,
          available_quantity: 10,
          min_order_quantity: 1,
          is_in_stock: true,
        },
      ],
      total_price: 100000,
      total_items: 1,
      created_at: '',
      updated_at: '',
    },
  });
  useAuthStore.setState({
    isAuthenticated: true,
    user: { id: 1, username: 'buyer', first_name: 'مریم', last_name: 'احمدی' },
    account: { phone: '09120000000', address: 'خیابان اول' },
  } as never);

  vi.mocked(locationsApi.provinces).mockResolvedValue({
    data: { count: 2, results: [province(1, 'خراسان رضوی'), province(2, 'فارس')] },
  } as never);
  // The server's registry, default shape: one usable provider.
  vi.mocked(paymentsApi.options).mockResolvedValue({
    data: {
      providers: [
        {
          code: 'coordination',
          label: 'هماهنگی با کارشناس',
          currency: 'IRT',
          enabled: true,
          configured: true,
          reason: 'ثبت سفارش انجام می‌شود و پرداخت پس از تأیید هماهنگ خواهد شد.',
        },
        {
          code: 'zarinpal',
          label: 'زرین‌پال',
          currency: 'IRT',
          enabled: false,
          configured: false,
          reason: 'درگاه تا زمان فعال‌سازی و تنظیم Merchant ID غیرفعال است.',
        },
      ],
    },
  } as never);
  vi.mocked(shippingApi.quote).mockResolvedValue({
    data: {
      quotes: [
        {
          provider: 'flat',
          service: 'standard',
          label: 'ارسال استاندارد',
          amount: 45000,
          currency: 'IRT',
          estimated_days_min: 2,
          estimated_days_max: 7,
        },
      ],
      authoritative_at_checkout: false,
      note: 'مبلغ نهایی در لحظه ثبت سفارش دوباره محاسبه می‌شود.',
    },
  } as never);
  vi.mocked(rewardsApi.wallet).mockResolvedValue({
    data: { id: 1, currency: 'IRT', balance: 0, loyalty_points: 300, updated_at: '', transactions: [] },
  } as never);
  vi.mocked(locationsApi.cities).mockImplementation((name) =>
    Promise.resolve({
      data: {
        count: 1,
        results: name === 'خراسان رضوی' ? [city(1, 'نیشابور', name)] : [city(2, 'شیراز', name)],
      },
    } as never),
  );
});

describe('Checkout address', () => {
  it('offers the provinces the API publishes', async () => {
    renderCheckout();

    await waitFor(() => expect(screen.getByRole('option', { name: 'خراسان رضوی' })).toBeDefined());
    expect(screen.getByRole('option', { name: 'فارس' })).toBeDefined();
  });

  it('does not ask for a city before a province is chosen', async () => {
    renderCheckout();

    const cityField = screen.getByLabelText('شهر');
    expect(cityField).toBeDisabled();
    expect(locationsApi.cities).not.toHaveBeenCalled();
  });

  it('loads the cities of the chosen province', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByRole('option', { name: 'خراسان رضوی' })).toBeDefined());

    await userEvent.selectOptions(screen.getByLabelText('استان'), 'خراسان رضوی');

    await waitFor(() => expect(screen.getByRole('option', { name: 'نیشابور' })).toBeDefined());
    expect(locationsApi.cities).toHaveBeenCalledWith('خراسان رضوی');
    expect(screen.getByLabelText('شهر')).toBeEnabled();
  });

  it('clears the city when the province changes', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByRole('option', { name: 'خراسان رضوی' })).toBeDefined());

    await userEvent.selectOptions(screen.getByLabelText('استان'), 'خراسان رضوی');
    await waitFor(() => expect(screen.getByRole('option', { name: 'نیشابور' })).toBeDefined());
    await userEvent.selectOptions(screen.getByLabelText('شهر'), 'نیشابور');
    expect(screen.getByLabelText('شهر')).toHaveValue('نیشابور');

    await userEvent.selectOptions(screen.getByLabelText('استان'), 'فارس');

    await waitFor(() => expect(screen.getByLabelText('شهر')).toHaveValue(''));
  });
});

describe('Checkout payment methods', () => {
  it('offers only the providers the server has enabled and configured', async () => {
    renderCheckout();

    // «زرین‌پال» is declared but switched off: it must not be selectable.
    await waitFor(() => expect(screen.getByRole('radio', { name: /هماهنگی با کارشناس/ })).toBeDefined());
    expect(screen.queryByRole('radio', { name: /زرین‌پال/ })).toBeNull();
  });

  it('offers a gateway the operator turns on, and submits the chosen one', async () => {
    vi.mocked(paymentsApi.options).mockResolvedValue({
      data: {
        providers: [
          {
            code: 'coordination',
            label: 'هماهنگی با کارشناس',
            currency: 'IRT',
            enabled: true,
            configured: true,
            reason: '',
          },
          {
            code: 'zarinpal',
            label: 'زرین‌پال',
            currency: 'IRT',
            enabled: true,
            configured: true,
            reason: 'پرداخت آنلاین از طریق درگاه زرین‌پال.',
          },
        ],
      },
    } as never);
    vi.mocked(ordersApi.checkout).mockResolvedValue({
      data: { order: { id: 1, code: 'GK-TEST-1', status: 'confirmed', payment_status: 'unpaid' } },
    } as never);
    renderCheckout();

    const zarinpal = await screen.findByRole('radio', { name: /زرین‌پال/ });
    await userEvent.click(zarinpal);
    expect(zarinpal).toBeChecked();

    // What matters is what leaves the page, not what the radio looks like: the
    // payload used to hardcode 'coordination' whatever the visitor picked.
    await waitFor(() => expect(screen.getByRole('option', { name: 'فارس' })).toBeDefined());
    await userEvent.type(screen.getByLabelText('نام و نام خانوادگی'), 'مریم احمدی');
    await userEvent.type(screen.getByLabelText('شمارهٔ همراه'), '09120000000');
    await userEvent.selectOptions(screen.getByLabelText('استان'), 'فارس');
    await waitFor(() => expect(screen.getByRole('option', { name: 'شیراز' })).toBeDefined());
    await userEvent.selectOptions(screen.getByLabelText('شهر'), 'شیراز');
    await userEvent.type(screen.getByLabelText('نشانی کامل'), 'خیابان اول، پلاک ۲');
    // Terms are required before the button unlocks. There are two checkboxes
    // now (loyalty and terms), so this one is named rather than positional.
    await userEvent.click(screen.getByRole('checkbox', { name: /خواندم و می‌پذیرم/ }));

    await userEvent.click(screen.getByRole('button', { name: 'ثبت سفارش' }));

    await waitFor(() => expect(ordersApi.checkout).toHaveBeenCalledTimes(1));
    expect(vi.mocked(ordersApi.checkout).mock.calls[0]?.[0]).toMatchObject({
      payment_method: 'zarinpal',
    });
  });
});

describe('Checkout loyalty points', () => {
  const fillAndSubmit = async () => {
    await waitFor(() => expect(screen.getByRole('option', { name: 'فارس' })).toBeDefined());
    await userEvent.type(screen.getByLabelText('نام و نام خانوادگی'), 'مریم احمدی');
    await userEvent.type(screen.getByLabelText('شمارهٔ همراه'), '09120000000');
    await userEvent.selectOptions(screen.getByLabelText('استان'), 'فارس');
    await waitFor(() => expect(screen.getByRole('option', { name: 'شیراز' })).toBeDefined());
    await userEvent.selectOptions(screen.getByLabelText('شهر'), 'شیراز');
    await userEvent.type(screen.getByLabelText('نشانی کامل'), 'خیابان اول، پلاک ۲');
    // Two checkboxes now exist: loyalty and the terms. Terms is the last one.
    const boxes = screen.getAllByRole('checkbox');
    const termsBox = boxes[boxes.length - 1];
    if (!termsBox) throw new Error('the terms checkbox should be on the page');
    await userEvent.click(termsBox);
    await userEvent.click(screen.getByRole('button', { name: 'ثبت سفارش' }));
  };

  it('offers the points the buyer holds and gives no flag when they are left alone', async () => {
    vi.mocked(ordersApi.checkout).mockResolvedValue({
      data: { order: { id: 1, code: 'GK-TEST-1', status: 'confirmed', payment_status: 'unpaid' } },
    } as never);
    renderCheckout();

    expect(await screen.findByText(/استفاده از امتیازهای وفاداری/)).toBeDefined();
    expect(screen.getByText(/۳۰۰ امتیاز دارید/)).toBeDefined();

    await fillAndSubmit();

    await waitFor(() => expect(ordersApi.checkout).toHaveBeenCalledTimes(1));
    // Unticked means the server keeps the points; the flag is not a default.
    expect(vi.mocked(ordersApi.checkout).mock.calls[0]?.[0]).toMatchObject({
      use_loyalty_points: false,
    });
  });

  it('sends the redemption flag once the buyer opts in', async () => {
    vi.mocked(ordersApi.checkout).mockResolvedValue({
      data: { order: { id: 1, code: 'GK-TEST-1', status: 'confirmed', payment_status: 'unpaid' } },
    } as never);
    renderCheckout();

    // 300 points against a 100,000 order: 30,000 off, and the page says so
    // before the buyer commits rather than after the server answers.
    await userEvent.click(await screen.findByRole('checkbox', { name: /استفاده از امتیازهای وفاداری/ }));
    expect(await screen.findByText(/قابل پرداخت پس از تخفیف امتیاز: ۷۰٬۰۰۰/)).toBeDefined();

    await fillAndSubmit();

    await waitFor(() => expect(ordersApi.checkout).toHaveBeenCalledTimes(1));
    expect(vi.mocked(ordersApi.checkout).mock.calls[0]?.[0]).toMatchObject({
      use_loyalty_points: true,
    });
  });

  it('hides the switch when the balance cannot buy a whole unit', async () => {
    vi.mocked(shippingApi.quote).mockResolvedValue({
    data: {
      quotes: [
        {
          provider: 'flat',
          service: 'standard',
          label: 'ارسال استاندارد',
          amount: 45000,
          currency: 'IRT',
          estimated_days_min: 2,
          estimated_days_max: 7,
        },
      ],
      authoritative_at_checkout: false,
      note: 'مبلغ نهایی در لحظه ثبت سفارش دوباره محاسبه می‌شود.',
    },
  } as never);
  vi.mocked(rewardsApi.wallet).mockResolvedValue({
      data: { id: 1, currency: 'IRT', balance: 0, loyalty_points: 60, updated_at: '', transactions: [] },
    } as never);
    renderCheckout();

    await waitFor(() => expect(screen.getByRole('button', { name: 'ثبت سفارش' })).toBeDefined());
    // 60 points would redeem nothing; offering the switch would promise a
    // discount the checkout path cannot deliver.
    expect(screen.queryByRole('checkbox', { name: /استفاده از امتیازهای وفاداری/ })).toBeNull();
  });
});

describe('Checkout shipping quote', () => {
  it('asks the server for the delivery cost once a province and city are chosen', async () => {
    renderCheckout();

    await waitFor(() => expect(screen.getByRole('option', { name: 'فارس' })).toBeDefined());
    expect(shippingApi.quote).not.toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText('استان'), 'فارس');
    await waitFor(() => expect(screen.getByRole('option', { name: 'شیراز' })).toBeDefined());
    await userEvent.selectOptions(screen.getByLabelText('شهر'), 'شیراز');

    await waitFor(() => expect(shippingApi.quote).toHaveBeenCalledWith('فارس', 'شیراز'));
    // The price and the estimate are on screen before the buyer commits.
    expect(await screen.findByText(/ارسال استاندارد/)).toBeDefined();
    expect(screen.getAllByText(/۴۵٬۰۰۰/).length).toBeGreaterThan(0);
    expect(screen.getByText(/۲ تا ۷ روز/)).toBeDefined();
  });

  it('does not present the estimate as the final charge', async () => {
    renderCheckout();

    await waitFor(() => expect(screen.getByRole('option', { name: 'فارس' })).toBeDefined());
    await userEvent.selectOptions(screen.getByLabelText('استان'), 'فارس');
    await waitFor(() => expect(screen.getByRole('option', { name: 'شیراز' })).toBeDefined());
    await userEvent.selectOptions(screen.getByLabelText('شهر'), 'شیراز');

    // authoritative_at_checkout is false: the page must repeat the server's
    // caveat rather than print a total as if it were settled.
    expect(await screen.findByText(/دوباره محاسبه می‌شود/)).toBeDefined();
  });
});
