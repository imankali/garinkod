// frontend/src/components/direct/DirectThread.tsx
//
// One conversation thread with a composer. Reading the thread marks the other
// party's messages as seen; the list refreshes on a short interval so replies
// arrive without a manual reload.
//
// Each bubble has a small action menu (reply / edit / copy / delete) — the
// same affordances people know from Telegram and WhatsApp. Reply quotes the
// original above the new bubble, edit swaps the composer into edit mode, and
// delete leaves a "پیام حذف شد" placeholder so quotes still make sense.

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Ban,
  Check,
  Copy,
  CornerUpLeft,
  ImagePlus,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Reply,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { deskApi, messagesApi } from '../../api/services';
import { useDirectStore } from '../../store/directStore';
import { useTranslation } from '../../i18n';
import type {
  AttachedListing,
  DeskState,
  FarmLand,
  QuotedMessage,
  StorefrontConversation,
  StorefrontMessage,
} from '../../types';
import { formatPrice } from '../../utils/formatPrice';
import { cn } from '../../utils/cn';
import { copyText } from '../../utils/copyText';
import { listingHref } from '../../utils/listingHref';
import { CHANNEL_TONE, conversationIdentity } from '../../utils/conversation';
import MessageAttachment from './MessageAttachment';
import VoiceRecorder from './VoiceRecorder';
import DeskComposer from './DeskComposer';
import LandDossierCard from './LandDossierCard';
import MessageLink from './MessageLink';
import MessageStatusTicks from './MessageStatusTicks';
import SurveyCard from './SurveyCard';
import { AttachLandButton, AttachedLandChip } from './ShareLandButton';
import { DeskIdentity } from './DeskPresence';
import { CloseThreadButton, HandoffButton } from './ThreadClosure';

/** Images and clips the composer will accept before upload. */
const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';

const POLL_MS = 4000;

/** One line describing a message when it is quoted or previewed. */
function quoteSummary(quote: QuotedMessage, t: (key: string) => string): string {
  if (quote.is_deleted) return t('direct.deleted');
  if (quote.body) return quote.body;
  if (quote.attachment_type === 'image') return '🖼 تصویر';
  if (quote.attachment_type === 'video') return '🎬 ویدیو';
  if (quote.attachment_type === 'audio') return '🎤 پیام صوتی';
  if (quote.listing_title) return `📦 ${quote.listing_title}`;
  return '';
}

