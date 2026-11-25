// frontend/src/pages/Storefronts.test.tsx
//
// The directory had no representation of «who I follow». `storefrontsApi.follow`
// and `unfollow` write that relationship and `following` reads it — the read had
// no caller, so following a stall raised its follower count and left the buyer
// with no list, no feed and no way back except remembering the stall's name.
//
// The two branches that matter: the followed list renders with each stall's
// live story count, and it is only fetched for a signed-in buyer on that tab —
// a guest must not send a request that can only 401.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.fn();
const following = vi.fn();

vi.mock('../api/services', () => ({
  storefrontsApi: {
    list: (...a: unknown[]) => list(...a),
    following: (...a: unknown[]) => following(...a),
  },
}));

const auth = vi.hoisted(() => ({ signedIn: true }));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: auth.signedIn ? { id: 8 } : null }),
}));

// The card is its own component with its own links; only the section under test
// needs to render here.
vi.mock('../components/shop/StorefrontCard', () => ({
  default: ({ storefront }: { storefront: { name: string } }) => <p>{storefront.name}</p>,
}));

import Storefronts from './Storefronts';

const stall = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'باغ سبز شیراز',
  slug: 'باغ-سبز-شیراز',
  seller_type: 'farmer',
  seller_type_label: 'کشاورز',
  bio: '',
  avatar: null,
  avatar_url: '',
  cover: null,
  cover_url: '',
  province: 'فارس',
  city: 'شیراز',
  is_verified: true,
  is_active: true,
  ...over,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Storefronts />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.signedIn = true;
  list.mockReset();
  following.mockReset();
  list.mockResolvedValue({
    data: { count: 2, results: [stall(), stall({ id: 2, name: 'تعاونی گرگان', slug: 'taavoni' })] },
  });
  following.mockResolvedValue({
    data: {
      count: 1,
      results: [
        {
          storefront: stall(),
          stories: [
            { id: 4, caption: 'برداشت امروز' },
            { id: 5, caption: 'بسته‌بندی' },
          ],
        },
      ],
    },
  });
});

describe('Storefronts', () => {
  it('lists the directory by default', async () => {
    renderPage();

    expect(await screen.findByText('باغ سبز شیراز')).toBeDefined();
    expect(screen.getByText('تعاونی گرگان')).toBeDefined();
    // The followed list is not fetched until its tab is opened.
    expect(following).not.toHaveBeenCalled();
  });

  it('shows the stalls the buyer follows, with their live story count', async () => {
    renderPage();
    await screen.findByText('باغ سبز شیراز');

    await userEvent.click(screen.getByRole('tab', { name: /دنبال‌شده‌ها/ }));

    await waitFor(() => expect(following).toHaveBeenCalled());
    expect(await screen.findByText('۲ استوری تازه')).toBeDefined();
  });

  it('says the list is empty rather than showing a blank grid', async () => {
    following.mockResolvedValue({ data: { count: 0, results: [] } });
    renderPage();
    await screen.findByText('باغ سبز شیراز');

    await userEvent.click(screen.getByRole('tab', { name: /دنبال‌شده‌ها/ }));

    expect(await screen.findByText('هنوز غرفه‌ای را دنبال نمی‌کنید')).toBeDefined();
  });

  it('offers no following tab to a guest', async () => {
    auth.signedIn = false;
    renderPage();
    await screen.findByText('باغ سبز شیراز');

    // Following is a signed-in relationship; a tab that could only 401 is not
    // offered at all.
    expect(screen.queryByRole('tab', { name: /دنبال‌شده‌ها/ })).toBeNull();
    expect(following).not.toHaveBeenCalled();
  });
});
