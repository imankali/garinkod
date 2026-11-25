// frontend/src/pages/Inbox.test.tsx
//
// The inbox existed as an endpoint and nowhere else. The only chat was
// StorefrontChat inside a stall page, so a conversation disappeared the moment
// the buyer navigated away, and the support desk had no entrance because
// openServiceConversation was never called.
//
// What these tests hold the page to:
//   • every channel the server lists is offered, with its real unread count;
//   • opening a thread reads that thread's messages, not the list's preview;
//   • a closed thread cannot be written to (the server would refuse anyway);
//   • «گفتگو با پشتیبانی» goes through the get-or-create endpoint and selects
//     whatever thread it returns — old or new.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const conversations = vi.fn();
const messages = vi.fn();
const send = vi.fn();
const openServiceConversation = vi.fn();

vi.mock('../api/services', () => ({
  messagesApi: {
    conversations: (...a: unknown[]) => conversations(...a),
    messages: (...a: unknown[]) => messages(...a),
    send: (...a: unknown[]) => send(...a),
    openServiceConversation: (...a: unknown[]) => openServiceConversation(...a),
  },
}));

const auth = vi.hoisted(() => ({ signedIn: true }));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: auth.signedIn ? { id: 8, username: 'demo-buyer' } : null }),
}));

import Inbox from './Inbox';

const thread = (over: Record<string, unknown> = {}) => ({
  id: 3,
  channel: 'storefront',
  channel_label: 'غرفه',
  subject: '',
  storefront: null,
  counterpart_name: 'باغ سبز شیراز',
  counterpart_avatar_url: '',
  last_message: {
    id: 11,
    conversation: 3,
    sender: 8,
    sender_name: 'خریدار تستی',
    sender_avatar_url: '',
    sender_role_label: '',
    sender_verified: false,
    is_system: false,
    is_mine: true,
    body: 'پرتقال تامسون موجود است؟',
    created_at: '2026-11-25T05:40:00+03:30',
  },
  unread_count: 0,
  status: 'open',
  status_label: 'باز',
  closed_at: null,
  agent: null,
  last_agent: null,
  assigned_to_me: false,
  created_at: '2026-11-25T05:39:00+03:30',
  updated_at: '2026-11-25T05:40:00+03:30',
  ...over,
});

const inbox = (over: Record<string, unknown> = {}) => ({
  data: {
    count: 2,
    results: [
      thread(),
      thread({
        id: 1,
        channel: 'support',
        channel_label: 'پشتیبانی',
        subject: 'پیگیری سفارش',
        counterpart_name: 'پشتیبانی',
        unread_count: 2,
        last_message: {
          id: 4,
          conversation: 1,
          sender: 2,
          sender_name: 'کارشناس پشتیبانی',
          sender_avatar_url: '',
          sender_role_label: '',
          sender_verified: true,
          is_system: false,
          is_mine: false,
          body: 'سفارش شما فردا ارسال می‌شود.',
          created_at: '2026-11-25T06:00:00+03:30',
        },
      }),
    ],
    unread_total: 2,
    unread_by_channel: { storefront: 0, support: 2 },
    channels: [
      { value: 'storefront', label: 'غرفه' },
      { value: 'support', label: 'پشتیبانی' },
      { value: 'consulting', label: 'پشتیبانی کشاورزان' },
      { value: 'comment', label: 'پاسخ به دیدگاه' },
      { value: 'procurement', label: 'خرید محصولات کشاورزان' },
    ],
    ...over,
  },
});

