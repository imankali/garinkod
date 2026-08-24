// frontend/src/components/direct/DirectMessagesDrawer.tsx
//
// The global direct-message drawer. It has two views:
//   • list   — every conversation the viewer participates in (buyer or owner)
//   • thread — one conversation, with live polling
//
// Opening with a `storefrontSlug` creates/loads that storefront's thread, which
// is how "گفتگو با غرفه‌دار" and "ارسال به دایرکت" reach the same chat.

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, MessageCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { messagesApi } from '../../api/services';
import { useDirectStore } from '../../store/directStore';
import { useTranslation } from '../../i18n';
import type { StorefrontConversation } from '../../types';
import DirectThread from './DirectThread';

const LIST_POLL_MS = 6000;

export default function DirectMessagesDrawer() {
  const { t } = useTranslation();
  const {
    open,
    view,
    conversationId,
    storefrontSlug,
    setConversationId,
    openList,
    setUnreadTotal,
    closeDirect,
  } = useDirectStore();

  const [conversations, setConversations] = useState<StorefrontConversation[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const response = await messagesApi.conversations();
      setConversations(response.data.results || []);
      setUnreadTotal(response.data.unread_total || 0);
    } catch {
      // Signed-out viewers simply get an empty list.
    }
  }, [setUnreadTotal]);

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

  useEffect(() => {
    if (!open) setLoading(false);
  }, [open]);

  const showThread = view === 'thread' || Boolean(conversationId) || Boolean(storefrontSlug);

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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 end-0 z-[60] flex w-[min(26rem,100vw)] flex-col border-s border-emerald-100 bg-emerald-50/95 backdrop-blur-xl dark:border-emerald-800 dark:bg-emerald-950"
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
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900"
                    aria-label={t('common.close')}
                  >
                    <X size={17} />
                  </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {loading || busy ? (
                    <p className="py-10 text-center text-xs text-slate-400">{t('common.loading')}</p>
                  ) : conversations.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                      <MessageCircle size={32} className="text-emerald-300" />
                      <p className="max-w-60 text-xs leading-6 text-slate-500 dark:text-emerald-200">
                        {t('direct.empty')}
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {conversations.map((conversation) => (
                        <li key={conversation.id}>
                          <button
                            type="button"
                            onClick={() => setConversationId(conversation.id)}
                            className="flex w-full items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-3 text-start shadow-sm transition hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-950 dark:hover:border-emerald-600"
                          >
                            <img
                              src={conversation.storefront.avatar_url || '/images/hero-farm.jpg'}
                              alt={conversation.storefront.name}
                              className="h-12 w-12 shrink-0 rounded-xl object-cover"
                              loading="lazy"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-bold text-slate-800 dark:text-white">
                                  {conversation.storefront.name}
                                </span>
                                {conversation.unread_count > 0 && (
                                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-fluid-2xs font-bold text-white">
                                    {conversation.unread_count.toLocaleString('fa-IR')}
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-emerald-200">
                                {conversation.last_message?.body ||
                                  conversation.last_message?.listing?.title ||
                                  t('direct.startHint')}
                              </span>
                            </span>
                            <ArrowRight size={15} className="shrink-0 -scale-x-100 text-slate-300" />
                          </button>
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
