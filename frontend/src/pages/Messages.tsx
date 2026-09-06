// frontend/src/pages/Messages.tsx
//
// The full-page direct-message centre. Buyers and storefront owners both land
// here from the header's "پیام‌ها" shortcut; on mobile the list and the thread
// are two stacked views, on desktop a two-pane layout.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

import { messagesApi } from '../api/services';
import ChannelChips, { type ChannelFilter } from '../components/direct/ChannelChips';
import ConversationRow from '../components/direct/ConversationRow';
import DeskEntries from '../components/direct/DeskEntries';
import DirectThread from '../components/direct/DirectThread';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n';
import type { MessageChannel, StorefrontConversation } from '../types';

export default function Messages() {
  const { t } = useTranslation();
  const { isAuthenticated, isSessionChecked } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
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

  /*
    A link that says «ادامه گفتگو در مشاوره کشاورزی» — written by the support desk
    when a question turns out to need an agronomist — has to land the farmer in
    that thread, not at the top of the inbox with a hint to look for it. Same for
    the menu's «مشاوره کشاورزی» entry. The parameter is removed afterwards so a
    refresh does not yank them back out of whatever they opened next.
  */
  const requestedChannel = searchParams.get('channel');
  useEffect(() => {
    if (!isAuthenticated || !isSessionChecked) return;
    if (requestedChannel !== 'consulting' && requestedChannel !== 'support') return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await messagesApi.openServiceConversation(requestedChannel);
        if (cancelled) return;
        setActiveId(response.data.id);
        setFilter('all');
      } catch {
        // The inbox is still there; the deep link simply did nothing extra.
      } finally {
        if (!cancelled) setSearchParams({}, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isSessionChecked, requestedChannel, setSearchParams]);

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

        No minimum on a phone, deliberately: a floor in rem is the one thing that
        can make this panel taller than the space it was measured out, and what
        slid off the bottom of it was the composer — the canned replies first,
        since they are the last rows before the edge.
      */}
      <div
        className="chat-shell mt-4 grid overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm dark:border-emerald-800 dark:bg-emerald-950 lg:mt-5 lg:min-h-[24rem] lg:grid-cols-[320px_minmax(0,1fr)]"
      >
        {/* Conversation list */}
        <aside className={`${activeId ? 'hidden' : ''} flex h-full min-h-0 flex-col overflow-hidden lg:flex`}>
          {/* Channel filters, each badged with its own unread count. */}
          {channels.length > 0 && (
            <ChannelChips
              channels={channels}
              unreadByChannel={unreadByChannel}
              value={filter}
              onChange={setFilter}
              allLabel={t('common.all')}
              className="border-b border-emerald-100 dark:border-emerald-800"
            />
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            {/*
              The two desks first: entering the messenger should look like the
              messenger the request describes — a chat with a consultant and a
              chat with support — and only then the shop conversations.
            */}
            <DeskEntries
              conversations={conversations}
              onOpen={setActiveId}
              className="mb-3"
            />

            {visibleConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
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
