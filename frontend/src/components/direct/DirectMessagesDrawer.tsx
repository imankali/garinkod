// frontend/src/components/direct/DirectMessagesDrawer.tsx
//
// The global direct-message drawer. It has two views:
//   • list   — every conversation the viewer participates in (buyer or owner)
//   • thread — one conversation, with live polling
//
// Opening with a `storefrontSlug` creates/loads that storefront's thread, which
// is how "گفتگو با غرفه‌دار" and "ارسال به دایرکت" reach the same chat.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { messagesApi } from '../../api/services';
import { useDirectStore } from '../../store/directStore';
import { useTranslation } from '../../i18n';
import type { MessageChannel, StorefrontConversation } from '../../types';
import ChannelChips, { type ChannelFilter } from './ChannelChips';
import ConversationRow from './ConversationRow';
import DirectThread from './DirectThread';

const LIST_POLL_MS = 6000;

export default function DirectMessagesDrawer() {
  const { t, dir } = useTranslation();
  const {
    open,
    view,
    conversationId,
    storefrontSlug,
    serviceChannel,
    setConversationId,
    openList,
    setUnreadTotal,
    closeDirect,
  } = useDirectStore();

  const [conversations, setConversations] = useState<StorefrontConversation[]>([]);
  const [channels, setChannels] = useState<{ value: MessageChannel; label: string }[]>([]);
  const [unreadByChannel, setUnreadByChannel] = useState<Partial<Record<MessageChannel, number>>>({});
  const [filter, setFilter] = useState<ChannelFilter>('all');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const response = await messagesApi.conversations();
      setConversations(response.data.results || []);
      setChannels(response.data.channels || []);
      setUnreadByChannel(response.data.unread_by_channel || {});
      setUnreadTotal(response.data.unread_total || 0);
    } catch {
      // Signed-out viewers simply get an empty list.
    }
  }, [setUnreadTotal]);

  const visibleConversations = useMemo(
    () =>
      filter === 'all'
        ? conversations
        : conversations.filter((conversation) => conversation.channel === filter),
    [conversations, filter],
  );

  // Opening with a storefront slug resolves (or creates) that thread.
  useEffect(() => {
    if (!open) return;
    void loadList();
    const interval = setInterval(() => void loadList(), LIST_POLL_MS);
    return () => clearInterval(interval);
  }, [open, loadList]);

  useEffect(() => {
    if (!open || !storefrontSlug || conversationId) return;
    let cancelled = false;
    setBusy(true);
    messagesApi
      .openStorefrontConversation(storefrontSlug)
      .then((response) => {
        if (!cancelled && response.data?.id) {
          setConversationId(response.data.id);
          void loadList();
        }
      })
      .catch(() => {
        if (!cancelled) toast.error(t('access.loginRequired'));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, storefrontSlug, conversationId]);

  // The floating messenger opens a service desk (پشتیبانی / مشاوره) the same
  // way a storefront slug opens a shop thread: resolve it to a real
  // conversation id, then hand off to the normal thread view.
  useEffect(() => {
    if (!open || !serviceChannel || conversationId) return;
    let cancelled = false;
    setBusy(true);
    messagesApi
      .openServiceConversation(serviceChannel)
      .then((response) => {
        if (!cancelled && response.data?.id) {
          setConversationId(response.data.id);
          void loadList();
        }
      })
      .catch(() => {
        if (!cancelled) toast.error(t('access.loginRequired'));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, serviceChannel, conversationId]);

  useEffect(() => {
    if (!open) setLoading(false);
  }, [open]);

  // Reset the channel filter each time the drawer is dismissed, so the next
  // open always starts on the full inbox.
  useEffect(() => {
    if (!open) setFilter('all');
  }, [open]);

  // Slide in from the start edge: +100% in RTL (off the right), -100% in LTR.
  const slideOffset = dir === 'rtl' ? '100%' : '-100%';

  const showThread =
    view === 'thread' ||
    Boolean(conversationId) ||
    Boolean(storefrontSlug) ||
    Boolean(serviceChannel);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label={t('common.close')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDirect}
            className="fixed inset-0 z-[55] bg-emerald-950/40 backdrop-blur-sm"
          />
          <motion.aside
            // The drawer lives on the *start* edge — the right in RTL — which
            // is where the menu and the thumb both are on a Persian layout.
            initial={{ x: slideOffset }}
            animate={{ x: 0 }}
            exit={{ x: slideOffset }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            // 100dvh (not the drawer's implicit 100vh) keeps the composer
            // above the mobile browser's collapsing address bar.
            style={{ height: '100dvh' }}
            className="fixed inset-y-0 start-0 z-[60] flex w-[min(26rem,100vw)] flex-col border-e border-emerald-100 bg-white shadow-2xl dark:border-emerald-800 dark:bg-emerald-950"
            role="dialog"
            aria-modal="true"
            aria-label={t('direct.title')}
          >
            {showThread && conversationId ? (
              <DirectThread
                conversationId={conversationId}
                onBack={openList}
              />
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <header className="flex items-center justify-between gap-2 border-b border-emerald-100 px-4 py-3 dark:border-emerald-800">
                  <div className="flex items-center gap-2">
                    <MessageCircle size={18} className="text-emerald-600 dark:text-lime-300" />
                    <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">
                      {t('direct.title')}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closeDirect}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900"
                    aria-label={t('common.close')}
                  >
                    <X size={17} />
                  </button>
                </header>

                {/* One chip per notification source, so "where did this come
                    from?" is answerable before opening anything. Compact and
                    swipeable so it never spills out of the drawer. */}
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
                  {loading || busy ? (
                    <p className="py-10 text-center text-xs text-slate-400">{t('common.loading')}</p>
                  ) : visibleConversations.length === 0 ? (
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
                            fallbackPreview={t('direct.startHint')}
                            onSelect={() => setConversationId(conversation.id)}
                            showChevron
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
