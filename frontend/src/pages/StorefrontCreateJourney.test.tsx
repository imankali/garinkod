// frontend/src/pages/StorefrontCreateJourney.test.tsx
//
// The stall-creation journey, end to end inside the app: directory → dialog →
// form → API → the seller's own page.
//
// Ten browser tests open a stall before they can test anything else, and all ten
// failed with "the stall was not created — the form said nothing", which named a
// symptom and nothing else. This file is the instrument that finds out why: it
// mounts the real directory page, the real dialog and the real form (only the
// network is stubbed), drives them through the same accessible labels the browser
// suite uses, and asserts the address bar. A journey that works here and not in a
// browser is a browser problem; one that fails here is the app, and the failure
// message says which step broke.

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Storefronts from './Storefronts';
import { renderApp, flush } from '../test/render';
import { signIn, signOut } from '../test/auth';
import { agricultureApi, locationsApi, storefrontPostsApi, storefrontsApi } from '../api/services';

vi.mock('../api/services', () => ({
  agricultureApi: {
    getStorefront: vi.fn(),
    createStorefront: vi.fn(),
    checkStorefrontAvailability: vi.fn(),
    listMarketplace: vi.fn(),
  },
  locationsApi: { provinces: vi.fn(), cities: vi.fn() },
  storefrontPostsApi: { list: vi.fn() },
  storefrontsApi: { list: vi.fn(), featured: vi.fn() },
}));

// The directory's cards, posts and product rows are covered by their own tests;
// stubbing them keeps the journey's DOM readable and the run fast. The dialog and
// the form inside it are the real ones.
vi.mock('../components/StorefrontCard', () => ({
  default: ({ storefront }: { storefront: { name: string; slug: string } }) => (
    <a href={`/storefronts/${storefront.slug}`}>{storefront.name}</a>
  ),
}));
vi.mock('../components/social/PostCard', () => ({
  default: ({ post }: { post: { id: number } }) => <div data-testid={`post-${post.id}`}>پست</div>,
}));
vi.mock('../components/MarketplaceListingCard', () => ({
  default: ({ listing }: { listing: { title: string } }) => <div>{listing.title}</div>,
}));

const emptyPage = { count: 0, results: [] as unknown[] };

/** 3971857299 is checksum-valid: the same code the browser suite types. */
const NATIONAL_ID = '3971857299';

function AvailablePage() {
  const location = useLocation();
  return <p data-testid="landed-on">{location.pathname}</p>;
}

function renderDirectory(route = '/storefronts?create=1') {
  return renderApp(
    <Routes>
      <Route path="/storefronts" element={<Storefronts />} />
      <Route path="/storefronts/:slug" element={<AvailablePage />} />
      <Route path="/login" element={<p data-testid="login-marker">صفحه ورود</p>} />
    </Routes>,
    { route },
  );
}

beforeEach(() => {
  signOut();
  vi.mocked(locationsApi.provinces).mockResolvedValue({
    data: { results: [{ id: 1, name: 'فارس' }] },
  } as never);
  vi.mocked(locationsApi.cities).mockResolvedValue({
    data: { results: [{ id: 2, name: 'شیراز' }] },
  } as never);
  vi.mocked(agricultureApi.listMarketplace).mockResolvedValue({ data: emptyPage } as never);
  vi.mocked(storefrontsApi.list).mockResolvedValue({ data: emptyPage } as never);
  vi.mocked(storefrontsApi.featured).mockResolvedValue({ data: [] } as never);
  vi.mocked(storefrontPostsApi.list).mockResolvedValue({ data: emptyPage } as never);
  vi.mocked(agricultureApi.getStorefront).mockResolvedValue({ data: null } as never);
  vi.mocked(agricultureApi.checkStorefrontAvailability).mockResolvedValue({
    data: {
      name: { available: true, reason: 'آزاد است', value: '' },
      slug: { available: true, reason: '', value: 'غرفه-استودیو', suggestion: '' },
    },
  } as never);
  vi.mocked(agricultureApi.createStorefront).mockResolvedValue({
    // A Persian slug is what the API really derives, and the address bar
    // percent-encodes it; the assertion below goes through the same encoder.
    data: { id: 9, name: 'غرفه استودیو', slug: 'غرفه-استودیو' },
  } as never);
});

