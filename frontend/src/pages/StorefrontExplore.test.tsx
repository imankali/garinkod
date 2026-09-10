// frontend/src/pages/StorefrontExplore.test.tsx
//
// کاوش is the whole feed, the way an explore grid is: every seller's posts, ranked
// server-side by what people liked, with no storefront filter and no "one per
// stall" rule. The page is also the only place the merged storefronts block links
// to for more than five posts, so its paging has to keep what is on screen rather
// than replace it.

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StorefrontExplore from './StorefrontExplore';
import { flush, renderAppSettled } from '../test/render';
import { storefrontPostsApi } from '../api/services';

vi.mock('../api/services', () => ({ storefrontPostsApi: { list: vi.fn() } }));

vi.mock('../components/social/PostCard', () => ({
  default: ({ post }: { post: { id: number; caption: string } }) => (
    <p>{post.caption}</p>
  ),
}));

const page = (from: number, count: number, total: number) => ({
  data: {
    results: Array.from({ length: count }, (_, index) => ({
      id: from + index,
      caption: `پست ${from + index}`,
      storefront_name: 'باغ سبز',
      like_count: from + index,
      comment_count: 0,
      image_url: '',
      created_at: '2026-01-01T00:00:00Z',
    })),
    count: total,
  },
});

beforeEach(() => {
  vi.mocked(storefrontPostsApi.list).mockResolvedValue(page(1, 4, 12) as never);
});

describe('the grid', () => {
  it('asks for every seller\'s posts, ranked by likes, without naming a storefront', async () => {
    await renderAppSettled(<StorefrontExplore />, { route: '/explore' });
    await screen.findByText('پست 1');
    expect(storefrontPostsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ post_type: 'post', ordering: '-likes_total', page: 1 }),
    );
    const [params] = vi.mocked(storefrontPostsApi.list).mock.calls[0] as [{ storefront?: string }];
    expect(params.storefront).toBeUndefined();
  });

  it('adds the next page underneath what is already on screen', async () => {
    await renderAppSettled(<StorefrontExplore />, { route: '/explore' });
    await screen.findByText('پست 1');
    vi.mocked(storefrontPostsApi.list).mockResolvedValue(page(5, 4, 12) as never);

    await userEvent.click(screen.getByRole('button', { name: 'پست‌های بیشتر' }));

    expect(await screen.findByText('پست 8')).toBeInTheDocument();
    expect(screen.getByText('پست 1')).toBeInTheDocument();
    expect(storefrontPostsApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it('stops offering more once the feed is exhausted', async () => {
    vi.mocked(storefrontPostsApi.list).mockResolvedValue(page(1, 3, 3) as never);
    await renderAppSettled(<StorefrontExplore />, { route: '/explore' });
    await screen.findByText('پست 3');
    expect(screen.queryByRole('button', { name: 'پست‌های بیشتر' })).not.toBeInTheDocument();
  });

  it('opens a tile as a dialog the reader can close', async () => {
    await renderAppSettled(<StorefrontExplore />, { route: '/explore' });
    await screen.findByText('پست 1');
    // Every tile is labelled «پست <storefront>», so the first one is the one the
    // test opens — and the dialog is what proves which post it carried along.
    await userEvent.click(screen.getAllByRole('button', { name: /پست باغ سبز/ })[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('پست 1')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'بستن' }));
    // The overlay leaves through an exit animation, so "closed" is a state the
    // test has to wait for — asserting right after the click passed only while
    // the machine was fast enough to finish the animation first.
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 4000,
    });
    await flush();
  });
});
