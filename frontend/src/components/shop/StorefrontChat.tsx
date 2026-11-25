// frontend/src/components/shop/StorefrontChat.tsx

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send, X } from 'lucide-react';

import { messagesApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/cn';
import Button from '../ui/Button';

/**
 * The chat with one storefront, in a panel.
 *
 * Why a panel and not a page: a buyer asks «این موجوده؟» while looking at the
 * listing, and sending them to an inbox loses the thing they were asking about.
 * The thread is created on first open (the API is get-or-create), and the whole
 * component only renders for a signed-in visitor — an anonymous thread would
 * have no one to reply to.
 *
 * Reading, sending and the resulting unread state all come from the server; the
 * panel holds text and nothing else, so two tabs cannot disagree about the
 * conversation.
 */
export default function StorefrontChat({
  slug,
  name,
  listingId,
}: {
  /** The storefront's own slug, which is what the API addresses threads by. */
  slug: string;
  /** Shown in the panel header so it is obvious who is being written to. */
  name: string;
  /** An optional listing to attach to the first message. */
  listingId?: number;
}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const thread = useQuery({
    queryKey: ['conversation', slug],
    queryFn: async () => (await messagesApi.getStorefrontConversation(slug)).data,
    // Only for a signed-in visitor: a signed-out request is a 401 in the console
    // for a panel that would not render anyway.
    enabled: open && isAuthenticated,
    staleTime: 30 * 1000,
  });

  const conversationId = thread.data?.id;

  const messages = useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => (await messagesApi.messages(conversationId as number, { pageSize: 50 })).data,
    enabled: Boolean(conversationId),
    // A chat is the one screen where polling is honest: the other end types
    // whenever they type.
    refetchInterval: open ? 20 * 1000 : false,
  });

  const send = useMutation({
    mutationFn: async (body: string) => {
      // The get-or-create endpoint is what makes a first message possible: a
      // storefront has no thread until somebody writes in it.
      const id = conversationId ?? (await messagesApi.openStorefrontConversation(slug)).data.id;
      return messagesApi.send(id, { body, ...(listingId ? { listing: listingId } : {}) });
    },
    onSuccess: () => {
      setDraft('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['conversation', slug] });
      void queryClient.invalidateQueries({ queryKey: ['conversation-messages'] });
    },
    onError: (caught) => setError(parseApiError(caught).message),
  });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!isAuthenticated) {
    return (
      <Button to="/login" variant="secondary" icon={MessageCircle}>
        گفتگو با غرفه
      </Button>
    );
  }

  const rows = messages.data?.results ?? [];

  return (
    <>
      <Button variant="secondary" icon={MessageCircle} onClick={() => setOpen(true)}>
        گفتگو با غرفه
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`گفتگو با ${name}`}
            className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-lg bg-paper shadow-[var(--shadow-panel)] sm:rounded-lg dark:bg-night"
          >
            <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 dark:border-night-line">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-extrabold text-ink dark:text-white">{name}</h2>
                <p className="text-2xs text-ink-mute dark:text-white/45">
                  پیام شما مستقیم به غرفه می‌رسد؛ پاسخ در همین پنجره می‌آید.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="بستن گفتگو"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-brand-50 dark:text-white/70 dark:hover:bg-night-soft"
              >
                <X size={19} aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
              {thread.isLoading || messages.isLoading ? (
                <p className="text-2xs text-ink-mute dark:text-white/45">در حال باز کردن گفتگو…</p>
              ) : thread.isError ? (
                <p role="alert" className="text-2xs font-bold text-danger-700">
                  گفتگو باز نشد. چند لحظه بعد دوباره تلاش کنید.
                </p>
              ) : rows.length === 0 ? (
                <p className="text-2xs leading-6 text-ink-mute dark:text-white/50">
                  هنوز پیامی رد و بدل نشده است. سؤال‌تان را بنویسید — موجودی، زمان ارسال، یا جزئیات آگهی.
                </p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((message) => (
                    <li
                      key={message.id}
                      className={cn(
                        'max-w-[85%] rounded-md px-3 py-2 text-2xs leading-6',
                        message.is_mine
                          ? 'ms-auto bg-brand-700 text-white'
                          : 'bg-brand-50 text-ink dark:bg-night-soft dark:text-white/85',
                        message.is_system && 'mx-auto bg-transparent text-center text-ink-mute dark:text-white/45',
                      )}
                    >
                      {!message.is_mine && !message.is_system && (
                        <span className="mb-0.5 block text-[11px] font-bold opacity-70">{message.sender_name}</span>
                      )}
                      {message.body}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const body = draft.trim();
                if (!body || send.isPending) return;
                send.mutate(body);
              }}
              className="border-t border-line p-3 dark:border-night-line"
            >
              <label htmlFor="storefront-chat-draft" className="sr-only">
                متن پیام
              </label>
              <div className="flex items-end gap-2">
                <textarea
                  id="storefront-chat-draft"
                  ref={inputRef}
                  rows={2}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="پیام‌تان را بنویسید…"
                  className="min-h-11 flex-1 resize-none rounded-md border border-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-ink-mute focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/15 dark:border-night-line dark:bg-night dark:text-white"
                />
                <Button type="submit" disabled={!draft.trim()} loading={send.isPending} icon={Send}>
                  ارسال
                </Button>
              </div>
              {error && (
                <p role="alert" className="mt-2 text-2xs font-bold text-danger-700">
                  {error}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
