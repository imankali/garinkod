// frontend/src/pages/Studio.test.tsx
//
// /api/levels/ promises level 3 «غرفه، آگهی و استودیو غرفه», and until now none
// of the three had a screen: a seller could not apply for a stall, could not
// post an آگهی, and could not read the reason a moderator rejected one.
//
// The two states this file pins:
//   • no stall  → the application form, with live availability of the name
//   • a stall   → their listings, including a rejected one's reason
//
// The other thing it holds: `status` is read-only on the serializer, so the page
// must never show an آگهی as «منتشر شده» on its own authority. Every pill in
// these assertions comes from the server's `status_label`.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getStorefront = vi.fn();
const myListings = vi.fn();
const createListing = vi.fn();
const deleteListing = vi.fn();
const checkAvailability = vi.fn();
const createStorefront = vi.fn();

vi.mock('../api/services', () => ({
  agricultureApi: {
    getStorefront: (...a: unknown[]) => getStorefront(...a),
    myListings: (...a: unknown[]) => myListings(...a),
    createListing: (...a: unknown[]) => createListing(...a),
    deleteListing: (...a: unknown[]) => deleteListing(...a),
    checkStorefrontAvailability: (...a: unknown[]) => checkAvailability(...a),
    createStorefront: (...a: unknown[]) => createStorefront(...a),
  },
}));

const auth = vi.hoisted(() => ({ signedIn: true }));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: auth.signedIn ? { id: 5, username: 'pesteh-rafsanjan' } : null }),
}));

import Studio from './Studio';

const stall = {
  id: 3,
  name: 'پسته رفسنجان',
  slug: 'پسته-رفسنجان',
  seller_type: 'merchant',
  seller_type_label: 'تاجر',
  bio: '',
  avatar: null,
  avatar_url: '',
  cover: null,
  cover_url: '',
  province: 'کرمان',
  city: 'رفسنجان',
  is_verified: false,
  is_active: true,
  commission_rate: '5.00',
  rating: '4.5',
  sales_count: 9,
  followers_count: 0,
  listing_count: 1,
  is_following: false,
  is_owner: true,
  has_active_stories: false,
  has_unseen_stories: false,
  owner_name: 'مالک',
  created_at: '2026-11-01T00:00:00+03:30',
  owner_national_id_masked: '***',
  profile_complete: true,
  card_number_masked: '****',
  logo_url: '',
};

const listing = (over: Record<string, unknown> = {}) => ({
  id: 5,
  storefront: stall,
  title: 'پسته اکبری صادراتی',
  slug: 'پسته-رفسنجان-پسته-اکبری-صادراتی',
  crop_name: 'پسته',
  description: 'کیفیت صادراتی.',
  price: 890000,
  unit: 'کیلوگرم',
  quantity_available: '800.00',
  min_order_quantity: '5.00',
  status: 'published',
  status_label: 'منتشر شده',
  rejection_reason: '',
  ...over,
});

function renderStudio() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Studio />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.signedIn = true;
  getStorefront.mockReset();
  myListings.mockReset();
  createListing.mockReset();
  deleteListing.mockReset();
  checkAvailability.mockReset();
  createStorefront.mockReset();
  myListings.mockResolvedValue({ data: [] });
});

