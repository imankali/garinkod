// frontend/src/pages/StorefrontPage.test.tsx
//
// A storefront's profile response has always carried its posts, stories and
// highlights; the page rendered listings and two counters, so a farmer's
// photographs and announcements reached nobody. These tests hold the page to
// the data it already receives, and to the rule that a social counter is
// whatever the server last said — not a local increment.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const profile = vi.fn();
const follow = vi.fn();
const unfollow = vi.fn();
const like = vi.fn();
const unlike = vi.fn();
const comments = vi.fn();
const addComment = vi.fn();
const markManySeen = vi.fn();

vi.mock('../api/services', () => ({
  storefrontsApi: {
    profile: (...args: unknown[]) => profile(...args),
    follow: (...args: unknown[]) => follow(...args),
    unfollow: (...args: unknown[]) => unfollow(...args),
  },
  storefrontPostsApi: {
    like: (...args: unknown[]) => like(...args),
    unlike: (...args: unknown[]) => unlike(...args),
    comments: (...args: unknown[]) => comments(...args),
    addComment: (...args: unknown[]) => addComment(...args),
    markManySeen: (...args: unknown[]) => markManySeen(...args),
  },
}));

const auth = vi.hoisted(() => ({ signedIn: true }));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean; user: unknown }) => unknown) =>
    selector({ isAuthenticated: auth.signedIn, user: auth.signedIn ? { id: 4 } : null }),
}));

// The page's chat panel has its own network surface; it is not under test here.
vi.mock('../components/shop/StorefrontChat', () => ({ default: () => null }));

import StorefrontPage from './StorefrontPage';

const storefront = {
  id: 1,
  name: 'باغ سبز شیراز',
  slug: 'باغ-سبز-شیراز',
  seller_type: 'farmer',
  seller_type_label: 'کشاورز',
  bio: 'تولیدکننده مرکبات',
  avatar: null,
  avatar_url: '',
  cover: null,
  cover_url: '',
  province: 'فارس',
  city: 'شیراز',
  is_verified: true,
  is_active: true,
  is_following: false,
  is_owner: false,
};

const post = {
  id: 1,
  storefront: 1,
  storefront_name: 'باغ سبز شیراز',
  storefront_slug: 'باغ-سبز-شیراز',
  storefront_avatar_url: '',
  storefront_is_verified: true,
  listing: null,
  post_type: 'post' as const,
  post_type_label: 'پست',
  caption: 'برداشت امسال پرتقال شروع شد.',
  image: null,
  image_url: '',
  status: 'published',
  status_label: 'منتشر شده',
  expires_at: null,
  created_at: '2026-11-25T05:30:41+03:30',
  updated_at: '2026-11-25T05:30:41+03:30',
  like_count: 1,
  comment_count: 2,
  is_liked: false,
  is_seen: false,
  is_owner: false,
};

const story = {
  ...post,
  id: 2,
  post_type: 'story' as const,
  post_type_label: 'استوری',
  caption: 'امروز در باغ',
  expires_at: '2026-11-26T05:30:41+03:30',
};

