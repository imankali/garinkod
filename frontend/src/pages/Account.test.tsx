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

vi.mock('../api/services', () => ({
  ordersApi: { mine: vi.fn(() => Promise.resolve({ data: [] })) },
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