describe('Studio — a seller with a stall', () => {
  it('lists their آگهی with the status the server gave it', async () => {
    getStorefront.mockResolvedValue({ data: stall });
    myListings.mockResolvedValue({
      data: [
        listing(),
        listing({ id: 6, title: 'پسته احمدآقایی', status: 'pending_review', status_label: 'در انتظار تأیید' }),
      ],
    });
    renderStudio();

    expect(await screen.findByText('پسته اکبری صادراتی')).toBeDefined();
    expect(screen.getByText('منتشر شده')).toBeDefined();
    expect(screen.getByText('در انتظار تأیید')).toBeDefined();
  });

  it('shows the moderator’s reason on a rejected آگهی', async () => {
    getStorefront.mockResolvedValue({ data: stall });
    myListings.mockResolvedValue({
      data: [
        listing({
          status: 'rejected',
          status_label: 'رد شده',
          rejection_reason: 'تصویر محصول با آگهی هم‌خوان نیست.',
        }),
      ],
    });
    renderStudio();

    expect(await screen.findByText('تصویر محصول با آگهی هم‌خوان نیست.')).toBeDefined();
    expect(screen.getByText('رد شده')).toBeDefined();
  });

  it('posts a new آگهی with the fields the serializer expects', async () => {
    getStorefront.mockResolvedValue({ data: stall });
    createListing.mockResolvedValue({
      data: listing({ id: 9, title: 'خیار گلخانه‌ای', status: 'pending_review', status_label: 'در انتظار تأیید' }),
    });
    renderStudio();

    await screen.findByText('پسته رفسنجان');
    await userEvent.click(screen.getByRole('button', { name: 'آگهی تازه' }));

    await userEvent.type(screen.getByLabelText('عنوان آگهی'), 'خیار گلخانه‌ای');
    await userEvent.type(screen.getByLabelText('محصول'), 'خیار');
    await userEvent.type(screen.getByLabelText('قیمت هر واحد'), '45000');
    await userEvent.type(screen.getByLabelText('موجودی'), '120');
    await userEvent.type(screen.getByLabelText('توضیح'), 'برداشت هفتهٔ جاری.');
    await userEvent.click(screen.getByRole('button', { name: 'ثبت آگهی' }));

    await waitFor(() => expect(createListing).toHaveBeenCalled());
    const payload = createListing.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.title).toBe('خیار گلخانه‌ای');
    expect(payload.price).toBe(45000);
    expect(payload.quantity_available).toBe('120');
  });

  it('deletes an آگهی through the owner-scoped endpoint', async () => {
    getStorefront.mockResolvedValue({ data: stall });
    myListings.mockResolvedValue({ data: [listing()] });
    deleteListing.mockResolvedValue({ data: { message: 'حذف شد' } });
    renderStudio();

    await screen.findByText('پسته اکبری صادراتی');
    await userEvent.click(screen.getByRole('button', { name: 'حذف آگهی پسته اکبری صادراتی' }));

    await waitFor(() => expect(deleteListing).toHaveBeenCalledWith('پسته-رفسنجان-پسته-اکبری-صادراتی'));
  });
});

describe('Studio — a seller without a stall', () => {
  it('offers the application form and checks the name as it is typed', async () => {
    getStorefront.mockResolvedValue({ data: null });
    checkAvailability.mockResolvedValue({
      data: { name: { value: 'باغ نو', available: false, reason: 'تکراری است' } },
    });
    renderStudio();

    const name = await screen.findByLabelText('نام غرفه');
    await userEvent.type(name, 'باغ نو');

    // Debounced, then asked once — not once per keystroke.
    await waitFor(() => expect(checkAvailability).toHaveBeenCalled(), { timeout: 3000 });
    expect(await screen.findByText('این نام قبلاً گرفته شده است.')).toBeDefined();
  });

  it('does not send an application without the owner’s identity', async () => {
    getStorefront.mockResolvedValue({ data: null });
    renderStudio();

    await screen.findByLabelText('نام غرفه');
    // The server requires first/last name and national ID: a stall nobody is
    // behind cannot be held responsible for a shipment.
    expect(screen.getByRole('button', { name: 'ارسال درخواست غرفه' }).hasAttribute('disabled')).toBe(true);
  });

  it('asks a signed-out visitor to sign in instead of showing a form', async () => {
    auth.signedIn = false;
    renderStudio();

    expect(await screen.findByText('برای استودیو غرفه وارد شوید')).toBeDefined();
    await waitFor(() => expect(getStorefront).not.toHaveBeenCalled());
  });
});
