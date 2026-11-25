// frontend/src/pages/Inbox.tsx
//
// The buyer's messages.
//
// `messagesApi.conversations` returns the whole inbox — five channels (غرفه,
// پشتیبانی, پشتیبانی کشاورزان, پاسخ به دیدگاه, خرید محصولات کشاورزان), the last
// message of each thread, and an unread count per channel. Nothing called it.
// The only chat in the app was `StorefrontChat`, which lives inside a storefront
// page and forgets the thread the moment you navigate away: a buyer who wrote to
// a stall could not find that conversation again, and the support desk had no
// door at all because `openServiceConversation` was unused too.
//
// Four operations, all on the real endpoints:
//   • open a thread and reply inside it;
//   • «گفتگو با پشتیبانی» — get-or-create the support thread (the server
//     returns the existing one if there is one, so this cannot spam a queue);
//   • «اتمام مکالمه» — close a thread, which is what unlocks the survey;
//   • the survey itself, once per closed thread.
//
// Closing and rating were served and unreachable: `messagesApi.close` and
// `messagesApi.rate` had no caller, so a question that got answered stayed
// "open" forever and the satisfaction card could never appear. The desk's own
// copy promises it — «گفتگو پایان یافت» — with no button behind it.

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Headset, Mail, MessageCircle, Star } from 'lucide-react';
import { Link } from 'react-router';

import { messagesApi } from '../api/services';
import type { MessageChannel, InboxResponse, StorefrontConversation } from '@/types/messaging';
import { parseApiError } from '../api/errors';
import { cn } from '../lib/cn';
import { dateTime } from '../lib/date';
import { useTitle } from '../lib/useTitle';
import { useAuthStore } from '../store/authStore';
import PageHead from '../components/shop/PageHead';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

const CHANNEL_FILTERS: Array<{ value: MessageChannel | 'all'; label: string }> = [
  { value: 'all', label: 'همه' },
  { value: 'storefront', label: 'غرفه‌ها' },
  { value: 'support', label: 'پشتیبانی' },
  { value: 'consulting', label: 'کشاورزی' },
  { value: 'comment', label: 'دیدگاه‌ها' },
  { value: 'procurement', label: 'خرید محصول' },
];

/**
 * The satisfaction survey — 1 to 5, «حل شد؟», and one line of comment.
 *
 * A star row rather than a slider: five radios read correctly to a screen
 * reader and are answerable with a thumb. The comment is optional because the
 * server treats it that way; `solved` is tri-state because «نمی‌دانم» is a real
 * answer and both «بله» and «خیر» would be putting words in the farmer's mouth.
 */
