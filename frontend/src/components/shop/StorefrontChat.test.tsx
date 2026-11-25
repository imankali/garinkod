// frontend/src/components/shop/StorefrontChat.test.tsx
//
// «گفتگو با غرفه» used to be a link to the support page, which asked the buyer
// to describe a listing they were looking at. These tests hold the replacement:
//   • signed out, it points at /login instead of opening a thread with no owner,
//   • opening it gets (or creates) the thread with that storefront,
//   • the first message can be sent before the thread exists, and it carries
//     the listing the buyer was reading,
//   • a server refusal is shown inside the panel rather than swallowed.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/services', () => ({
  messagesApi: {
    getStorefrontConversation: vi.fn(),
    openStorefrontConversation: vi.fn(),
    messages: vi.fn(),
    send: vi.fn(),
  },
}));

import { messagesApi } from '../../api/services';
import StorefrontChat from './StorefrontChat';
import { createQueryClient, Providers } from '../../providers';
import { useAuthStore } from '../../store/authStore';

const renderChat = (listingId?: number) =>
  render(
    <Providers client={createQueryClient()}>
      <MemoryRouter>
        <StorefrontChat slug="sabz-dasht" name="غرفهٔ سبز دشت" listingId={listingId} />
      </MemoryRouter>
    </Providers>,
  );

const conversation = { id: 7, channel: 'storefront', status: 'open', subject: 'گفتگو' };

beforeEach(() => {
  useAuthStore.setState({ isAuthenticated: true, user: { id: 1, username: 'buyer' } } as never);
  vi.mocked(messagesApi.getStorefrontConversation).mockResolvedValue({ data: conversation } as never);
  vi.mocked(messagesApi.openStorefrontConversation).mockResolvedValue({ data: conversation } as never);
  vi.mocked(messagesApi.messages).mockResolvedValue({
    data: {
      count: 0,
      next: null,
      previous: null,
      results: [],
      conversation,
    },
  } as never);
  vi.mocked(messagesApi.send).mockResolvedValue({ data: { id: 1, body: 'سلام' } } as never);
});

describe('StorefrontChat', () => {
  it('sends a signed-out visitor to login instead of opening a thread', async () => {
    useAuthStore.setState({ isAuthenticated: false, user: null } as never);
    renderChat();

    expect(screen.getByRole('link', { name: /گفتگو با غرفه/ })).toHaveAttribute('href', '/login');
    expect(messagesApi.getStorefrontConversation).not.toHaveBeenCalled();
  });

  it('opens the existing thread with that storefront', async () => {
    renderChat();

    await userEvent.click(screen.getByRole('button', { name: /گفتگو با غرفه/ }));

    await waitFor(() => expect(messagesApi.getStorefrontConversation).toHaveBeenCalledWith('sabz-dasht'));
    expect(await screen.findByRole('dialog', { name: 'گفتگو با غرفهٔ سبز دشت' })).toBeDefined();
  });

  it('sends the first message even before a thread exists, with the listing attached', async () => {
    vi.mocked(messagesApi.getStorefrontConversation).mockResolvedValue({ data: null } as never);
    renderChat(42);

    await userEvent.click(screen.getByRole('button', { name: /گفتگو با غرفه/ }));
    await waitFor(() => expect(messagesApi.getStorefrontConversation).toHaveBeenCalled());

    await userEvent.type(screen.getByLabelText('متن پیام'), 'این گندم موجوده؟');
    await userEvent.click(screen.getByRole('button', { name: /ارسال/ }));

    await waitFor(() => expect(messagesApi.openStorefrontConversation).toHaveBeenCalledWith('sabz-dasht'));
    expect(messagesApi.send).toHaveBeenCalledWith(7, { body: 'این گندم موجوده؟', listing: 42 });
  });

  it('shows a refusal inside the panel', async () => {
    vi.mocked(messagesApi.send).mockRejectedValue({
      response: { data: { error: 'ارسال پیام در این ساعت ممکن نیست.' }, status: 403 },
    });
    renderChat();

    await userEvent.click(screen.getByRole('button', { name: /گفتگو با غرفه/ }));
    await waitFor(() => expect(messagesApi.messages).toHaveBeenCalled());

    await userEvent.type(screen.getByLabelText('متن پیام'), 'سلام');
    await userEvent.click(screen.getByRole('button', { name: /ارسال/ }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('ارسال پیام در این ساعت ممکن نیست'),
    );
  });

  it('closes on Escape', async () => {
    renderChat();

    await userEvent.click(screen.getByRole('button', { name: /گفتگو با غرفه/ }));
    expect(await screen.findByRole('dialog')).toBeDefined();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