/** Merge a fresh copy of a message into the list, by id. */
function mergeMessage(list: StorefrontMessage[], updated: StorefrontMessage): StorefrontMessage[] {
  const patched = list.map((item) => (item.id === updated.id ? updated : item));
  // A reply that quotes the updated message must reflect the new text too.
  return patched.map((item) =>
    item.reply_to && item.reply_to.id === updated.id
      ? {
          ...item,
          reply_to: {
            ...item.reply_to,
            body: updated.is_deleted ? '' : updated.body,
            attachment_type: updated.is_deleted ? '' : updated.attachment_type,
            listing_title: updated.is_deleted ? '' : (updated.listing?.title ?? ''),
            is_deleted: updated.is_deleted,
          },
        }
      : item,
  );
}

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
  const attachedLand = useDirectStore((state) => state.attachedLand);
  const attachLand = useDirectStore((state) => state.attachLand);
  const setConversationId = useDirectStore((state) => state.setConversationId);

  const [messages, setMessages] = useState<StorefrontMessage[]>([]);
  const [conversation, setConversation] = useState<StorefrontConversation | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  // A chosen photo/clip waits here with its preview until the user hits send.
  const [pendingMedia, setPendingMedia] = useState<{ file: File; preview: string } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  // Composer modes: quoting a message, or rewriting one of mine.
  const [replyTo, setReplyTo] = useState<StorefrontMessage | null>(null);
  const [editing, setEditing] = useState<StorefrontMessage | null>(null);
  // Which bubble's action menu is open (one at a time).
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StorefrontMessage | null>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  /**
   * Presence, duty window and canned lines for the desk behind this thread.
   * Fetched with the thread and refreshed by the same poll, because «آنلاین
   * است» that is true when you open a chat and false twenty minutes later is
   * worse than no indicator at all.
   */
  const [desk, setDesk] = useState<DeskState | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const bubbleRefs = useRef<Map<number, HTMLElement>>(new Map());

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
        // Only the two service desks have hours, presence or canned replies; a
        // private shop chat must not go looking for them.
        if (thread.channel === 'support' || thread.channel === 'consulting') {
          try {
            const state = await deskApi.state(thread.channel);
            setDesk(state.data);
          } catch {
            // The desk header is decoration next to the conversation itself: a
            // failed presence poll must not look like a broken chat.
          }
        } else {
          setDesk(null);
        }
      }
    } catch {
      // A revoked or missing thread simply shows the empty state.
    } finally {
      setLoading(false);
    }
  }, [conversationId, setConversationId]);

  useEffect(() => {
    void load();

    let eventSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    if (typeof window !== 'undefined' && 'EventSource' in window && conversationId) {
      try {
        eventSource = new EventSource(`/api/marketplace/conversations/${conversationId}/stream/`, {
          withCredentials: true,
        });

        eventSource.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.results && Array.isArray(data.results) && data.results.length > 0) {
              setMessages((prev) => {
                const existingIds = new Set(prev.map((m) => m.id));
                const incoming = data.results.filter((m: StorefrontMessage) => !existingIds.has(m.id));
                if (incoming.length === 0) return prev;
                return [...prev, ...incoming];
              });
            }
          } catch {
            // Ignore parse failures
          }
        });

        // Edits and deletions from the other side arrive as `update` events.
        eventSource.addEventListener('update', (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data);
            if (data.results && Array.isArray(data.results)) {
              setMessages((prev) =>
                data.results.reduce(
                  (list: StorefrontMessage[], item: StorefrontMessage) => mergeMessage(list, item),
                  prev,
                ),
              );
            }
          } catch {
            // Ignore parse failures
          }
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!pollInterval) {
            pollInterval = setInterval(() => void load(true), POLL_MS);
          }
        };
      } catch {
        pollInterval = setInterval(() => void load(true), POLL_MS);
      }
    } else {
      pollInterval = setInterval(() => void load(true), POLL_MS);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [conversationId, load]);

  /*
    A sent message's green «هنوز باز نشده» mark has to clear the moment the desk
    opens the thread. The live stream announces new messages, not read receipts,
    so while any of my own messages are still unopened the thread is re-read on a
    timer — which switches itself off once every one of them has been seen, and
    never runs at all on a conversation where nothing is waiting.
  */
  useEffect(() => {
    const waiting = messages.some(
      (message) => message.is_mine && !message.is_read && !message.is_system,
    );
    if (!waiting) return undefined;
    const interval = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(interval);
  }, [messages, load]);

  useEffect(() => {
    // Keep the newest message in view as the thread grows.
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  // Switching threads drops any half-finished reply/edit, and a land that was
  // about to be shared in the other conversation.
  useEffect(() => {
    setReplyTo(null);
    setEditing(null);
    setMenuFor(null);
    setBody('');
    attachLand(null);
  }, [conversationId, attachLand]);

  // Close an open bubble menu on outside tap or Escape.
  useEffect(() => {
    if (menuFor === null) return undefined;
    function onPointer(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-message-menu]')) return;
      setMenuFor(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuFor(null);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuFor]);

  /** Send text / listing / a chosen photo or clip — or save an edit. */
  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = body.trim();
    if (sending) return;

    if (editing) {
      if (!text && !editing.listing) return;
      if (text === editing.body) {
        cancelEdit();
        return;
      }
      setSending(true);
      try {
        const response = await messagesApi.edit(conversationId, editing.id, text);
        setMessages((prev) => mergeMessage(prev, response.data));
        cancelEdit();
        toast.success(t('direct.edited'));
      } catch {
        // The API client surfaces the reason.
      } finally {
        setSending(false);
        composerRef.current?.focus();
      }
      return;
    }

    if (!text && !attachedListing && !pendingMedia && !attachedLand) return;
    setSending(true);
    try {
      await messagesApi.send(conversationId, {
        body: text,
        listing: attachedListing ? attachedListing.id : undefined,
        land: attachedLand?.id,
        attachment: pendingMedia?.file ?? null,
        attachmentName: pendingMedia?.file.name,
        replyTo: replyTo?.id ?? null,
      });
      setBody('');
      attachListing(null);
      attachLand(null);
      clearPendingMedia();
      setReplyTo(null);
      await load(true);
    } catch {
      // The API client surfaces the reason (size, type, permission).
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }

  /**
   * A tapped canned line, sent as it stands.
   *
   * Only used for the farmer's side; an operator's chip writes into the composer
   * instead (see ``DeskComposer``), because their reply usually has to name the
   * farmer's crop or number before it is true.
   */
  async function sendCannedReply(text: string) {
    if (sending || !text.trim()) return;
    setSending(true);
    try {
      await messagesApi.send(conversationId, { body: text.trim() });
      await load(true);
    } catch {
      // Reported by the API client.
    } finally {
      setSending(false);
    }
  }

  /** Picking a land from the desk's sheet queues it with the next message. */
  function pickLand(land: FarmLand) {
    attachLand(land);
    composerRef.current?.focus();
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
        replyTo: replyTo?.id ?? null,
      });
      setReplyTo(null);
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

  // --- bubble actions -----------------------------------------------------

  function startReply(message: StorefrontMessage) {
    setMenuFor(null);
    setEditing(null);
    setReplyTo(message);
    composerRef.current?.focus();
  }

  function startEdit(message: StorefrontMessage) {
    setMenuFor(null);
    setReplyTo(null);
    setEditing(message);
    setBody(message.body);
    // Focus after the value lands, and put the caret at the end.
    window.setTimeout(() => {
      const element = composerRef.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(element.value.length, element.value.length);
    }, 0);
  }

  function cancelEdit() {
    setEditing(null);
    setBody('');
  }

  async function copyMessage(message: StorefrontMessage) {
    setMenuFor(null);
    try {
      await copyText(message.body);
      toast.success(t('direct.copied'));
    } catch {
      toast.error('کپی متن ممکن نشد.');
    }
  }

  async function deleteMessage(message: StorefrontMessage) {
    setConfirmDelete(null);
    try {
      const response = await messagesApi.remove(conversationId, message.id);
      setMessages((prev) => mergeMessage(prev, response.data));
      if (editing?.id === message.id) cancelEdit();
      if (replyTo?.id === message.id) setReplyTo(null);
      toast.success(t('direct.deletedToast'));
    } catch {
      // Reported by the API client.
    }
  }

  /** Tapping a quote scrolls to and briefly highlights the original. */
  function jumpTo(id: number) {
    const element = bubbleRefs.current.get(id);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlighted(id);
    window.setTimeout(() => setHighlighted((current) => (current === id ? null : current)), 1400);
  }

  const identity = conversation ? conversationIdentity(conversation) : null;
  const isDeskThread = conversation?.channel === 'support' || conversation?.channel === 'consulting';
  const otherDesk = conversation?.channel === 'support' ? 'consulting' : 'support';
  const otherDeskLabel = otherDesk === 'consulting' ? 'مشاوره کشاورزی' : 'پشتیبانی';
  // Any real message from this side ends the "first message" phase, after which
  // the opening FAQ lines stop being useful.
  const hasWritten = messages.some((message) => message.is_mine && !message.is_system);
  const composerDisabled =
    sending ||
    (editing
      ? !body.trim() && !editing.listing
      : !body.trim() && !attachedListing && !pendingMedia && !attachedLand);

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
        {identity && isDeskThread && conversation ? (
          /*
            A service desk is staffed by people, so the header names the person
            who is actually answering: the published photo, name and title of the
            operator, with a presence dot from their real activity. When a
            colleague takes the thread over, this changes with them — which is
            the point, since the alternative is a name that stops matching the
            answers halfway through a conversation.
          */
          <DeskIdentity
            agent={conversation.last_agent || conversation.agent}
            desk={desk}
            channelLabel={conversation.channel_label}
            handover={Boolean(conversation.last_agent)}
          />
        ) : identity ? (
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

        {isDeskThread && conversation && (
          <span className="flex shrink-0 items-center gap-0.5">
            {desk?.viewer_is_staff && (
              <HandoffButton
                conversation={conversation}
                target={otherDesk as 'consulting' | 'support'}
                targetLabel={otherDeskLabel}
                onDone={() => void load(true)}
              />
            )}
            <CloseThreadButton conversation={conversation} onChanged={() => void load(true)} />
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
          <>
            {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              menuOpen={menuFor === message.id}
              highlighted={highlighted === message.id}
              isEditing={editing?.id === message.id}
              onToggleMenu={() => setMenuFor((current) => (current === message.id ? null : message.id))}
              onReply={() => startReply(message)}
              onEdit={() => startEdit(message)}
              onCopy={() => void copyMessage(message)}
              onDelete={() => {
                setMenuFor(null);
                setConfirmDelete(message);
              }}
              onJumpTo={jumpTo}
              onOpenImage={setLightbox}
              registerRef={(element) => {
                if (element) bubbleRefs.current.set(message.id, element);
                else bubbleRefs.current.delete(message.id);
              }}
            />
            ))}

            {/*
              The satisfaction box is part of the conversation, appended where the
              thread ended — that is where the farmer looks after «اتمام مکالمه»,
              and a modal over the page would interrupt reading the answers they
              just got.
            */}
            {isDeskThread && conversation && (
              <div className="pt-3">
                <SurveyCard
                  conversationId={conversation.id}
                  survey={conversation.survey}
                  agentName={
                    conversation.last_agent?.name
                    || conversation.agent?.name
                    || conversation.channel_label
                  }
                  onSubmitted={() => void load(true)}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="shrink-0 border-t border-emerald-100 bg-white p-2.5 dark:border-emerald-800 dark:bg-emerald-950 sm:p-3"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Quoted message / edit banner above the input, like Telegram. */}
        <AnimatePresence initial={false}>
          {editing && (
            <ComposerBanner
              key="edit"
              icon={<Pencil size={14} />}
              title={t('direct.editing')}
              text={editing.body}
              tone="amber"
              onCancel={cancelEdit}
              cancelLabel={t('common.cancel')}
            />
          )}
          {!editing && replyTo && (
            <ComposerBanner
              key="reply"
              icon={<Reply size={14} />}
              title={`${t('direct.replyingTo')} ${replyTo.is_mine ? t('direct.you') : replyTo.sender_name}`}
              text={quoteSummary(
                {
                  id: replyTo.id,
                  sender_name: replyTo.sender_name,
                  is_mine: replyTo.is_mine,
                  body: replyTo.body,
                  attachment_type: replyTo.attachment_type,
                  listing_title: replyTo.listing?.title ?? '',
                  is_deleted: replyTo.is_deleted,
                },
                t,
              )}
              tone="emerald"
              onCancel={() => setReplyTo(null)}
              cancelLabel={t('common.cancel')}
            />
          )}
        </AnimatePresence>

        {attachedListing && !editing && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-700 dark:bg-emerald-900/40">
            <AttachedProductCard listing={attachedListing} compact />
            <button
              type="button"
              onClick={() => attachListing(null)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-500 dark:hover:bg-emerald-950"
              aria-label={t('common.cancel')}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {isDeskThread && !editing && attachedLand && (
          <AttachedLandChip land={attachedLand} onRemove={() => attachLand(null)} />
        )}

        {isDeskThread && !editing && desk && (
          <DeskComposer
            desk={desk}
            started={hasWritten}
            disabled={sending}
            onSend={(text) => void sendCannedReply(text)}
            onFill={(text) => {
              setBody(text);
              composerRef.current?.focus();
            }}
          />
        )}
        {/* Pending photo/clip preview — sending is still an explicit action. */}
        {pendingMedia && !editing && (
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
          {/* Media and voice make no sense while rewriting a text message. */}
          {!editing && (
            <>
              <button
                type="button"
                onClick={() => mediaInputRef.current?.click()}
                disabled={sending}
                aria-label="ارسال تصویر یا ویدیو"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-900"
              >
                <ImagePlus size={19} />
              </button>

              {/* A land case file only means something to the desks that advise
                  on the field, not to a shop negotiation. */}
              {isDeskThread && (
                <AttachLandButton disabled={sending} onPick={pickLand} />
              )}

              <VoiceRecorder onRecorded={(blob, seconds, name) => void sendVoice(blob, seconds, name)} disabled={sending} />
            </>
          )}

          <textarea
            ref={composerRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
              if (event.key === 'Escape') {
                if (editing) cancelEdit();
                else if (replyTo) setReplyTo(null);
              }
            }}
            rows={1}
            placeholder={editing ? t('direct.editPlaceholder') : t('direct.placeholder')}
            // 16px keeps iOS Safari from zooming the whole page on focus.
            className={cn(
              'max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border bg-white px-4 py-2.5 text-base leading-6 outline-none transition focus-visible:ring-2 dark:bg-emerald-900 dark:text-white sm:text-fluid-sm',
              editing
                ? 'border-amber-300 focus-visible:ring-amber-400 dark:border-amber-700'
                : 'border-emerald-200 focus-visible:ring-emerald-500 dark:border-emerald-700',
            )}
            aria-label={editing ? t('direct.editPlaceholder') : t('direct.placeholder')}
          />
          <button
            type="submit"
            disabled={composerDisabled}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-md disabled:opacity-50',
              editing ? 'bg-amber-500' : 'bg-brand-gradient-accent',
            )}
            aria-label={editing ? t('common.save') : t('common.send')}
          >
            {editing ? (
              <Check size={18} />
            ) : (
              <Send size={17} className="-translate-x-px translate-y-px -scale-x-100" />
            )}
          </button>
        </div>
      </form>

      {/* Delete confirmation — a small sheet, not window.confirm, so it reads
          in Persian and respects the theme. */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[125] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-message-title"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-emerald-950"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
                  <Trash2 size={19} />
                </span>
                <div className="min-w-0">
                  <h3 id="delete-message-title" className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                    {t('direct.deleteTitle')}
                  </h3>
                  <p className="mt-0.5 text-fluid-2xs leading-5 text-slate-500 dark:text-emerald-200">
                    {t('direct.deleteHint')}
                  </p>
                </div>
              </div>
              {confirmDelete.body && (
                <p className="mt-3 line-clamp-3 rounded-xl bg-slate-50 p-3 text-fluid-xs leading-6 text-slate-600 dark:bg-emerald-900/50 dark:text-emerald-100">
                  {confirmDelete.body}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 text-fluid-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-emerald-800 dark:text-emerald-100 dark:hover:bg-emerald-900"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteMessage(confirmDelete)}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 text-fluid-xs font-bold text-white transition hover:bg-rose-700"
                >
                  <Trash2 size={14} />
                  {t('direct.delete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

// ============================================================================
// Bubble
// ============================================================================

function MessageBubble({
  message,
  menuOpen,
  highlighted,
  isEditing,
  onToggleMenu,
  onReply,
  onEdit,
  onCopy,
  onDelete,
  onJumpTo,
  onOpenImage,
  registerRef,
}: {
  message: StorefrontMessage;
  menuOpen: boolean;
  highlighted: boolean;
  isEditing: boolean;
  onToggleMenu: () => void;
  onReply: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onJumpTo: (id: number) => void;
  onOpenImage: (url: string) => void;
  registerRef: (element: HTMLElement | null) => void;
}) {
  const { t } = useTranslation();
  const mine = message.is_mine;
  const deleted = message.is_deleted;

  // A line the platform wrote («گفتگو بسته شد», «خارج از ساعت کاری») has no
  // author and nothing to reply to, so it is centred as a note instead of
  // pretending to be somebody's bubble.
  if (message.is_system) {
    return <SystemNotice message={message} />;
  }

  return (
    <motion.article
      ref={registerRef}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('group/msg flex', mine ? 'justify-end' : 'justify-start')}
    >
      {/*
        Bubbles cap at 88% of a phone's width and the corner "tail" uses
        logical properties, so in RTL it points at the correct speaker instead
        of at the opposite side of the screen.
      */}
      <div className="relative max-w-[88%] sm:max-w-[75%]">
        <div className={cn('flex items-end gap-1', mine ? 'flex-row' : 'flex-row-reverse')}>
          {/* Action trigger — sits on the outer side of the bubble. Always
              visible on touch, on hover for pointers. */}
          {!deleted && (
            <div className="relative shrink-0" data-message-menu>
              <button
                type="button"
                onClick={onToggleMenu}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={t('direct.actions')}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-emerald-900 dark:hover:text-emerald-100',
                  '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/msg:opacity-100',
                  menuOpen && '!opacity-100 bg-white text-slate-700 dark:bg-emerald-900 dark:text-emerald-100',
                )}
              >
                <MoreHorizontal size={16} />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.ul
                    role="menu"
                    initial={{ opacity: 0, scale: 0.95, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 4 }}
                    transition={{ duration: 0.14 }}
                    className={cn(
                      'absolute bottom-full z-30 mb-1 w-44 overflow-hidden rounded-2xl border border-slate-100 bg-white p-1 text-start shadow-xl dark:border-emerald-800 dark:bg-emerald-950',
                      mine ? 'end-0' : 'start-0',
                    )}
                  >
                    <MenuItem icon={Reply} label={t('direct.reply')} onClick={onReply} />
                    {message.body && <MenuItem icon={Copy} label={t('direct.copy')} onClick={onCopy} />}
                    {message.can_edit && <MenuItem icon={Pencil} label={t('common.edit')} onClick={onEdit} />}
                    {message.can_delete && (
                      <MenuItem icon={Trash2} label={t('direct.delete')} onClick={onDelete} danger />
                    )}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}

          <div
            className={cn(
              'w-fit rounded-2xl px-3.5 py-2.5 text-fluid-sm leading-6 shadow-sm transition-shadow duration-300',
              mine
                ? 'rounded-ee-md bg-emerald-600 text-white'
                : 'rounded-es-md bg-white text-slate-700 dark:bg-emerald-900 dark:text-emerald-50',
              mine && 'ms-auto',
              deleted && (mine ? 'bg-emerald-600/60' : 'bg-white/70 dark:bg-emerald-900/60'),
              highlighted && 'ring-2 ring-amber-400 ring-offset-2 ring-offset-emerald-50 dark:ring-offset-emerald-950',
              isEditing && 'ring-2 ring-amber-400 ring-offset-2 ring-offset-emerald-50 dark:ring-offset-emerald-950',
            )}
          >
            {/* The quoted parent, tappable to jump back to it. */}
            {message.reply_to && (
              <button
                type="button"
                onClick={() => onJumpTo(message.reply_to!.id)}
                className={cn(
                  'mb-2 flex w-full min-w-0 items-stretch gap-2 rounded-xl border-s-[3px] px-2.5 py-1.5 text-start transition',
                  mine
                    ? 'border-lime-200 bg-white/15 hover:bg-white/25'
                    : 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-950',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-fluid-2xs font-extrabold',
                      mine ? 'text-lime-100' : 'text-emerald-700 dark:text-lime-300',
                    )}
                  >
                    {message.reply_to.is_mine ? t('direct.you') : message.reply_to.sender_name}
                  </span>
                  <span
                    className={cn(
                      'block truncate text-fluid-2xs',
                      mine ? 'text-white/85' : 'text-slate-500 dark:text-emerald-200',
                      message.reply_to.is_deleted && 'italic',
                    )}
                  >
                    {quoteSummary(message.reply_to, t)}
                  </span>
                </span>
              </button>
            )}

            {deleted ? (
              <p
                className={cn(
                  'flex items-center gap-1.5 text-fluid-xs italic',
                  mine ? 'text-white/85' : 'text-slate-400 dark:text-emerald-300/80',
                )}
              >
                <Ban size={13} aria-hidden="true" />
                {t('direct.deleted')}
              </p>
            ) : (
              <>
                {message.body && (
                  <p className="whitespace-pre-wrap break-words hyphens-auto">{message.body}</p>
                )}
                <MessageAttachment message={message} onOpenImage={onOpenImage} />
                {message.listing && <AttachedProductCard listing={message.listing} />}
                {message.land && (
                  <LandDossierCard land={message.land} tone={mine ? 'dark' : 'light'} />
                )}
                {message.link && <MessageLink link={message.link} tone={mine ? 'dark' : 'light'} />}
              </>
            )}
          </div>
        </div>

        <p
          className={cn(
            'mt-1 flex items-center gap-1.5 px-1 text-fluid-2xs text-slate-400 dark:text-emerald-300/70',
            mine ? 'justify-end' : 'justify-start',
          )}
        >
          <span>{mine ? t('direct.you') : message.sender_name}</span>
          {!mine && message.sender_role_label && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
              {message.sender_role_label}
            </span>
          )}
          {mine && <MessageStatusTicks isRead={message.is_read} />}
          {message.created_at && (
            <time dateTime={message.created_at}>
              {new Date(message.created_at).toLocaleTimeString('fa-IR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          )}
          {message.is_edited && !deleted && (
            <span
              className="flex items-center gap-0.5"
              title={
                message.edited_at
                  ? new Date(message.edited_at).toLocaleString('fa-IR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      month: 'long',
                      day: 'numeric',
                    })
                  : undefined
              }
            >
              <Pencil size={10} aria-hidden="true" />
              {t('direct.editedMark')}
            </span>
          )}
        </p>
      </div>
    </motion.article>
  );
}

/**
 * A centred system line: closed threads, reopened threads, the out-of-hours
 * notice. Deliberately quiet — it is a state change, not another voice in the
 * conversation, and it never counts as an unread message.
 */
function SystemNotice({ message }: { message: StorefrontMessage }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto flex w-fit max-w-[88%] items-center gap-1.5 rounded-full bg-emerald-100/70 px-3 py-1 text-center text-fluid-2xs font-bold leading-5 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
    >
      <span className="whitespace-pre-wrap break-words">{message.body}</span>
      {message.created_at && (
        <time
          dateTime={message.created_at}
          className="shrink-0 opacity-70"
          title={new Date(message.created_at).toLocaleString('fa-IR')}
        >
          {new Date(message.created_at).toLocaleTimeString('fa-IR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      )}
    </motion.p>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: typeof Reply;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        className={cn(
          'flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-fluid-xs font-bold transition',
          danger
            ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40'
            : 'text-slate-700 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900',
        )}
      >
        <Icon size={15} aria-hidden="true" />
        {label}
      </button>
    </li>
  );
}

/** The strip above the input that says what the next send will do. */
function ComposerBanner({
  icon,
  title,
  text,
  tone,
  onCancel,
  cancelLabel,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: 'emerald' | 'amber';
  onCancel: () => void;
  cancelLabel: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden"
    >
      <div
        className={cn(
          'mb-2 flex items-center gap-2 rounded-xl border-s-4 px-3 py-2',
          tone === 'amber'
            ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
            : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/40',
        )}
      >
        <span
          className={cn(
            'shrink-0',
            tone === 'amber' ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-lime-300',
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-fluid-2xs font-extrabold',
              tone === 'amber' ? 'text-amber-700 dark:text-amber-200' : 'text-emerald-700 dark:text-lime-300',
            )}
          >
            {title}
          </span>
          <span className="block truncate text-fluid-2xs text-slate-500 dark:text-emerald-200">
            {text || <CornerUpLeft size={11} className="inline" />}
          </span>
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-500 dark:hover:bg-emerald-950"
          aria-label={cancelLabel}
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
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

/**
 * The listing card inside a bubble. It links to the listing's own detail
 * (opened on its storefront page), not just to the storefront, so tapping
 * "محصول پیوست‌شده" lands on exactly the آگهی being discussed.
 */
function AttachedProductCard({ listing, compact = false }: { listing: AttachedListing; compact?: boolean }) {
  const { t } = useTranslation();
  const closeDirect = useDirectStore((state) => state.closeDirect);
  return (
    <Link
      to={listingHref(listing)}
      // Navigating from inside the drawer should close it, otherwise the
      // page changes behind an open overlay and nothing seems to happen.
      onClick={() => closeDirect()}
      className={cn(
        'flex items-center gap-2 overflow-hidden rounded-xl transition',
        compact ? '' : 'mt-2 bg-white/15 p-1.5 backdrop-blur-sm hover:bg-white/25',
      )}
      aria-label={`${t('direct.attachedProduct')}: ${listing.title}`}
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
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-fluid-2xs font-bold',
          compact
            ? 'text-emerald-600 dark:text-lime-300'
            : 'bg-white/20 text-lime-100 underline-offset-2 hover:underline',
        )}
      >
        {compact ? t('direct.attachedProduct') : t('direct.viewListing')}
      </span>
    </Link>
  );
}