function Survey({
  onRate,
  pending,
}: {
  onRate: (payload: { score: number; solved: boolean | null; comment: string }) => void;
  pending: boolean;
}) {
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');

  return (
    <form
      className="border-t border-line p-3 dark:border-night-line"
      onSubmit={(event) => {
        event.preventDefault();
        if (!score) return;
        onRate({ score, solved, comment: comment.trim() });
      }}
    >
      <p className="text-2xs font-extrabold text-ink dark:text-white">
        این گفتگو چطور بود؟
      </p>
      <fieldset className="mt-2">
        <legend className="sr-only">امتیاز از ۱ تا ۵</legend>
        <div className="flex flex-row-reverse justify-end gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="score"
                value={value}
                checked={score === value}
                onChange={() => setScore(value)}
                className="peer sr-only"
                aria-label={`${value} از ۵`}
              />
              <Star
                size={20}
                aria-hidden="true"
                className={cn(
                  'transition-colors duration-150',
                  value <= score ? 'text-gold-600' : 'text-line dark:text-night-line',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500',
                )}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {[
          { value: true, label: 'حل شد' },
          { value: false, label: 'حل نشد' },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={solved === option.value}
            onClick={() => setSolved(solved === option.value ? null : option.value)}
            className={cn(
              'rounded-sm border px-2 py-1 text-[11px] font-bold transition-colors duration-150',
              solved === option.value
                ? 'border-brand-500 bg-brand-50 text-brand-900 dark:border-brand-600 dark:bg-night dark:text-brand-100'
                : 'border-line text-ink-mute dark:border-night-line dark:text-white/50',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="mt-2 block">
        <span className="sr-only">توضیح (اختیاری)</span>
        <input
          type="text"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={1000}
          placeholder="توضیح (اختیاری)"
          className="h-9 w-full rounded-md border border-line bg-transparent px-2 text-2xs text-ink placeholder:text-ink-mute focus:border-brand-500 focus:outline-none dark:border-night-line dark:text-white"
        />
      </label>

      <Button type="submit" size="sm" className="mt-2" loading={pending} disabled={!score}>
        ثبت نظر
      </Button>
    </form>
  );
}

function Thread({ conversation }: { conversation: StorefrontConversation }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const messages = useQuery({
    queryKey: ['thread', conversation.id],
    queryFn: async () => (await messagesApi.messages(conversation.id, { pageSize: 50 })).data,
    // Same rule as the storefront chat: a live conversation is the one place
    // polling is not a lie.
    refetchInterval: conversation.status === 'open' ? 20 * 1000 : false,
  });

  const send = useMutation({
    mutationFn: async (body: string) => messagesApi.send(conversation.id, { body }),
    onSuccess: () => {
      setDraft('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['thread', conversation.id] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
    onError: (caught) => setError(parseApiError(caught).message),
  });

  const close = useMutation({
    mutationFn: async () => (await messagesApi.close(conversation.id)).data,
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['thread', conversation.id] });
    },
    onError: (caught) => setError(parseApiError(caught).message),
  });

  const rate = useMutation({
    mutationFn: async (payload: { score: number; solved: boolean | null; comment: string }) =>
      messagesApi.rate(conversation.id, payload),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['thread', conversation.id] });
    },
    onError: (caught) => setError(parseApiError(caught).message),
  });

  const rows = messages.data?.results ?? [];

  return (
    <div className="rounded-lg border border-line bg-paper dark:border-night-line dark:bg-night-soft">
      <div className="flex items-center justify-between gap-2 border-b border-line p-3 dark:border-night-line">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-ink dark:text-white">
            {conversation.counterpart_name || conversation.channel_label}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-mute dark:text-white/45">
            {conversation.channel_label}
            {conversation.subject && ` · ${conversation.subject}`}
            {conversation.status === 'closed' && ' · بسته شده'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {conversation.status === 'open' && (
            <button
              type="button"
              onClick={() => close.mutate()}
              disabled={close.isPending}
              className="text-[11px] font-bold text-ink-mute underline decoration-line underline-offset-2 hover:text-ink disabled:opacity-50 dark:text-white/45 dark:hover:text-white"
            >
              اتمام مکالمه
            </button>
          )}
          <span className="dateline text-[11px] text-ink-mute dark:text-white/40">
            {dateTime(conversation.updated_at)}
          </span>
        </div>
      </div>

      <div className="max-h-[22rem] overflow-y-auto p-3">
        {messages.isLoading ? (
          <Skeleton className="h-16" />
        ) : rows.length === 0 ? (
          <p className="text-2xs text-ink-mute dark:text-white/45">پیامی در این گفتگو نیست.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((message) => (
              <li
                key={message.id}
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-2xs leading-6',
                  message.is_mine
                    ? 'self-end bg-brand-50 text-ink dark:bg-night dark:text-white/85'
                    : 'self-start border border-line text-ink-soft dark:border-night-line dark:text-white/70',
                )}
              >
                {!message.is_mine && (
                  <p className="mb-0.5 text-[10px] font-bold text-ink-mute dark:text-white/45">
                    {message.sender_name}
                    {message.sender_verified && ' · تأییدشده'}
                  </p>
                )}
                <p className="whitespace-pre-line">{message.body}</p>
                <p className="dateline mt-1 text-[10px] text-ink-mute dark:text-white/35">
                  {dateTime(message.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {conversation.status === 'open' ? (
        <form
          className="flex items-end gap-2 border-t border-line p-3 dark:border-night-line"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim() || send.isPending) return;
            send.mutate(draft.trim());
          }}
        >
          <label className="flex-1">
            <span className="sr-only">پیام</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              placeholder="پاسخ خود را بنویسید…"
              className="w-full resize-none rounded-md border border-line bg-transparent px-3 py-2 text-2xs leading-6 text-ink placeholder:text-ink-mute focus:border-brand-500 focus:outline-none dark:border-night-line dark:text-white"
            />
          </label>
          <Button type="submit" size="sm" loading={send.isPending} disabled={!draft.trim()}>
            ارسال
          </Button>
        </form>
      ) : (
        <>
          {/* Closing is not a lock — the server reopens a thread on the next
              message — so the footer says that instead of sending the buyer off
              to open a duplicate thread. */}
          <button
            type="button"
            onClick={() => close.mutate()}
            className="w-full border-t border-line p-3 text-start text-[11px] text-ink-mute hover:text-ink dark:border-night-line dark:text-white/45 dark:hover:text-white"
          >
            این گفتگو بسته شده است. برای ادامه، پیام تازه‌ای بنویسید یا برای باز کردن دوباره بزنید.
          </button>
        </>
      )}

      {conversation.survey?.can_rate && (
        <Survey onRate={(payload: { score: number; solved: boolean | null; comment: string }) => rate.mutate(payload)} pending={rate.isPending} />
      )}
      {conversation.survey?.has_rating && !conversation.survey.can_rate && (
        <p className="border-t border-line px-3 py-2 text-[11px] text-ink-mute dark:border-night-line dark:text-white/45">
          سپاس — نظر شما ثبت شده است.
        </p>
      )}

      {error && (
        <p role="alert" className="px-3 pb-3 text-2xs font-bold text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}

export default function Inbox() {
  useTitle('گفتگوها');
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<MessageChannel | 'all'>('all');
  const [active, setActive] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inbox = useQuery({
    queryKey: ['inbox', channel],
    queryFn: async () =>
      (
        await messagesApi.conversations(channel === 'all' ? undefined : channel)
      ).data as InboxResponse & { results: StorefrontConversation[] },
    enabled: Boolean(user),
  });

  const openSupport = useMutation({
    mutationFn: async () => (await messagesApi.openServiceConversation('support')).data,
    onSuccess: (answer) => {
      setError(null);
      // The endpoint is get-or-create, so the thread may be an old one: select
      // it and refresh the list rather than assuming a new row appeared.
      const created = answer as unknown as { id?: number; conversation?: { id: number } };
      const id = created.id ?? created.conversation?.id ?? null;
      if (id) setActive(id);
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
    onError: (caught) => setError(parseApiError(caught).message),
  });

  // Select the first thread once the list arrives, so the page is never an empty
  // right-hand column next to a full list.
  const rows = useMemo(() => inbox.data?.results ?? [], [inbox.data]);
  useEffect(() => {
    if (active === null && rows.length > 0) setActive(rows[0]?.id ?? null);
  }, [active, rows]);

  if (!user) {
    return (
      <div className="shell py-16">
        <EmptyState
          icon={Mail}
          title="برای دیدن گفتگوها وارد شوید"
          description="گفتگو با غرفه‌دار، پشتیبانی و کارشناس کشاورزی زیر همین حساب ذخیره می‌شود."
          action={
            <Button to="/login" size="sm">
              ورود
            </Button>
          }
        />
      </div>
    );
  }

  const current = rows.find((row) => row.id === active) ?? null;
  const unread = inbox.data?.unread_total ?? 0;

  return (
    <div className="shell flex flex-col gap-5 py-8">
      <PageHead
        title="گفتگوها"
        lead={
          unread > 0
            ? `${unread} پیام خوانده‌نشده در گفتگوهای شما هست.`
            : 'گفتگوهای شما با غرفه‌داران، پشتیبانی و کارشناسان — همه در یک جا.'
        }
        actions={
          <Button
            size="sm"
            icon={Headset}
            loading={openSupport.isPending}
            onClick={() => openSupport.mutate()}
          >
            گفتگو با پشتیبانی
          </Button>
        }
      />

      {error && (
        <p role="alert" className="text-2xs font-bold text-danger-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="کانال گفتگو">
        {CHANNEL_FILTERS.map((filter) => {
          const count =
            filter.value === 'all'
              ? inbox.data?.count ?? 0
              : inbox.data?.unread_by_channel?.[filter.value] ?? 0;
          return (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={channel === filter.value}
              onClick={() => {
                setChannel(filter.value);
                setActive(null);
              }}
              className={cn(
                'inline-flex min-h-8 items-center gap-1 rounded-sm px-2 text-2xs font-bold transition-colors',
                channel === filter.value
                  ? 'bg-brand-700 text-white'
                  : 'border border-line text-ink-soft hover:border-brand-400 dark:border-night-line dark:text-white/65',
              )}
            >
              {filter.label}
              {count > 0 && filter.value !== 'all' && (
                <span className="dateline rounded-full bg-danger-500 px-1 text-[10px] text-white">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {inbox.isLoading ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="گفتگویی در این کانال نیست"
          description="از صفحهٔ یک غرفه «گفتگو با غرفه» را بزنید، یا با پشتیبانی شروع کنید."
          action={
            <Button size="sm" variant="secondary" onClick={() => openSupport.mutate()}>
              گفتگو با پشتیبانی
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line dark:divide-night-line dark:border-night-line">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setActive(row.id)}
                  aria-current={row.id === active ? 'true' : undefined}
                  className={cn(
                    'flex w-full flex-col gap-1 px-3 py-2.5 text-start transition-colors',
                    row.id === active
                      ? 'bg-brand-50 dark:bg-night-soft'
                      : 'hover:bg-brand-50/50 dark:hover:bg-night-soft',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold text-ink dark:text-white">
                      {row.counterpart_name || row.channel_label}
                    </span>
                    {row.unread_count > 0 && (
                      <span className="dateline shrink-0 rounded-full bg-danger-500 px-1.5 text-[10px] font-bold text-white">
                        {row.unread_count}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-[11px] text-ink-mute dark:text-white/45">
                    {row.last_message?.body || row.channel_label}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {current ? (
            <Thread conversation={current} />
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-line text-2xs text-ink-mute dark:border-night-line dark:text-white/40">
              یک گفتگو را انتخاب کنید.
            </div>
          )}
        </div>
      )}

      <p className="flex items-center gap-1 text-[11px] text-ink-mute dark:text-white/40">
        <ArrowRight size={11} aria-hidden="true" className="rotate-180" />
        برای شروع گفتگو با یک غرفه،{' '}
        <Link to="/storefronts" className="font-bold text-brand-700 hover:underline dark:text-brand-300">
          غرفه‌ها
        </Link>{' '}
        را ببینید.
      </p>
    </div>
  );
}
