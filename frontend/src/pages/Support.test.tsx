// frontend/src/pages/Support.test.tsx
//
// The support page promised «هر پیام یک شمارهٔ پیگیری میگیرد» while offering no
// way to send a message at all, and the FAQ pointed at a storefront complaint
// form that was not where it said it was. These tests hold the page to what it
// now does: a real form on POST /api/feedback/, a reply address that is
// actually required, and a reference number taken from the server's response
// rather than invented on the client.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const feedback = vi.fn();
const getContact = vi.fn();

const complaint = vi.fn();
const listStorefronts = vi.fn();

// Complaints are account-only on the server, so the page reads the auth store.
// `vi.hoisted` keeps the flag reachable from the hoisted mock factory.
const auth = vi.hoisted(() => ({ signedIn: true }));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: auth.signedIn }),
}));

vi.mock('../api/services', () => ({
  siteInfoApi: { getContact: (...args: unknown[]) => getContact(...args) },
  trustApi: {
    feedback: (...args: unknown[]) => feedback(...args),
    complaint: (...args: unknown[]) => complaint(...args),
  },
  storefrontsApi: { list: (...args: unknown[]) => listStorefronts(...args) },
}));

import Support from './Support';

const contact = {
  address: 'تهران، جاده مخصوص',
  provinces_note: 'ارسال به سراسر کشور',
  phones: ['۰۲۱-۴۴۵۵۶۶۷۷'],
  emails: ['salam@example.com'],
  working_hours: 'شنبه تا پنجشنبه ۸ تا ۱۸',
  whatsapp_number: '',
  telegram_url: '',
  instagram_url: '',
  eitaa_url: '',
  map_lat: '0',
  map_lng: '0',
  map_note: '',
  expert_name: '',
  expert_role: '',
  expert_photo: null,
  expert_photo_url: null,
  expert_note: '',
  updated_at: '',
};

function renderSupport() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/support']}>
        <Support />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.signedIn = true;
  feedback.mockReset();
  getContact.mockReset();
  getContact.mockResolvedValue({ data: contact });
  complaint.mockReset();
  listStorefronts.mockReset();
  listStorefronts.mockResolvedValue({
    data: {
      count: 1,
      next: null,
      previous: null,
      results: [{ id: 7, name: 'باغ سبز شیراز' }],
    },
  });
  complaint.mockResolvedValue({
    data: { complaint: { id: 31, status: 'open', status_label: 'در حال بررسی' }, message: 'شکایت ثبت شد.' },
  });
  feedback.mockResolvedValue({
    data: {
      feedback: { id: 12, status: 'new', status_label: 'جدید' },
      message: 'بازخورد شما ثبت شد.',
    },
  });
});