const profilePayload = (over: Record<string, unknown> = {}) => ({
  data: {
    storefront,
    listings: [],
    posts: [post],
    stories: [story],
    highlights: [],
    counts: { listings: 0, posts: 1, stories: 1, followers: 1 },
    ...over,
  },
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/storefront/باغ-سبز-شیراز']}>
        <Routes>
          <Route path="/storefront/:slug" element={<StorefrontPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.signedIn = true;
  profile.mockReset();
  follow.mockReset();
  unfollow.mockReset();
  like.mockReset();
  unlike.mockReset();
  comments.mockReset();
  addComment.mockReset();
  markManySeen.mockReset();

  profile.mockResolvedValue(profilePayload());
  follow.mockResolvedValue({ data: { is_following: true, followers_count: 15 } });
  unfollow.mockResolvedValue({ data: { is_following: false, followers_count: 14 } });
  like.mockResolvedValue({ data: { is_liked: true, like_count: 5 } });
  unlike.mockResolvedValue({ data: { is_liked: false, like_count: 4 } });
  comments.mockResolvedValue({
    data: {
      count: 1,
      results: [
        {
          id: 9,
          post: 1,
          parent: null,
          body: 'قیمت هر کیلو چقدر است؟',
          author_name: 'خریدار',
          author_avatar_url: '',
          is_mine: false,
          can_moderate: false,
          replies: [],
          created_at: '2026-11-25T05:40:00+03:30',
        },
      ],
    },
  });
  addComment.mockResolvedValue({ data: {} });
  markManySeen.mockResolvedValue({ data: { marked: 1 } });
});

describe('StorefrontPage feed', () => {
  it('renders the post the profile already returned', async () => {
    renderPage();

    // This caption was in the payload and on no screen.
    expect(await screen.findByText('برداشت امسال پرتقال شروع شد.')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'از این غرفه' })).toBeDefined();
  });

  it('shows a story ring and records the watch once, for the batch', async () => {
    renderPage();

    const ring = await screen.findByRole('button', { name: /استوری/ });
    await userEvent.click(ring);

    // One request for the strip, not one per ring.
    await waitFor(() => expect(markManySeen).toHaveBeenCalledWith([2]));
    expect(await screen.findByRole('dialog', { name: 'استوری غرفه' })).toBeDefined();
  });

  it('sends a like to the server rather than bumping a local counter', async () => {
    renderPage();

    // The count on screen is the profile's, and the click is a request — the
    // page never increments its own copy, because two readers' totals would
    // then disagree with the one the server stores.
    const button = await screen.findByRole('button', { name: 'لایک' });
    expect(button.textContent).toContain('۱');

    await userEvent.click(button);
    await waitFor(() => expect(like).toHaveBeenCalledWith(1));
  });

  it('sends an unlike when the viewer already liked the post', async () => {
    profile.mockResolvedValue(profilePayload({ posts: [{ ...post, is_liked: true, like_count: 2 }] }));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'برداشتن لایک' }));

    await waitFor(() => expect(unlike).toHaveBeenCalledWith(1));
    expect(like).not.toHaveBeenCalled();
  });

  it('opens the comments and posts a new one', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /نظر|۲/ }));

    expect(await screen.findByText('قیمت هر کیلو چقدر است؟')).toBeDefined();
    await userEvent.type(screen.getByLabelText('نظر شما'), 'سلام، موجود دارید؟');
    await userEvent.click(screen.getByRole('button', { name: 'ثبت' }));

    await waitFor(() => expect(addComment).toHaveBeenCalledWith(1, 'سلام، موجود دارید؟'));
  });

  it('asks a guest to sign in instead of showing a comment box', async () => {
    auth.signedIn = false;
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /نظر|۲/ }));

    expect(await screen.findByText(/برای نوشتن نظر وارد حساب خود شوید/)).toBeDefined();
    expect(screen.queryByLabelText('نظر شما')).toBeNull();
  });

  it('renders nothing extra for a storefront with no posts or stories', async () => {
    profile.mockResolvedValue(profilePayload({ posts: [], stories: [], counts: { listings: 0, posts: 0, stories: 0, followers: 0 } }));
    renderPage();

    // The page must not grow an empty «از این غرفه» heading for a quiet seller.
    await waitFor(() => expect(screen.getByText('باغ سبز شیراز')).toBeDefined());
    expect(screen.queryByRole('heading', { name: 'از این غرفه' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'استوری‌ها' })).toBeNull();
  });
});

describe('StorefrontPage — following a stall', () => {
  it('offers the follow button and shows the count the server returns', async () => {
    renderPage();
    await screen.findByText('باغ سبز شیراز');

    const button = await screen.findByRole('button', { name: 'دنبال کردن' });
    await userEvent.click(button);

    await waitFor(() => expect(follow).toHaveBeenCalledWith('باغ-سبز-شیراز'));

    // The label flips because the server said so, not because a local flag did.
    expect(await screen.findByRole('button', { name: 'دنبال می‌کنید' })).toBeDefined();
  });

  it('does not show a follow button to the stall’s own owner', async () => {
    profile.mockResolvedValue(profilePayload({ storefront: { ...storefront, is_owner: true } }));
    renderPage();
    await screen.findByText('باغ سبز شیراز');

    expect(screen.queryByRole('button', { name: 'دنبال کردن' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'دنبال می‌کنید' })).toBeNull();
  });
});