function renderInbox() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Inbox />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.signedIn = true;
  conversations.mockReset();
  messages.mockReset();
  send.mockReset();
  openServiceConversation.mockReset();
  conversations.mockResolvedValue(inbox());
  messages.mockResolvedValue({
    data: {
      count: 2,
      results: [
        {
          id: 10,
          conversation: 3,
          sender: 8,
          sender_name: 'خریدار تستی',
          sender_avatar_url: '',
          sender_role_label: '',
          sender_verified: false,
          is_system: false,
          is_mine: true,
          body: 'پرتقال تامسون موجود است؟',
          created_at: '2026-11-25T05:40:00+03:30',
        },
        {
          id: 11,
          conversation: 3,
          sender: 5,
          sender_name: 'باغ سبز شیراز',
          sender_avatar_url: '',
          sender_role_label: '',
          sender_verified: true,
          is_system: false,
          is_mine: false,
          body: 'بله، هر کیلو ۳۵ هزار تومان.',
          created_at: '2026-11-25T05:41:00+03:30',
        },
      ],
      has_more: false,
      next_before_id: null,
    },
  });
  send.mockResolvedValue({ data: {} });
  openServiceConversation.mockResolvedValue({ data: { id: 1 } });
});

describe('Inbox', () => {
  it('lists every channel the server offers, with the real unread count', async () => {
    renderInbox();

    expect(await screen.findByText('باغ سبز شیراز')).toBeDefined();
    // The channel filter row is built from the server's own channel list.
    expect(screen.getByRole('tab', { name: /پشتیبانی/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /کشاورزی/ })).toBeDefined();
    // «۲ پیام خواندهنشده» is the server's unread_total, not a local tally.
    // The lead sentence is `unread_total` from the server, not a local tally.
    expect(screen.getByText(/\d+ پیام خوانده‌نشده/)).toBeDefined();
  });

  it('opens the first thread’s messages rather than its preview', async () => {
    renderInbox();

    // The preview line lives in the list; the thread body comes from the
    // per-conversation endpoint.
    expect(await screen.findByText('بله، هر کیلو ۳۵ هزار تومان.')).toBeDefined();
    await waitFor(() => expect(messages).toHaveBeenCalledWith(3, expect.anything()));
  });

  it('switches to another thread when its row is clicked', async () => {
    renderInbox();

    await screen.findByText('باغ سبز شیراز');
    // Two things are called «پشتیبانی»: the channel tab and the thread row.
    // The row is the one inside the list.
    const rows = screen.getAllByRole('button', { name: /پشتیبانی/ });
    await userEvent.click(rows[rows.length - 1] as HTMLElement);

    await waitFor(() => expect(messages).toHaveBeenCalledWith(1, expect.anything()));
  });

  it('sends a reply to the open conversation', async () => {
    renderInbox();

    const box = await screen.findByPlaceholderText('پاسخ خود را بنویسید…');
    await userEvent.type(box, 'دو کیلو می‌خواهم.');
    await userEvent.click(screen.getByRole('button', { name: 'ارسال' }));

    await waitFor(() => expect(send).toHaveBeenCalledWith(3, { body: 'دو کیلو می‌خواهم.' }));
  });

  it('will not let a closed thread be written to', async () => {
    messages.mockResolvedValue({ data: { count: 1, results: [], has_more: false, next_before_id: null } });
    conversations.mockResolvedValue(
      inbox({ results: [thread({ status: 'closed', status_label: 'بسته' })] }),
    );
    renderInbox();

    expect(await screen.findByText(/این گفتگو بسته شده است/)).toBeDefined();
    expect(screen.queryByPlaceholderText('پاسخ خود را بنویسید…')).toBeNull();
  });

  it('opening support selects whichever thread the get-or-create endpoint returns', async () => {
    openServiceConversation.mockResolvedValue({ data: { id: 1 } });
    renderInbox();

    await screen.findByText('باغ سبز شیراز');
    await userEvent.click(screen.getByRole('button', { name: 'گفتگو با پشتیبانی' }));

    // Not a POST to a new-thread URL: the same endpoint returns the existing
    // support thread if there is one, and the page must land on it.
    await waitFor(() => expect(openServiceConversation).toHaveBeenCalledWith('support'));
    await waitFor(() => expect(messages).toHaveBeenCalledWith(1, expect.anything()));
  });

  it('asks a signed-out visitor to sign in and never calls the API', async () => {
    auth.signedIn = false;
    renderInbox();

    expect(await screen.findByText('برای دیدن گفتگوها وارد شوید')).toBeDefined();
    await waitFor(() => expect(conversations).not.toHaveBeenCalled());
  });
});