/** Fill the dialog exactly as the browser suite does: by accessible name. */
async function openAndFill(user: ReturnType<typeof userEvent.setup>, name: string) {
  const dialog = await screen.findByRole('dialog', { name: 'ساخت غرفه' });
  await user.type(within(dialog).getByLabelText(/نام غرفه/), name);

  await user.selectOptions(within(dialog).getByLabelText(/^استان/), 'فارس');
  await user.selectOptions(within(dialog).getByLabelText(/^شهر/), 'شیراز');

  await user.type(within(dialog).getByLabelText('نام', { exact: true }), 'زهرا');
  await user.type(within(dialog).getByLabelText(/^نام خانوادگی/), 'بهاران');
  await user.type(within(dialog).getByLabelText('کد ملی'), NATIONAL_ID);
  return dialog;
}

describe('opening a stall from the directory', () => {
  it('takes the seller to their own page after the form submits', async () => {
    const user = userEvent.setup();
    signIn();
    renderDirectory();

    const dialog = await openAndFill(user, 'غرفه استودیو');

    // The live availability check has answered before the button is enabled, and
    // the promise the whole journey rests on is that it becomes clickable at all.
    const submit = within(dialog).getByRole('button', { name: /^ساخت غرفه$/ });
    await expect
      .poll(() => (submit as HTMLButtonElement).disabled, { timeout: 4000 })
      .toBe(false);

    await user.click(submit);
    await flush();

    expect(agricultureApi.createStorefront).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'غرفه استودیو', national_id: NATIONAL_ID }),
    );
    // The address bar is the assertion ten browser tests depend on. The router
    // hands back the decoded path (a browser percent-encodes it in the URL bar),
    // so this is the slug exactly as the API derived it.
    expect(screen.getByTestId('landed-on')).toHaveTextContent('/storefronts/غرفه-استودیو');
  });

  it('says why it refused when the error belongs to no field', async () => {
    // The exact answer the API gave for ten browser failures in a row: a 403
    // envelope with no `fields`, which the axios interceptor had already toasted
    // (`handled: true`). The form used to fall through both branches and print
    // nothing, so the report could only say "the form said nothing".
    const user = userEvent.setup();
    signIn();
    vi.mocked(agricultureApi.createStorefront).mockRejectedValue({
      response: {
        status: 403,
        data: {
          code: 'permission_denied',
          status: 403,
          error: 'شما اجازه دسترسی به این بخش را ندارید.',
        },
      },
      __handled: true,
    } as never);
    renderDirectory();

    const dialog = await openAndFill(user, 'غرفه بی‌پاسخ');
    const submit = within(dialog).getByRole('button', { name: /^ساخت غرفه$/ });
    await expect
      .poll(() => (submit as HTMLButtonElement).disabled, { timeout: 4000 })
      .toBe(false);
    await user.click(submit);
    await flush();

    const alerts = within(dialog).getAllByRole('alert').map((node) => node.textContent ?? '');
    expect(alerts.join(' ')).toContain('شما اجازه دسترسی به این بخش را ندارید.');
    // The seller is still on the form, not on the stall page.
    expect(screen.queryByTestId('landed-on')).toBeNull();
  });

  it('shows the server’s field error inside the dialog, with role="alert"', async () => {
    const user = userEvent.setup();
    signIn();
    vi.mocked(agricultureApi.createStorefront).mockRejectedValue({
      response: { status: 400, data: { name: ['این نام قبلاً استفاده شده است.'] } },
    } as never);
    renderDirectory();

    const dialog = await openAndFill(user, 'غرفه تکراری');
    const submit = within(dialog).getByRole('button', { name: /^ساخت غرفه$/ });
    await expect
      .poll(() => (submit as HTMLButtonElement).disabled, { timeout: 4000 })
      .toBe(false);
    await user.click(submit);
    await flush();

    // A refusal the screen reader never hears is the a11y half of the same bug.
    const alerts = within(dialog).getAllByRole('alert').map((node) => node.textContent ?? '');
    expect(alerts.join(' ')).toContain('این نام قبلاً استفاده شده است.');
  });
});
