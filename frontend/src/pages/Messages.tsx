// frontend/src/pages/Messages.tsx
//
// The full-page direct-message centre. Buyers and storefront owners both land
// here from the header's "پیام‌ها" shortcut; on mobile the list and the thread
// are two stacked views, on desktop a two-pane layout.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

import { messagesApi } from '../api/services';
import DirectThread from '../components/direct/DirectThread';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n';
import type { StorefrontConversation } from '../types';

export default function Messages() {
  const { t } = useTranslation();
  const { isAuthenticated, isSessionChecked } = useAuthStore();
  const [conversations, setConversations] = useState<StorefrontConversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await messagesApi.conversations();
      setConversations(response.data.results || []);
      setActiveId((current) => current ?? response.data.results?.[0]?.id ?? null);
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
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            {conversations.length === 0 ? (
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
                      onClick={() => setActiveId(conversation.id)}
                      className={`flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl border p-3 text-start transition ${
                        activeId === conversation.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/50'
                          : 'border-transparent hover:bg-emerald-50/60 dark:hover:bg-emerald-900/30'
                      }`}
                    >
                      <img
                        src={conversation.storefront.avatar_url || '/images/hero-farm.jpg'}
                        alt={conversation.storefront.name}
                        className="h-11 w-11 shrink-0 rounded-xl object-cover"
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
                    </button>
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
