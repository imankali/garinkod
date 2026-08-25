// frontend/src/components/direct/DirectThread.tsx
//
// One conversation thread with a composer. Reading the thread marks the other
// party's messages as seen; the list refreshes on a short interval so replies
// arrive without a manual reload.

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ImagePlus, PackageSearch, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { messagesApi } from '../../api/services';
import { useDirectStore } from '../../store/directStore';
import { useTranslation } from '../../i18n';
import type { AttachedListing, StorefrontConversation, StorefrontMessage } from '../../types';
import { formatPrice } from '../../utils/formatPrice';
import { cn } from '../../utils/cn';
import { CHANNEL_TONE, conversationIdentity } from '../../utils/conversation';
import MessageAttachment from './MessageAttachment';
import VoiceRecorder from './VoiceRecorder';

/** Images and clips the composer will accept before upload. */
const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';

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
  const [conversation, setConversation] = useState<StorefrontConversation | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  // A chosen photo/clip waits here with its preview until the user hits send.
  const [pendingMedia, setPendingMedia] = useState<{ file: File; preview: string } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (quiet = false) => {
    if (!conversationId) return;
    if (!quiet) setLoading(true);
    try {
      const response = await messagesApi.messages(conversationId);
      setMessages(response.data.results || []);
      const thread = response.data.conversation;
      if (thread) {
        setConversation(thread);
        if (!conversationId) setConversationId(thread.id);
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

  /** Send text / listing / a chosen photo or clip. */
  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = body.trim();
    if (sending || (!text && !attachedListing && !pendingMedia)) return;
    setSending(true);
    try {
      await messagesApi.send(conversationId, {
        body: text,
        listing: attachedListing ? attachedListing.id : undefined,
        attachment: pendingMedia?.file ?? null,
        attachmentName: pendingMedia?.file.name,
      });
      setBody('');
      attachListing(null);
      clearPendingMedia();
      await load(true);
    } catch {
      // The API client surfaces the reason (size, type, permission).
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }

  /** A finished voice note is sent immediately — holding it adds no value. */
  async function sendVoice(blob: Blob, duration: number, filename: string) {
    if (sending) return;
    setSending(true);
    try {
      await messagesApi.send(conversationId, {
        attachment: blob,
        attachmentName: filename,
        attachmentDuration: duration,
      });
      await load(true);
    } catch {
      // Reported by the API client.
    } finally {
      setSending(false);
    }
  }

  function clearPendingMedia() {
    setPendingMedia((current) => {
      // Revoking the object URL prevents the blob leaking for the page's life.
      if (current) URL.revokeObjectURL(current.preview);
      return null;
    });
  }

  function choosePendingMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('حجم فایل باید کمتر از ۲۵ مگابایت باشد.');
      return;
    }
    clearPendingMedia();
    setPendingMedia({ file, preview: URL.createObjectURL(file) });
  }

  const identity = conversation ? conversationIdentity(conversation) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Thread header */}
      <header className="flex shrink-0 items-center gap-2 border-b border-emerald-100 bg-white px-3 py-2.5 dark:border-emerald-800 dark:bg-emerald-950 sm:px-4 sm:py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ms-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-900 lg:hidden"
            aria-label={t('common.back')}
          >
            <ArrowRight size={17} />
          </button>
        )}
        {identity ? (
          <>
            {/* Counterpart avatar, or a channel-tinted initial when the
                source has no picture (support, consulting, replies). */}
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-fluid-xs font-extrabold',
                CHANNEL_TONE[identity.channel],
              )}
            >
              {identity.avatarUrl ? (
                <img src={identity.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                identity.title.slice(0, 2)
              )}
            </span>

            <HeaderTitle identity={identity} />
          </>
        ) : (
          <span className="flex-1 truncate text-sm font-extrabold text-slate-800 dark:text-white">
            {t('direct.title')}
          </span>
        )}
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain bg-emerald-50/40 px-3 py-4 dark:bg-emerald-950/60 sm:px-4"
      >
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
              {/*
                Bubbles cap at 88% of a phone's width and the corner "tail"
                uses logical properties, so in RTL it points at the correct
                speaker instead of at the opposite side of the screen.
              */}
              <div className="max-w-[88%] sm:max-w-[75%]">
                <div
                  className={`w-fit rounded-2xl px-3.5 py-2.5 text-fluid-sm leading-6 shadow-sm ${
                    message.is_mine
                      ? 'rounded-ee-md bg-emerald-600 text-white'
                      : 'rounded-es-md bg-white text-slate-700 dark:bg-emerald-900 dark:text-emerald-50'
                  } ${message.is_mine ? 'ms-auto' : ''}`}
                >
                  {message.body && (
                    <p className="whitespace-pre-wrap break-words hyphens-auto">{message.body}</p>
                  )}
                  <MessageAttachment message={message} onOpenImage={setLightbox} />
                  {message.listing && <AttachedProductCard listing={message.listing} />}
                </div>
                <p
                  className={`mt-1 flex gap-1.5 px-1 text-fluid-2xs text-slate-400 dark:text-emerald-300/70 ${
                    message.is_mine ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <span>{message.is_mine ? t('direct.you') : message.sender_name}</span>
                  {message.created_at && (
                    <time dateTime={message.created_at}>
                      {new Date(message.created_at).toLocaleTimeString('fa-IR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  )}
                </p>
              </div>
            </motion.article>
          ))
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="shrink-0 border-t border-emerald-100 bg-white p-2.5 dark:border-emerald-800 dark:bg-emerald-950 sm:p-3"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
      >
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
        {/* Pending photo/clip preview — sending is still an explicit action. */}
        {pendingMedia && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-700 dark:bg-emerald-900/40">
            {pendingMedia.file.type.startsWith('video/') ? (
              <video src={pendingMedia.preview} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            ) : (
              <img src={pendingMedia.preview} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            )}
            <span className="min-w-0 flex-1 truncate text-fluid-xs font-bold text-slate-600 dark:text-emerald-100">
              {pendingMedia.file.name}
            </span>
            <button
              type="button"
              onClick={clearPendingMedia}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-500 dark:hover:bg-emerald-950"
              aria-label={t('common.cancel')}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <input
          ref={mediaInputRef}
          type="file"
          accept={MEDIA_ACCEPT}
          onChange={choosePendingMedia}
          className="hidden"
          aria-label="انتخاب تصویر یا ویدیو"
        />

        <div className="flex items-end gap-1.5">
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            disabled={sending}
            aria-label="ارسال تصویر یا ویدیو"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-900"
          >
            <ImagePlus size={19} />
          </button>

          <VoiceRecorder onRecorded={(blob, seconds, name) => void sendVoice(blob, seconds, name)} disabled={sending} />

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
            // 16px keeps iOS Safari from zooming the whole page on focus.
            className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-base leading-6 outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white sm:text-fluid-sm"
            aria-label={t('direct.placeholder')}
          />
          <button
            type="submit"
            disabled={sending || (!body.trim() && !attachedListing && !pendingMedia)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient-accent text-white shadow-md disabled:opacity-50"
            aria-label={t('common.send')}
          >
            <Send size={17} className="-translate-x-px translate-y-px -scale-x-100" />
          </button>
        </div>
      </form>

      {/* Full-size image viewer */}
      {lightbox && (
        <button
          type="button"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          aria-label={t('common.close')}
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
        </button>
      )}
    </div>
  );
}

/**
 * The thread title, plus the badge naming where this conversation comes from.
 *
 * The badge is the answer to "who is writing to me?" — without it a support
 * reply and a shop reply look identical in the inbox.
 */
function HeaderTitle({ identity }: { identity: ReturnType<typeof conversationIdentity> }) {
  const inner = (
    <>
      <span className="block truncate text-fluid-sm font-extrabold text-slate-800 dark:text-white">
        {identity.title}
      </span>
      <span
        className={cn(
          'mt-0.5 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-fluid-2xs font-bold',
          CHANNEL_TONE[identity.channel],
        )}
      >
        {identity.channelLabel}
      </span>
    </>
  );

  if (identity.href) {
    return (
      <Link to={identity.href} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
        {inner}
      </Link>
    );
  }
  return <span className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">{inner}</span>;
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
