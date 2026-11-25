// frontend/src/components/shop/StorefrontFeed.test.tsx
//
// The feed was built and the comments endpoint wired, but a comment's `replies`
// were dropped: a buyer asked «موجوده؟» on the seller's post, the seller
// answered, and the answer lived only in the inbox notification. On the page the
// question sat there looking ignored.
//
// What these hold:
//   • a seller's reply is visible under the comment it answers;
//   • the composer posts to the real endpoint and does not invent a row;
//   • a post with no comments says so instead of rendering an empty list.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const comments = vi.fn();
const addComment = vi.fn();
const like = vi.fn();
const unlike = vi.fn();
const markManySeen = vi.fn();

vi.mock('../../api/services', () => ({
  storefrontPostsApi: {
    comments: (...a: unknown[]) => comments(...a),
    addComment: (...a: unknown[]) => addComment(...a),
    like: (...a: unknown[]) => like(...a),
    unlike: (...a: unknown[]) => unlike(...a),
    markManySeen: (...a: unknown[]) => markManySeen(...a),
  },
}));

const auth = vi.hoisted(() => ({ signedIn: true }));

vi.mock('../../store/authStore', () => ({
  // The component reads `isAuthenticated`, not the user object; a mock that
  // only provides `user` reports "signed out" and hides the composer.
  useAuthStore: (selector: (state: { user: unknown; isAuthenticated: boolean }) => unknown) =>
    selector({
      user: auth.signedIn ? { id: 8, username: 'demo-buyer' } : null,
      isAuthenticated: auth.signedIn,
    }),
}));

import StorefrontFeed from './StorefrontFeed';

const post = {
  id: 1,
  post_type: 'post' as const,
  caption: 'پرتقال تامسون امسال شیرین شده.',
  image_url: '',
  media_url: '',
  listing: null,
  storefront: 3,
  storefront_slug: 'باغ-سبز-شیراز',
  storefront_name: 'باغ سبز شیراز',
  likes_total: 4,
  comment_count: 2,
  is_liked: false,
  is_seen: true,
  created_at: '2026-11-24T09:00:00+03:30',
  expires_at: null,
};

const comment = (over: Record<string, unknown> = {}) => ({
  id: 1,
  post: 1,
  parent: null,
  body: 'برای خرید عمده پرتقال هم از همین‌جا سفارش بدهم؟',
  author_name: 'خریدار تستی',
  author_avatar_url: '',
  is_mine: false,
  can_moderate: false,
  replies: [],
  created_at: '2026-11-24T10:00:00+03:30',
  ...over,
});

function renderFeed() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StorefrontFeed posts={[post] as never} stories={[]} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  comments.mockReset();
  addComment.mockReset();
  like.mockReset();
  unlike.mockReset();
  markManySeen.mockReset();
  auth.signedIn = true;
  comments.mockResolvedValue({ data: { count: 0, results: [] } });
});

describe('StorefrontFeed — comments', () => {
  it('shows the seller answer under the question it answers', async () => {
    comments.mockResolvedValue({
      data: {
        count: 2,
        results: [
          comment({
            replies: [
              comment({
                id: 2,
                parent: 1,
                body: 'بله، بالای ۱۰۰ کیلوگرم در چت غرفه پیام بدهید تا فاکتور عمده صادر کنیم.',
                author_name: 'باغ سبز شیراز',
              }),
            ],
          }),
        ],
      },
    });
    renderFeed();

    await userEvent.click(screen.getByRole('button', { name: '۲' }));

    expect(await screen.findByText(/برای خرید عمده پرتقال/)).toBeDefined();
    expect(
      await screen.findByText(/بالای ۱۰۰ کیلوگرم در چت غرفه پیام بدهید/),
    ).toBeDefined();
  });

  it('says there are none rather than rendering an empty thread', async () => {
    renderFeed();

    await userEvent.click(screen.getByRole('button', { name: '۲' }));
    expect(await screen.findByText('هنوز نظری نیست.')).toBeDefined();
  });

  it('posts a new comment to the real endpoint', async () => {
    addComment.mockResolvedValue({ data: comment({ id: 9, is_mine: true, body: 'قیمت عمده؟' }) });
    renderFeed();

    await userEvent.click(screen.getByRole('button', { name: '۲' }));
    await userEvent.type(await screen.findByLabelText('نظر شما'), 'قیمت عمده؟');
    await userEvent.click(screen.getByRole('button', { name: 'ثبت' }));

    await waitFor(() => expect(addComment).toHaveBeenCalledWith(1, 'قیمت عمده؟'));
  });

  it('does not offer a composer to a signed-out reader', async () => {
    auth.signedIn = false;
    renderFeed();

    await userEvent.click(screen.getByRole('button', { name: '۲' }));
    expect(await screen.findByText(/برای نوشتن نظر وارد حساب خود شوید/)).toBeDefined();
    expect(screen.queryByLabelText('نظر شما')).toBeNull();
  });
});
