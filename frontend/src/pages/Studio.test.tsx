// frontend/src/pages/Studio.test.tsx
//
// استودیو غرفه is a door, not a room: the nav item must land an owner on their
// own page, a seller-to-be on the one create form, and a signed-out visitor on
// the login page with /studio remembered. Each of those three is a redirect with
// a reason, and each one is easy to lose while "improving" the page.

import { screen } from '@testing-library/react';
import { Route, Routes, useSearchParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Studio from './Studio';
import { renderApp } from '../test/render';
import { sessionPending, signIn, signOut } from '../test/auth';
import { agricultureApi } from '../api/services';

vi.mock('../api/services', () => ({ agricultureApi: { getStorefront: vi.fn() } }));

vi.mock('../components/storefront/StorefrontForm', () => ({
  default: ({ onCreated }: { onCreated: (created: { slug: string }) => void }) => (
    <button type="button" onClick={() => onCreated({ slug: 'my-store' })}>
      فرم ساخت غرفه
    </button>
  ),
}));

function OwnPage() {
  const [params] = useSearchParams();
  return <p data-testid="own-page">تب: {params.get('tab') ?? ''}</p>;
}

function renderStudio() {
  return renderApp(
    <Routes>
      <Route path="/studio" element={<Studio />} />
      <Route
        path="/login"
        element={
          <p>
            ورود — بازگشت: <span data-testid="login-marker">/login</span>
          </p>
        }
      />
      <Route path="/storefronts/:slug" element={<OwnPage />} />
    </Routes>,
    { route: '/studio' },
  );
}

beforeEach(() => {
  vi.mocked(agricultureApi.getStorefront).mockResolvedValue({ data: null } as never);
});

describe('the three cases', () => {
  it('sends a signed-out visitor to login, remembering where they came from', async () => {
    signOut();
    renderStudio();
    expect(await screen.findByTestId('login-marker')).toBeInTheDocument();
    expect(screen.getByText(/ورود — بازگشت/)).toBeInTheDocument();
    // No stall lookup for somebody with no session.
    expect(agricultureApi.getStorefront).not.toHaveBeenCalled();
  });

  it('opens the create form for a signed-in user without a stall', async () => {
    signIn();
    renderStudio();
    expect(await screen.findByRole('button', { name: 'فرم ساخت غرفه' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /اول غرفه‌تان را بسازید/ })).toBeInTheDocument();
  });

  it('takes an owner to their own page, on the publishing tab', async () => {
    signIn();
    vi.mocked(agricultureApi.getStorefront).mockResolvedValue({
      data: { id: 4, slug: 'my-store', name: 'غرفه من' },
    } as never);
    renderStudio();
    expect((await screen.findByTestId('own-page')).textContent).toBe('تب: posts');
  });

  it('offers the form rather than an error when the lookup fails', async () => {
    signIn();
    vi.mocked(agricultureApi.getStorefront).mockRejectedValue(new Error('offline'));
    renderStudio();
    expect(await screen.findByRole('button', { name: 'فرم ساخت غرفه' })).toBeInTheDocument();
  });

  it('waits for the session before deciding anything', () => {
    // Rendering the create form for a fraction of a second before redirecting an
    // owner away is the bug this state exists to prevent: a stranger must not be
    // invited to open a second stall, and an owner must not see a form at all.
    sessionPending();
    renderStudio();
    expect(screen.queryByRole('button', { name: 'فرم ساخت غرفه' })).not.toBeInTheDocument();
    expect(screen.getByText('در حال بررسی وضعیت غرفه', { exact: false })).toBeInTheDocument();
  });
});
