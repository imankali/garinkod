// frontend/src/components/direct/DirectThread.tsx
//
// One conversation thread with a composer. Reading the thread marks the other
// party's messages as seen; the list refreshes on a short interval so replies
// arrive without a manual reload.

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, PackageSearch, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { messagesApi } from '../../api/services';
import { useDirectStore } from '../../store/directStore';
import { useTranslation } from '../../i18n';
import type { AttachedListing, StorefrontMessage } from '../../types';
import { formatPrice } from '../../utils/formatPrice';

const POLL_MS = 4000;

export default function DirectThread({
  conversationId,
  onBack,
}: {
  conversationId: number;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const attachedListing = useDirectStore((state) => state.attachedListing);
  const attachListing = useDirectStore((state) => state.attachListing);
  const setConversationId = useDirectStore((state) => state.setConversationId);

  const [messages, setMessages] = useState<StorefrontMessage[]>([]);
  const [storefrontName, setStorefrontName] = useState('');
  const [storefrontSlug, setStorefrontSlug] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (quiet = false) => {
    if (!conversationId) return;
    if (!quiet) setLoading(true);
    try {
      const response = await messagesApi.messages(conversationId);
      setMessages(response.data.results || []);
      const conversation = response.data.conversation;
      if (conversation) {
        setStorefrontName(conversation.storefront.name);
        setStorefrontSlug(conversation.storefront.slug);
        if (!conversationId) setConversationId(conversation.id);
      }
    } catch {
      // A revoked or missing thread simply shows the empty state.
    } finally {
      setLoading(false);
    }
  }, [conversationId, setConversationId]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    // Keep the newest message in view as the thread grows.
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = body.trim();
    if (sending || (!text && !attachedListing)) return;
    setSending(true);
    try {
      await messagesApi.send(conversationId, {
        body: text,
        listing: attachedListing ? attachedListing.id : undefined,
      });
      setBody('');
      attachListing(null);
      await load(true);
    } catch {
      toast.error(t('access.loginRequired'));
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Thread header */}
      <header className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3 dark:border-emerald-800">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-900 lg:hidden"
            aria-label={t('common.back')}
          >
            <ArrowRight size={17} />
          </button>
        )}
        {storefrontSlug ? (
          <Link to={`/storefronts/${storefrontSlug}`} className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold text-slate-800 hover:text-emerald-700 dark:text-white dark:hover:text-lime-300">
              {storefrontName}
            </span>
            <span className="block text-fluid-2xs text-emerald-600 dark:text-lime-300">
              {t('storefront.message')}
            </span>
          </Link>
        ) : (
          <span className="flex-1 truncate text-sm font-extrabold text-slate-800 dark:text-white">
            {t('direct.title')}
          </span>
        )}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="py-8 text-center text-xs text-slate-400">{t('common.loading')}</p>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <PackageSearch size={32} className="text-emerald-300" />
            <p className="max-w-60 text-xs leading-6 text-slate-500 dark:text-emerald-200">
              {t('direct.startHint')}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <motion.article
              key={message.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.is_mine ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] ${message.is_mine ? 'order-1' : ''}`}>
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
                    message.is_mine
                      ? 'rounded-bl-md bg-emerald-600 text-white'
                      : 'rounded-br-md bg-white text-slate-700 dark:bg-emerald-900 dark:text-emerald-50'
                  }`}
                >
                  {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
                  {message.listing && <AttachedProductCard listing={message.listing} />}
                </div>
                <p className="mt-1 px-1 text-fluid-2xs text-slate-400">
                  {message.is_mine ? t('direct.you') : message.sender_name}
                </p>
              </div>
            </motion.article>
          ))
        )}
      </div>

      {/* Composer */}
      <form onSubmit={send} className="border-t border-emerald-100 p-3 dark:border-emerald-800">
        {attachedListing && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-700 dark:bg-emerald-900/40">
            <AttachedProductCard listing={attachedListing} compact />
            <button
              type="button"
              onClick={() => attachListing(null)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-500 dark:hover:bg-emerald-950"
              aria-label={t('common.cancel')}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={composerRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={t('direct.placeholder')}
            className="min-h-11 max-h-32 flex-1 resize-none rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
            aria-label={t('direct.placeholder')}
          />
          <button
            type="submit"
            disabled={sending || (!body.trim() && !attachedListing)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient-accent text-white shadow-md disabled:opacity-50"
            aria-label={t('common.send')}
          >
            <Send size={17} className="-translate-x-px translate-y-px -scale-x-100" />
          </button>
        </div>
      </form>
    </div>
  );
}

function AttachedProductCard({ listing, compact = false }: { listing: AttachedListing; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/storefronts/${listing.storefront_slug}`}
      className={`flex items-center gap-2 overflow-hidden rounded-xl ${compact ? '' : 'mt-2 bg-white/15 p-1.5 backdrop-blur-sm'}`}
    >
      <img
        src={listing.image_url}
        alt={listing.title}
        className={`shrink-0 rounded-lg object-cover ${compact ? 'h-11 w-11' : 'h-12 w-12'}`}
        loading="lazy"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-fluid-xs font-bold">{listing.title}</span>
        <span className={`block text-fluid-2xs ${compact ? 'text-slate-500 dark:text-emerald-300' : 'text-white/80'}`}>
          {formatPrice(listing.discounted_price)} / {listing.unit}
        </span>
      </span>
      <span className={`shrink-0 text-fluid-2xs font-bold ${compact ? 'text-emerald-600 dark:text-lime-300' : 'text-lime-200'}`}>
        {t('direct.attachedProduct')}
      </span>
    </Link>
  );
}
