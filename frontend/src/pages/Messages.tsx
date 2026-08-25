// frontend/src/pages/Messages.tsx
//
// The full-page direct-message centre. Buyers and storefront owners both land
// here from the header's "پیام‌ها" shortcut; on mobile the list and the thread
// are two stacked views, on desktop a two-pane layout.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

import { messagesApi } from '../api/services';
import ConversationRow from '../components/direct/ConversationRow';
import DirectThread from '../components/direct/DirectThread';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n';
import type { MessageChannel, StorefrontConversation } from '../types';
import { cn } from '../utils/cn';

type ChannelFilter = 'all' | MessageChannel;

export default function Messages() {
  const { t } = useTranslation();
  const { isAuthenticated, isSessionChecked } = useAuthStore();
  const [conversations, setConversations] = useState<StorefrontConversation[]>([]);
  const [channels, setChannels] = useState<{ value: MessageChannel; label: string }[]>([]);
  const [unreadByChannel, setUnreadByChannel] = useState<Partial<Record<MessageChannel, number>>>({});
  const [filter, setFilter] = useState<ChannelFilter>('all');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // Always fetch the whole inbox and filter on the client: the filter
      // chips need every channel's unread count anyway, so one request beats
      // one-per-chip.
      const response = await messagesApi.conversations();
      setConversations(response.data.results || []);
      setChannels(response.data.channels || []);
      setUnreadByChannel(response.data.unread_by_channel || {});
      // Auto-selecting the first thread only makes sense on the desktop
      // two-pane layout; on a phone it would skip past the list entirely.
      if (window.matchMedia('(min-width: 1024px)').matches) {
        setActiveId((current) => current ?? response.data.results?.[0]?.id ?? null);
      }
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSessionChecked) return;
    if (isAuthenticated) {
      void load();
      const interval = setInterval(() => void load(), 6000);
      return () => clearInterval(interval);
    }
    setLoading(false);
    return undefined;
  }, [isAuthenticated, isSessionChecked, load]);

  const visibleConversations = useMemo(
    () =>
      filter === 'all'
        ? conversations
        : conversations.filter((conversation) => conversation.channel === filter),
    [conversations, filter],
  );

  if (!isSessionChecked || loading) {
    return (
      <main className="flex min-h-[55vh] items-center justify-center">
        <p className="text-sm text-slate-500 dark:text-emerald-200">{t('common.loading')}</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <MessageCircle size={40} className="text-emerald-500" />
        <h1 className="mt-4 text-xl font-extrabold text-slate-800 dark:text-white">{t('direct.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-emerald-200">
          {t('access.loginRequired')}
        </p>
        <Link to="/login" className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white">
          {t('nav.login')}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-[var(--page-gutter)] py-5 md:py-8">
      {/*
        The heading is hidden on a phone once a thread is open: the chat needs
        every available pixel, and the thread already names the storefront.
      */}
      <div className={activeId ? 'hidden lg:block' : ''}>
        <h1 className="text-fluid-xl font-extrabold text-slate-800 dark:text-white">
          {t('direct.title')}
        </h1>
        <p className="mt-1 text-fluid-sm text-slate-500 dark:text-emerald-200">
          {t('direct.startHint')}
        </p>
      </div>

      {/*
        Height: on a phone the panel fills the space between the sticky header
        and the fixed bottom bar, so the composer sits just above the bar
        instead of being pushed off-screen by a fixed 70vh. Desktop keeps a
        comfortable fixed height.
      */}
      <div
        className="chat-shell mt-4 grid min-h-[24rem] overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm dark:border-emerald-800 dark:bg-emerald-950 lg:mt-5 lg:grid-cols-[320px_minmax(0,1fr)]"
      >
        {/* Conversation list */}
        <aside className={`${activeId ? 'hidden' : ''} flex h-full min-h-0 flex-col overflow-hidden lg:flex`}>
          {/* Channel filters, each badged with its own unread count. */}
          {channels.length > 0 && (
            <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto border-b border-emerald-100 p-2.5 dark:border-emerald-800">
              <FilterChip
                label={t('common.all')}
                active={filter === 'all'}
                count={Object.values(unreadByChannel).reduce((sum, n) => sum + (n || 0), 0)}
                onClick={() => setFilter('all')}
              />
              {channels.map((channel) => (
                <FilterChip
                  key={channel.value}
                  label={channel.label}
                  active={filter === channel.value}
                  count={unreadByChannel[channel.value] || 0}
                  onClick={() => setFilter(channel.value)}
                />
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            {visibleConversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <MessageCircle size={32} className="text-emerald-300" />
                <p className="max-w-60 text-xs leading-6 text-slate-500 dark:text-emerald-200">
                  {t('direct.empty')}
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {visibleConversations.map((conversation) => (
                  <li key={conversation.id}>
                    <ConversationRow
                      conversation={conversation}
                      active={activeId === conversation.id}
                      fallbackPreview={t('direct.startHint')}
                      onSelect={() => setActiveId(conversation.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={`${activeId ? 'flex' : 'hidden lg:flex'} h-full min-h-0 min-w-0 flex-col border-emerald-100 dark:border-emerald-800 lg:border-s`}>
          {activeId ? (
            <DirectThread conversationId={activeId} onBack={() => setActiveId(null)} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <MessageCircle size={32} className="text-emerald-300" />
              <p className="max-w-60 text-xs leading-6 text-slate-500 dark:text-emerald-200">
                {t('direct.noThread')}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/** One channel filter, with its unread badge. */
function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-fluid-2xs font-bold transition',
        active
          ? 'border-emerald-600 bg-emerald-600 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
      )}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-fluid-2xs',
            active ? 'bg-white/25 text-white' : 'bg-emerald-600 text-white',
          )}
        >
          {count.toLocaleString('fa-IR')}
        </span>
      )}
    </button>
  );
}
