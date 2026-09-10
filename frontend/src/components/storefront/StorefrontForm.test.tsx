// frontend/src/components/storefront/StorefrontForm.test.tsx
//
// The one form that opens a storefront, and the reason it asks for an identity.
//
// A stall is now only as anonymous as its owner is unidentifiable: the form must
// refuse to submit without a checksum-valid کد ملی, must show the server's field
// errors where they belong, and must not lose what a signed-out visitor typed
// while they sign in. Those are the promises a plain restyle can break.

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StorefrontForm from './StorefrontForm';
import { renderApp } from '../../test/render';
import { signIn, signOut } from '../../test/auth';
import { agricultureApi } from '../../api/services';
import { NATIONAL_ID_ERRORS } from '../../utils/nationalId';

vi.mock('../../api/services', () => ({
  agricultureApi: {
    checkStorefrontAvailability: vi.fn(),
    createStorefront: vi.fn(),
  },
}));

// The picker fetches a province tree no form test cares about; this stub lets a
// test fill the location in one click.
vi.mock('../LocationPicker', () => ({
  default: ({ idPrefix, onProvinceChange, onCityChange }: {
    idPrefix: string;
    onProvinceChange: (value: string) => void;
    onCityChange: (value: string) => void;
  }) => (
    <>
      {/* Two clicks, because a real picker changes the province and the city in
          two separate interactions — one handler calling both would be writing
          the city onto a stale copy of the form. */}
      <button type="button" data-testid={`pick-province-${idPrefix}`} onClick={() => onProvinceChange('فارس')}>
        استان
      </button>
      <button type="button" data-testid={`pick-city-${idPrefix}`} onClick={() => onCityChange('شیراز')}>
        شهر
      </button>
    </>
  ),
}));

const checkedName = { name: { available: true, reason: 'آزاد است' }, slug: { available: true } };

function renderForm(options: { onCreated?: (storefront: unknown) => void } = {}) {
  return renderApp(
    <Routes>
      <Route
        path="/storefronts"
        element={<StorefrontForm variant="dialog" onCreated={options.onCreated ?? (() => {})} />}
      />
      {/* The login page echoes what the gate handed over, which is the whole
          point of the round trip: the form must be reachable again. */}
      <Route path="/login" element={<LoginPage />} />
    </Routes>,
    { route: '/storefronts' },
  );
}

function LoginPage() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '';
  return <p data-testid="login-marker">صفحه ورود — بازگشت: {from}</p>;
}

async function fillBasics() {
  await userEvent.type(screen.getByLabelText(/نام غرفه/), 'غرفه باغ تست');
  await userEvent.click(screen.getByTestId('pick-province-store'));
  await userEvent.click(screen.getByTestId('pick-city-store'));
}

beforeEach(() => {
  // Most of this form is a seller's form; the signed-out case names itself.
  signIn();
  vi.mocked(agricultureApi.checkStorefrontAvailability).mockResolvedValue({ data: checkedName } as never);
});

describe('the identity block', () => {
  it('will not submit without a name, a family name and a national code', async () => {
    // A profile with no names at all is the case the block exists for.
    signIn({ first_name: '', last_name: '' });
    renderForm();
    await fillBasics();
    const submit = screen.getByRole('button', { name: 'ساخت غرفه' });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('نام'), 'زهرا');
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('نام خانوادگی'), 'بهاران');
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('کد ملی'), '3971857299');
    expect(submit).toBeEnabled();
  });

  it('starts from the profile it already knows, so only the code is typed', async () => {
    signIn({ first_name: 'مریم', last_name: 'تهرانی' });
    renderForm();
    expect(screen.getByLabelText('نام')).toHaveValue('مریم');
    expect(screen.getByLabelText('نام خانوادگی')).toHaveValue('تهرانی');
  });

  it('explains a bad check digit with the server\'s own words', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('کد ملی'), '0084575988');
    expect(await screen.findByText(NATIONAL_ID_ERRORS.checksum, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByLabelText('کد ملی')).toHaveAttribute('aria-invalid', 'true');
  });

  it('counts the ten digits even when they are written in Persian', async () => {
    renderForm();
    await fillBasics();
    await userEvent.type(screen.getByLabelText('نام'), 'زهرا');
    await userEvent.type(screen.getByLabelText('نام خانوادگی'), 'بهاران');
    await userEvent.type(screen.getByLabelText('کد ملی'), '۳۹۷۱۸۵۷۲۹۹');
    expect(screen.getByRole('button', { name: 'ساخت غرفه' })).toBeEnabled();
  });

  it('marks the code fields while the person is still typing, not after', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('کد ملی'), '1234');
    expect(await screen.findByText(NATIONAL_ID_ERRORS.format)).toBeInTheDocument();
  });
});

