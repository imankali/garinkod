// frontend/src/pages/Account.test.tsx
//
// «اطلاعات تحویل» is a form the server can refuse field by field. It used to
// answer every refusal with one line — «ذخیره نشد؛ دوباره بزنید» — which makes a
// wrong phone number look like a broken page. These tests hold the two things
// that fix it: the refusal lands under the right input, and the account says
// whether the number is confirmed.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateProfile = vi.fn();

const myCoupons = vi.fn();
const wallet = vi.fn();
const levelsSnapshot = vi.fn();

vi.mock('../api/services', () => ({
  ordersApi: { mine: vi.fn(() => Promise.resolve({ data: [] })) },
  rewardsApi: {
    myCoupons: (...args: unknown[]) => myCoupons(...args),
    wallet: (...args: unknown[]) => wallet(...args),
  },
  levelsApi: { snapshot: (...args: unknown[]) => levelsSnapshot(...args) },
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: { id: 1, username: 'buyer', first_name: 'مریم', last_name: 'احمدی', email: '' },
      account: { phone: '09120000000', address: 'تهران', phone_verified_at: null },
      logout: vi.fn(),
      updateProfile,
    }),
}));

import Account from './Account';
import { createQueryClient, Providers } from '../providers';

const renderAccount = () =>
  render(
    <Providers client={createQueryClient()}>
      <MemoryRouter>
        <Account />
      </MemoryRouter>
    </Providers>,
  );

beforeEach(() => {
  myCoupons.mockReset();
  wallet.mockReset();
  levelsSnapshot.mockReset();
  wallet.mockResolvedValue({
    data: { id: 1, currency: 'IRT', balance: 0, loyalty_points: 300, updated_at: '', transactions: [] },
  });
  myCoupons.mockResolvedValue({ data: [] });
  levelsSnapshot.mockResolvedValue({
    data: {
      ladder: [],
      capabilities: {},
      level_range: { min: 1, max: 8 },
      viewer_level: 1,
      viewer_rank: { value: 1, label: 'سطح ۱ — خریدار', short_label: 'خریدار', promise: '' },
      viewer_is_staff: false,
      viewer_capabilities: {},
      next_step: {
        value: 2,
        label: 'سطح ۲ — خریدار تأییدشده',
        how: 'با تأیید شماره تلفن (کد یک‌بارمصرف).',
        promise: '',
      },
    },
  });
  updateProfile.mockReset();
});

describe('Account delivery details', () => {
  it('puts a refused field under that field, not in a generic line', async () => {
    updateProfile.mockRejectedValue({
      response: {
        status: 400,
        data: {
          code: 'validation_error',
          error: 'اطلاعات واردشده معتبر نیست.',
          fields: { phone: 'شمارهٔ همراه باید ۱۱ رقم باشد.' },
        },
      },
    });
    renderAccount();

    await userEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ تغییرات' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('شمارهٔ همراه باید ۱۱ رقم باشد'),
    );
    expect(screen.getByLabelText(/شمارهٔ همراه/)).toHaveAttribute('aria-invalid', 'true');
    // The generic fallback must not double-report the same refusal.
    expect(screen.queryByText('ذخیره نشد؛ دوباره بزنید.')).toBeNull();
  });

  it('still shows the generic line when the server refuses without naming a field', async () => {
    updateProfile.mockRejectedValue({
      response: { status: 500, data: { code: 'server_error', error: 'خطای سرور.' } },
    });
    renderAccount();

    await userEvent.click(screen.getByRole('button', { name: 'ذخیرهٔ تغییرات' }));

    await waitFor(() => expect(screen.getByText('ذخیره نشد؛ دوباره بزنید.')).toBeDefined());
  });

  it('says when the phone number is not confirmed yet', async () => {
    renderAccount();

    expect(screen.getByText(/این شماره هنوز تأیید نشده/)).toBeDefined();
  });
});

describe('Account rewards', () => {
  it('shows the loyalty points and what they are worth at checkout', async () => {
    renderAccount();

    // 300 points redeem as 30,000 toman, and the account page used to show
    // neither the points nor the balance the server holds for this buyer.
    expect(await screen.findByText('۳۰۰')).toBeDefined();
    expect(screen.getByText(/تا ۳۰٬۰۰۰ تومان تخفیف/)).toBeDefined();
  });

  it('does not claim a discount for points below one redeemable unit', async () => {
    wallet.mockResolvedValue({
      data: { id: 1, currency: 'IRT', balance: 0, loyalty_points: 99, updated_at: '', transactions: [] },
    });
    renderAccount();

    // 99 points are worth nothing at the till; saying «تا ۰ تومان» or rounding
    // up to 10,000 would both be wrong.
    expect(await screen.findByText(/۹۹/)).toBeDefined();
    expect(screen.queryByText(/تومان تخفیف/)).toBeNull();
    expect(screen.getByText(/۱ امتیاز دیگر لازم است/)).toBeDefined();
  });

  it('lists the coupon issued after a paid order with its code and value', async () => {
    myCoupons.mockResolvedValue({
      data: [
        {
          id: 5,
          code: 'NEXT-A1B2C3D4',
          description: 'پاداش سفارش GK-TEST-0001 برای خرید بعدی',
          discount_type: 'percentage',
          discount_value: 5,
          max_discount_amount: 150000,
          min_order_amount: 0,
          usage_limit: 1,
          usage_count: 0,
          is_active: true,
          valid_from: '2026-11-01T00:00:00Z',
          valid_until: '2026-12-01T00:00:00Z',
        },
      ],
    });
    renderAccount();

    expect(await screen.findByText('NEXT-A1B2C3D4')).toBeDefined();
    expect(screen.getByText(/۵٪ تا سقف/)).toBeDefined();
    expect(screen.getByText(/کد کوپن را در صفحهٔ پرداخت/)).toBeDefined();
  });

  it('states the next rung of the ladder in the server’s words', async () => {
    renderAccount();

    expect(await screen.findByText(/سطح ۲ — خریدار تأییدشده/)).toBeDefined();
    expect(screen.getByText(/با تأیید شماره تلفن/)).toBeDefined();
  });
});
