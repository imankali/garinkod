// frontend/src/pages/Checkout.test.tsx
//
// The purchase gate, asserted as a decision rather than as a journey.
//
// "The buyer cannot place an order without confirming the delivery details, the
// amount and the terms" is a rule the shop makes about itself. Until now the only
// thing holding it was a browser test, which means the promise was only kept on
// the nights the Playwright job was green — and it was not green. The rule is pure
// enough to test where it is decided, so it is tested there. The browser suite
// still owns the round trip; this owns the gate.

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Checkout from './Checkout';
import { renderApp, flush } from '../test/render';
import { signIn } from '../test/auth';
import { useCartStore } from '../store/cartStore';
import { locationsApi, ordersApi, paymentsApi, shippingApi } from '../api/services';
import type { CartItem } from '@/types/commerce';

vi.mock('../api/services', () => ({
  ordersApi: { checkout: vi.fn() },
  paymentsApi: { options: vi.fn(), restartZarinpal: vi.fn() },
  shippingApi: { quote: vi.fn() },
  // The delivery block's province/city picker; the gate under test does not
  // depend on what it returns.
  locationsApi: { provinces: vi.fn(), cities: vi.fn() },
}));

const createOrder = ordersApi.checkout as ReturnType<typeof vi.fn>;

function cartItem(): CartItem {
  return {
    id: 11,
    kind: 'product',
    product: null,
    listing: null,
    title: 'کود اوره ۴۶٪',
    quantity: 2,
    unit_price: 250000,
    total_price: 500000,
    available_quantity: 10,
    min_order_quantity: 1,
    is_in_stock: true,
  } as CartItem;
}

function renderCheckout() {
  useCartStore.setState({
    cart: { id: 1, items: [cartItem()], total_price: 500000 } as never,
    isLoading: false,
    itemErrors: {},
    fetchCart: vi.fn(async () => {}) as never,
  } as never);
  return renderApp(<Checkout />, { route: '/checkout' });
}

/** Everything the gate is *not* about, already satisfied. */
async function fillDelivery(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/نام و نام خانوادگی/), 'زهرا بهاران');
  await user.type(screen.getByLabelText(/شماره تماس|تلفن/), '09121234567');
  await user.selectOptions(screen.getByLabelText(/^استان/), 'فارس');
  await user.selectOptions(screen.getByLabelText(/^شهر/), 'شیراز');
  await user.type(screen.getByLabelText(/نشانی کامل/), 'خیابان زند، کوچه بهار، پلاک ۱۲');
}

function orderButton() {
  const submit = screen
    .getAllByRole('button')
    .find((node) => /ثبت سفارش|ثبت نهایی|پرداخت/.test(node.textContent ?? ''));
  expect(submit, 'the checkout has no order button').toBeDefined();
  return submit!;
}

beforeEach(() => {
  signIn({ first_name: 'زهرا', last_name: 'بهاران', phone: '09121234567' } as never);
  createOrder.mockClear();
  vi.mocked(paymentsApi.options).mockResolvedValue({ data: { providers: [] } } as never);
  // The page treats a missing quote list as a failed fetch and blocks the order
  // button, so the gate under test needs a deliverable destination.
  vi.mocked(shippingApi.quote).mockResolvedValue({
    data: {
      quotes: [
        { service: 'standard', label: 'پست پیشتاز', amount: 45000, eta_days: 3 },
      ],
    },
  } as never);
  vi.mocked(locationsApi.provinces).mockResolvedValue({
    data: { results: [{ id: 1, name: 'فارس' }] },
  } as never);
  vi.mocked(locationsApi.cities).mockResolvedValue({
    data: { results: [{ id: 2, name: 'شیراز' }] },
  } as never);
});

describe('the acceptance gate', () => {
  it('refuses to place an order that was not accepted', async () => {
    const user = userEvent.setup();
    renderCheckout();
    await flush();
    await fillDelivery(user);

    await user.click(orderButton());
    await flush();

    expect(createOrder).not.toHaveBeenCalled();
    // The refusal is announced where the checkbox is, not only in a toast, and
    // the checkbox is marked invalid so the pairing survives a restyle.
    const alerts = screen
      .queryAllByRole('alert')
      .map((node) => node.textContent ?? '')
      .join(' ');
    expect(alerts).toMatch(/شرایط/);
    expect(
      screen.getByRole('checkbox', { name: /صحت اطلاعات تحویل و مبلغ را تأیید می‌کنم/ }),
    ).toHaveAttribute('aria-invalid', 'true');
  });

  it('accepts through the checkbox and only then submits', async () => {
    const user = userEvent.setup();
    createOrder.mockResolvedValue({
      data: { order: { id: 5, code: 'GK-1', status: 'pending' }, payment_error: '' },
    } as never);
    renderCheckout();
    await flush();
    await fillDelivery(user);

    await user.click(
      screen.getByRole('checkbox', { name: /صحت اطلاعات تحویل و مبلغ را تأیید می‌کنم/ }),
    );

    await user.click(orderButton());
    await flush();

    // The server sees the acceptance as data, not just as a ticked box.
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ terms_accepted: true }),
    );
  });

  it('names every document the buyer is agreeing to', async () => {
    renderCheckout();
    await flush();

    const acceptance = screen
      .getByRole('checkbox', { name: /صحت اطلاعات تحویل و مبلغ را تأیید می‌کنم/ })
      .closest('label');
    expect(acceptance).not.toBeNull();

    const hrefs = within(acceptance as HTMLElement)
      .getAllByRole('link')
      .map((node) => node.getAttribute('href'));
    // Where the links go is the contract; how they are worded is copy.
    expect(hrefs).toEqual(
      expect.arrayContaining(['/legal/terms', '/legal/privacy', '/legal/returns']),
    );
  });

  it('sizes the tick box as a touch target', async () => {
    renderCheckout();
    await flush();
    // `min-h-11`/`min-w-11` on the control: the whole label is one target, and
    // the box inside it has to be big enough to aim at on a phone.
    const box = screen.getByRole('checkbox', {
      name: /صحت اطلاعات تحویل و مبلغ را تأیید می‌کنم/,
    });
    expect(box.className).toMatch(/min-h-11/);
    expect(box.className).toMatch(/min-w-11/);
  });
});