describe('the live name check', () => {
  it('asks the registry as soon as the name is long enough', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/نام غرفه/), 'باغ سبز');
    expect(await screen.findByText('آزاد است', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(agricultureApi.checkStorefrontAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'باغ سبز' }),
    );
  });

  it('refuses a name that is taken, and says so on the field', async () => {
    vi.mocked(agricultureApi.checkStorefrontAvailability).mockResolvedValue({
      data: { name: { available: false, reason: 'این نام قبلاً ثبت شده است.' } },
    } as never);
    renderForm();
    await userEvent.type(screen.getByLabelText(/نام غرفه/), 'باغ سبز شیراز');
    expect(await screen.findByText('این نام قبلاً ثبت شده است.', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByLabelText(/نام غرفه/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('is usable while signed out, because a name is public knowledge', async () => {
    signOut();
    renderForm();
    await userEvent.type(screen.getByLabelText(/نام غرفه/), 'غرفه‌ای تازه');
    expect(await screen.findByText('آزاد است', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/برای ثبت نهایی، وارد حساب خود شوید/)).toBeInTheDocument();
  });
});

describe('submitting', () => {
  it('sends the trimmed form, with the identity the account keeps', async () => {
    const created = { id: 12, slug: 'ghorfe-bagh-test', name: 'غرفه باغ تست' };
    const onCreated = vi.fn();
    vi.mocked(agricultureApi.createStorefront).mockResolvedValue({ data: created } as never);
    renderForm({ onCreated });

    await fillBasics();
    await userEvent.type(screen.getByLabelText('کد ملی'), ' 3971857299 ');
    await userEvent.click(screen.getByRole('button', { name: 'ساخت غرفه' }));

    expect(agricultureApi.createStorefront).toHaveBeenCalledWith({
      name: 'غرفه باغ تست',
      slug: undefined,
      seller_type: 'farmer',
      bio: '',
      province: 'فارس',
      city: 'شیراز',
      owner_first_name: 'زهرا',
      owner_last_name: 'بهاران',
      national_id: '3971857299',
    });
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it('puts the server\'s field error back on the input it came from', async () => {
    vi.mocked(agricultureApi.createStorefront).mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: 'اعتبارسنجی ناموفق بود',
          code: 'validation_error',
          fields: { name: ['این نام قبلاً ثبت شده است.'] },
        },
      },
    } as never);
    renderForm();
    await fillBasics();
    await userEvent.type(screen.getByLabelText('کد ملی'), '3971857299');
    await userEvent.click(screen.getByRole('button', { name: 'ساخت غرفه' }));

    const status = await screen.findByText('این نام قبلاً ثبت شده است.');
    expect(within(document.getElementById('store-name-status') as HTMLElement).getByText(status.textContent ?? '')).toBeInTheDocument();
  });
});

describe('signing in from the middle of the form', () => {
  it('keeps every typed value through the login round trip', async () => {
    signOut();
    renderForm();
    await fillBasics();
    // With no profile to copy from, a signed-out visitor types the identity
    // themselves — the form stays fillable, it only refuses to finish without one.
    await userEvent.type(screen.getByLabelText('نام'), 'زهرا');
    await userEvent.type(screen.getByLabelText('نام خانوادگی'), 'بهاران');
    await userEvent.type(screen.getByLabelText('کد ملی'), '3971857299');
    await userEvent.click(screen.getByRole('button', { name: 'ورود و ساخت غرفه' }));

    const login = await screen.findByTestId('login-marker');
    expect(login.textContent).toBe('صفحه ورود — بازگشت: /storefronts?create=1');
    const draft = sessionStorage.getItem('garinkod:storefront-draft') ?? '';
    expect(draft).toContain('غرفه باغ تست');
    expect(draft).toContain('3971857299');

    // Back from login: the draft is restored, once — the copy is then discarded
    // so a second visit to the form is not haunted by an old stall name.
    renderForm();
    expect(screen.getByLabelText(/نام غرفه/)).toHaveValue('غرفه باغ تست');
    expect(screen.getByLabelText('کد ملی')).toHaveValue('3971857299');
    expect(sessionStorage.getItem('garinkod:storefront-draft')).toBeNull();
  });
});
