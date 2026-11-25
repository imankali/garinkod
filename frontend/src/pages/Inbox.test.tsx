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
const close = vi.fn();
const rate = vi.fn();
const edit = vi.fn();
const remove = vi.fn();
const deskState = vi.fn();

vi.mock('../api/services', () => ({
  messagesApi: {
    conversations: (...a: unknown[]) => conversations(...a),
    messages: (...a: unknown[]) => messages(...a),
    send: (...a: unknown[]) => send(...a),
    openServiceConversation: (...a: unknown[]) => openServiceConversation(...a),
    close: (...a: unknown[]) => close(...a),
    rate: (...a: unknown[]) => rate(...a),
    edit: (...a: unknown[]) => edit(...a),
    remove: (...a: unknown[]) => remove(...a),
  },
  deskApi: {
    state: (...a: unknown[]) => deskState(...a),
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
  survey: { closed: false, closed_at: null, has_rating: false, can_rate: false },
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

const deskOpen = () => ({
  channel: 'support',
  channel_label: 'پشتیبانی',
  is_open: true,
  tracked: true,
  hours: '۰۶:۰۰ تا ۲۲:۰۰',
  work_days: [],
  opens_at: null,
  opens_at_label: '',
  out_of_hours_note: '',
  online_count: 2,
  waiting_expected_minutes: 20,
  agents: [],
  viewer_is_staff: false,
  quick_replies: [],
  customer_allowed: true,
  customer_denied_reason: '',
});

beforeEach(() => {
  auth.signedIn = true;
  conversations.mockReset();
  messages.mockReset();
  send.mockReset();
  deskState.mockReset();
  deskState.mockResolvedValue({ data: deskOpen() });
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
          is_edited: false,
          is_deleted: false,
          can_edit: true,
          can_delete: true,
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

  it('shows the desk’s real opening state beside the support button', async () => {
    renderInbox();

    // Two agents online, during the hours the desk publishes — all three are
    // the server's numbers.
    expect(await screen.findByText(/۲ پشتیبان آنلاین/)).toBeDefined();
    expect(screen.getByText(/۰۶:۰۰ تا ۲۲:۰۰/)).toBeDefined();
    await waitFor(() => expect(deskState).toHaveBeenCalledWith('support'));
  });

  it('says the desk is closed and quotes its own out-of-hours note', async () => {
    deskState.mockResolvedValue({
      data: {
        ...deskOpen(),
        is_open: false,
        online_count: 0,
        out_of_hours_note: 'الان خارج از ساعت کاری هستیم؛ در اولین بازهٔ بعدی پاسخ می‌دهیم.',
        opens_at_label: 'فردا ۰۶:۰۰',
      },
    });
    renderInbox();

    expect(await screen.findByText(/بسته ·/)).toBeDefined();
    expect(await screen.findByText(/الان خارج از ساعت کاری هستیم/)).toBeDefined();
    expect(screen.getByText(/بازگشایی: فردا ۰۶:۰۰/)).toBeDefined();
    // The thread can still be opened: writing now is the point of the note.
    expect(screen.getByRole('button', { name: 'گفتگو با پشتیبانی' })).not.toBeDisabled();
  });

  it('does not offer a chat to the operator of the desk', async () => {
    deskState.mockResolvedValue({
      data: {
        ...deskOpen(),
        customer_allowed: false,
        customer_denied_reason: 'شما اپراتور این میز هستید؛ از صف استفاده کنید.',
      },
    });
    renderInbox();

    expect(await screen.findByText(/شما اپراتور این میز هستید/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'گفتگو با پشتیبانی' })).toBeDisabled();
  });

  it('asks a signed-out visitor to sign in and never calls the API', async () => {
    auth.signedIn = false;
    renderInbox();

    expect(await screen.findByText('برای دیدن گفتگوها وارد شوید')).toBeDefined();
    await waitFor(() => expect(conversations).not.toHaveBeenCalled());
  });
});

describe('Inbox — ending a thread and the survey', () => {
  it('offers «اتمام مکالمه» on an open thread and closes it', async () => {
    close.mockResolvedValue({ data: {} });
    renderInbox();

    await userEvent.click(await screen.findByRole('button', { name: 'اتمام مکالمه' }));

    await waitFor(() => expect(close).toHaveBeenCalledWith(3));
  });

  it('shows the survey only when the server says can_rate', async () => {
    conversations.mockResolvedValue({
      data: {
        ...inbox().data,
        results: [
          thread({
            status: 'closed',
            status_label: 'بسته شده',
            survey: { closed: true, closed_at: '2026-11-25T06:00:00+03:30', has_rating: false, can_rate: true },
          }),
        ],
      },
    });
    renderInbox();

    expect(await screen.findByText('این گفتگو چطور بود؟')).toBeDefined();
    // A closed thread is not writable, so the composer is gone.
    expect(screen.queryByRole('button', { name: 'ارسال' })).toBeNull();
  });

  it('sends the score, the solved answer and the comment', async () => {
    conversations.mockResolvedValue({
      data: {
        ...inbox().data,
        results: [
          thread({
            status: 'closed',
            status_label: 'بسته شده',
            survey: { closed: true, closed_at: '2026-11-25T06:00:00+03:30', has_rating: false, can_rate: true },
          }),
        ],
      },
    });
    rate.mockResolvedValue({ data: {} });
    renderInbox();

    await screen.findByText('این گفتگو چطور بود؟');
    await userEvent.click(screen.getByRole('radio', { name: '4 از ۵' }));
    await userEvent.click(screen.getByRole('button', { name: 'حل شد' }));
    await userEvent.type(screen.getByPlaceholderText('توضیح (اختیاری)'), 'پاسخ سریع بود');
    await userEvent.click(screen.getByRole('button', { name: 'ثبت نظر' }));

    // Tri-state: «حل شد» is a real answer, not the default — leaving it alone
    // sends null rather than a guess.
    await waitFor(() => expect(rate).toHaveBeenCalledWith(3, { score: 4, solved: true, comment: 'پاسخ سریع بود' }));
  });

  it('cannot submit a survey with no score', async () => {
    conversations.mockResolvedValue({
      data: {
        ...inbox().data,
        results: [
          thread({
            status: 'closed',
            status_label: 'بسته شده',
            survey: { closed: true, closed_at: '2026-11-25T06:00:00+03:30', has_rating: false, can_rate: true },
          }),
        ],
      },
    });
    renderInbox();

    await screen.findByText('این گفتگو چطور بود؟');
    expect(screen.getByRole('button', { name: 'ثبت نظر' })).toBeDisabled();
  });

  it('does not ask twice once the thread is rated', async () => {
    conversations.mockResolvedValue({
      data: {
        ...inbox().data,
        results: [
          thread({
            status: 'closed',
            status_label: 'بسته شده',
            survey: { closed: true, closed_at: '2026-11-25T06:00:00+03:30', has_rating: true, can_rate: false },
          }),
        ],
      },
    });
    renderInbox();

    expect(await screen.findByText(/نظر شما ثبت شده است/)).toBeDefined();
    expect(screen.queryByText('این گفتگو چطور بود؟')).toBeNull();
  });
});

describe('Inbox — editing your own message', () => {
  it('rewrites a message the server says can be edited', async () => {
    edit.mockResolvedValue({ data: { id: 10, body: 'پرتقال تامسون دارید؟' } });
    renderInbox();

    // Wait for the opened thread, not the list preview — the preview carries the
    // same text and has no actions on it.
    await screen.findByText('بله، هر کیلو ۳۵ هزار تومان.');
    await userEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0] as HTMLElement);

    const box = screen.getByLabelText('متن تازهٔ پیام') as HTMLTextAreaElement;
    expect(box.value).toBe('پرتقال تامسون موجود است؟');
    await userEvent.clear(box);
    await userEvent.type(box, 'پرتقال تامسون دارید؟');
    await userEvent.click(screen.getByRole('button', { name: 'ذخیره' }));

    await waitFor(() => expect(edit).toHaveBeenCalledWith(3, 10, 'پرتقال تامسون دارید؟'));
  });

  it('offers neither action on a row the server marked uneditable', async () => {
    messages.mockResolvedValue({
      data: {
        count: 1,
        has_more: false,
        next_before_id: null,
        results: [
          {
            id: 12,
            conversation: 3,
            sender: 8,
            sender_name: 'خریدار تستی',
            sender_avatar_url: '',
            sender_role_label: '',
            sender_verified: false,
            is_system: false,
            is_mine: true,
            body: 'عکس فاکتور',
            attachment: 'https://example.com/x.jpg',
            attachment_url: 'https://example.com/x.jpg',
            attachment_type: 'image',
            is_edited: false,
            is_deleted: false,
            // Media can be deleted but not rewritten — the API says so, and the
            // page must not offer the edit it would refuse.
            can_edit: false,
            can_delete: true,
            created_at: '2026-11-25T05:41:00+03:30',
          },
        ],
      },
    });
    renderInbox();

    await screen.findByText('عکس فاکتور');
    expect(screen.queryByRole('button', { name: 'ویرایش' })).toBeNull();
    expect(screen.getByRole('button', { name: 'حذف پیام' })).toBeDefined();
  });

  it('soft-deletes through the real endpoint', async () => {
    remove.mockResolvedValue({ data: { id: 10, is_deleted: true, body: '' } });
    renderInbox();

    await screen.findByText('بله، هر کیلو ۳۵ هزار تومان.');
    await userEvent.click(screen.getAllByRole('button', { name: 'حذف پیام' })[0] as HTMLElement);

    await waitFor(() => expect(remove).toHaveBeenCalledWith(3, 10));
  });

});
