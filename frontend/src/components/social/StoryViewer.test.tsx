// frontend/src/components/social/StoryViewer.test.tsx
//
// The viewer's Instagram contract: like with optimistic state, private reply
// to the غرفه, swipe-down to close, horizontal swipe to walk stories, and
// sliding into the next circle at the end of a group.

import { screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StoryViewer from './StoryViewer';
import { renderAppSettled } from '../../test/render';
import { messagesApi, storefrontPostsApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';

vi.mock('../../api/services', () => ({
  storefrontPostsApi: { like: vi.fn(), unlike: vi.fn() },
  messagesApi: { openStorefrontConversation: vi.fn(), send: vi.fn() },
}));

const STORY = (id: number, over: Record<string, unknown> = {}) =>
  ({
    id,
    storefront: 1,
    storefront_name: 'باغ سبز',
    storefront_slug: 'bagh-sabz',
    storefront_avatar_url: '/a.jpg',
    image_url: `/s${id}.jpg`,
    caption: `استوری ${id}`,
    like_count: 3,
    is_liked: false,
    is_seen: false,
    ...over,
  }) as never;

const renderViewer = (props: Partial<Parameters<typeof StoryViewer>[0]> = {}) =>
  renderAppSettled(
    <StoryViewer
      stories={[STORY(1), STORY(2)]}
      storefrontName="باغ سبز"
      storefrontSlug="bagh-sabz"
      onSeen={() => undefined}
      onClose={() => undefined}
      {...props}
    />,
    { route: '/' },
  );

beforeEach(() => {
  vi.mocked(storefrontPostsApi.like).mockResolvedValue({
    data: { is_liked: true, like_count: 4 },
  } as never);
  vi.mocked(storefrontPostsApi.unlike).mockResolvedValue({
    data: { is_liked: false, like_count: 3 },
  } as never);
  useAuthStore.setState({ isAuthenticated: false });
});

afterEach(() => {
  useAuthStore.setState({ isAuthenticated: false });
});

describe('the story viewer', () => {
  it('likes optimistically and syncs with the server', async () => {
    await renderViewer();
    const like = screen.getByRole('button', { name: 'لایک استوری' });
    fireEvent.click(like);
    // Optimistic: the count moves before the API resolves.
    expect(await screen.findByText('۴')).toBeInTheDocument();
    await waitFor(() =>
      expect(storefrontPostsApi.like).toHaveBeenCalledWith(1),
    );
  });

  it('unlikes when the story is already liked', async () => {
    await renderViewer({ stories: [STORY(1, { is_liked: true, like_count: 9 })] });
    const unlike = screen.getByRole('button', { name: 'برداشتن لایک' });
    fireEvent.click(unlike);
    expect(await screen.findByText('۸')).toBeInTheDocument();
    await waitFor(() => expect(storefrontPostsApi.unlike).toHaveBeenCalledWith(1));
  });

  it('rolls the heart back when the server rejects the like', async () => {
    vi.mocked(storefrontPostsApi.like).mockRejectedValue(new Error('offline'));
    await renderViewer();
    fireEvent.click(screen.getByRole('button', { name: 'لایک استوری' }));
    expect(await screen.findByText('۴')).toBeInTheDocument();
    expect(await screen.findByText('۳')).toBeInTheDocument();
  });

  it('invites a signed-out viewer to log in instead of showing the reply box', async () => {
    await renderViewer();
    const login = screen.getByRole('link', { name: /وارد حساب شوید/ });
    expect(login).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'ارسال پیام' })).not.toBeInTheDocument();
  });

  it('sends a private reply to the storefront', async () => {
    useAuthStore.setState({ isAuthenticated: true });
    vi.mocked(messagesApi.openStorefrontConversation).mockResolvedValue({
      data: { id: 77 },
    } as never);
    vi.mocked(messagesApi.send).mockResolvedValue({ data: {} } as never);

    await renderViewer();
    fireEvent.change(screen.getByLabelText('ارسال پیام به باغ سبز'), {
      target: { value: 'سلام، قیمت کود چند است؟' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ارسال پیام' }));

    await waitFor(() => expect(messagesApi.openStorefrontConversation).toHaveBeenCalledWith('bagh-sabz'));
    await waitFor(() =>
      expect(messagesApi.send).toHaveBeenCalledWith(77, { body: 'سلام، قیمت کود چند است؟' }),
    );
  });

  it('closes when swiped down', async () => {
    const onClose = vi.fn();
    const { container } = await renderViewer({ onClose });
    const dialog = container.querySelector('[role="dialog"]')!;
    fireEvent.touchStart(dialog, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(dialog, { touches: [{ clientX: 100, clientY: 260 }] });
    fireEvent.touchEnd(dialog, { changedTouches: [{ clientX: 100, clientY: 260 }] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('advances on a horizontal swipe and does not close', async () => {
    const onClose = vi.fn();
    const { container } = await renderViewer({ onClose });
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(screen.getByText('استوری 1')).toBeInTheDocument();
    fireEvent.touchStart(dialog, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(dialog, { changedTouches: [{ clientX: 120, clientY: 110 }] });
    expect(screen.getByText('استوری 2')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('slides into the next circle at the end of the group', async () => {
    const onClose = vi.fn();
    const onNextGroup = vi.fn(() => true);
    await renderViewer({ onClose, onNextGroup });
    fireEvent.click(screen.getByRole('button', { name: 'استوری بعدی' }));
    fireEvent.click(screen.getByRole('button', { name: 'استوری بعدی' }));
    expect(onNextGroup).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes at the very end of the strip', async () => {
    const onClose = vi.fn();
    const onNextGroup = vi.fn(() => false);
    await renderViewer({ onClose, onNextGroup });
    fireEvent.click(screen.getByRole('button', { name: 'استوری بعدی' }));
    fireEvent.click(screen.getByRole('button', { name: 'استوری بعدی' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