describe('Support', () => {
  it('prints the working hours the API publishes, not a sentence of its own', async () => {
    renderSupport();

    expect(await screen.findByText(/شنبه تا پنجشنبه ۸ تا ۱۸/)).toBeDefined();
    // The old lead promised a tracking number the page had no way to issue.
    expect(screen.queryByText(/هر پیام یک شمارهٔ پیگیری می‌گیرد/)).toBeNull();
  });

  it('refuses to send a note with no way to answer it', async () => {
    renderSupport();

    await userEvent.type(await screen.findByLabelText('عنوان'), 'سفارش نرسیده');
    await userEvent.type(screen.getByLabelText('متن پیام'), 'کد سفارش GK-TEST-0001 است.');
    await userEvent.click(screen.getByRole('button', { name: 'ارسال پیام' }));

    // No email, no request: a reply promise with no address is a dead end.
    expect(feedback).not.toHaveBeenCalled();
    expect(screen.getByText('برای دریافت پاسخ، ایمیل لازم است.')).toBeDefined();
  });

  it('sends the note and shows the reference number the server issued', async () => {
    renderSupport();

    await userEvent.type(await screen.findByLabelText('ایمیل برای پاسخ'), 'buyer@example.com');
    await userEvent.type(screen.getByLabelText('عنوان'), 'سفارش نرسیده');
    await userEvent.type(screen.getByLabelText('متن پیام'), 'کد سفارش GK-TEST-0001 است.');
    await userEvent.click(screen.getByRole('button', { name: 'ارسال پیام' }));

    await waitFor(() => expect(feedback).toHaveBeenCalledTimes(1));
    expect(feedback).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'buyer@example.com',
        subject: 'سفارش نرسیده',
        message: 'کد سفارش GK-TEST-0001 است.',
      }),
    );

    // The number comes from the response body, converted to Persian digits.
    expect(await screen.findByText('۱۲')).toBeDefined();
    expect(screen.getByText(/پیام شما ثبت شد/)).toBeDefined();
  });

  it('takes Persian digits into the email field as typed Latin ones', async () => {
    renderSupport();

    // A mobile keyboard on a Persian layout produces Persian digits; sending
    // those raw made the address unusable for the reply.
    await userEvent.type(await screen.findByLabelText('ایمیل برای پاسخ'), '۰۹۱۲۰۰۰۰۰۰۱');
    expect(screen.getByLabelText('ایمیل برای پاسخ')).toHaveValue('09120000001');
  });

  it('files a complaint against a storefront and prints the issued reference', async () => {
    renderSupport();

    // The FAQ sent people to «صفحهٔ همان غرفه» for a complaint form that did not
    // exist anywhere; the endpoint behind it was unused.
    await userEvent.click(await screen.findByRole('button', { name: 'ثبت شکایت' }));

    // Scoped to the complaint panel: the support form above it has its own
    // «عنوان» field, and an unscoped query would type into that one.
    const panel = within(await screen.findByRole('region', { name: 'شکایت از یک غرفه' }));

    await waitFor(() => expect(listStorefronts).toHaveBeenCalled());
    await userEvent.selectOptions(await panel.findByLabelText('غرفه'), '7');
    await userEvent.type(panel.getByLabelText('عنوان'), 'کالای متفاوت رسید');
    await userEvent.type(panel.getByLabelText('شرح ماجرا'), 'به جای بذر ذرت، بذر آفتابگردان فرستاده شد.');
    await userEvent.click(panel.getByRole('button', { name: 'ثبت شکایت' }));

    await waitFor(() => expect(complaint).toHaveBeenCalledTimes(1));
    expect(complaint).toHaveBeenCalledWith(
      expect.objectContaining({ storefront: 7, subject: 'کالای متفاوت رسید' }),
    );
    expect(await screen.findByText('۳۱')).toBeDefined();
    expect(screen.getByText(/در حال بررسی/)).toBeDefined();
  });

  it('does not send a complaint with no storefront chosen', async () => {
    renderSupport();

    await userEvent.click(await screen.findByRole('button', { name: 'ثبت شکایت' }));
    const panel = within(await screen.findByRole('region', { name: 'شکایت از یک غرفه' }));

    await userEvent.type(await panel.findByLabelText('عنوان'), 'کالای متفاوت رسید');
    await userEvent.type(panel.getByLabelText('شرح ماجرا'), 'به جای بذر ذرت، بذر آفتابگردان فرستاده شد.');
    await userEvent.click(panel.getByRole('button', { name: 'ثبت شکایت' }));

    expect(complaint).not.toHaveBeenCalled();
    expect(panel.getByText('غرفه را انتخاب کنید.')).toBeDefined();
  });

  it('asks a guest to sign in rather than showing a form the server refuses', async () => {
    auth.signedIn = false;
    renderSupport();

    // The endpoint is IsAuthenticated: a guest used to type out the whole
    // complaint and only then meet a 401.
    const gate = await screen.findByRole('link', { name: 'برای ثبت شکایت وارد شوید' });
    expect(gate).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'ثبت شکایت' })).toBeNull();
  });

  it('shows the server’s error instead of pretending the note was filed', async () => {
    feedback.mockRejectedValue({ response: { status: 429, data: { detail: 'درخواست‌های زیادی فرستاده‌اید.' } } });
    renderSupport();

    await userEvent.type(await screen.findByLabelText('ایمیل برای پاسخ'), 'buyer@example.com');
    await userEvent.type(screen.getByLabelText('عنوان'), 'سفارش نرسیده');
    await userEvent.type(screen.getByLabelText('متن پیام'), 'کد سفارش GK-TEST-0001 است.');
    await userEvent.click(screen.getByRole('button', { name: 'ارسال پیام' }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.queryByText(/پیام شما ثبت شد/)).toBeNull();
  });
});
