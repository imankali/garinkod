// frontend/src/components/direct/ConversationRow.tsx
//
// One row in the inbox. Shared by the drawer and the full messages page so a
// thread looks and reads the same wherever it is listed — including the badge
// that names its source.

import { ArrowRight, LifeBuoy, MessageSquareReply, Sprout, Store } from 'lucide-react';

import type { MessageChannel, StorefrontConversation } from '../../types';
import { cn } from '../../utils/cn';
import { CHANNEL_TONE, conversationIdentity, conversationPreview } from '../../utils/conversation';

const CHANNEL_ICON: Record<MessageChannel, typeof Store> = {
  storefront: Store,
  support: LifeBuoy,
  consulting: Sprout,
  comment: MessageSquareReply,
};

export default function ConversationRow({
  conversation,
  active = false,
  fallbackPreview,
  onSelect,
  showChevron = false,
}: {
  conversation: StorefrontConversation;
  active?: boolean;
  fallbackPreview: string;
  onSelect: () => void;
  /** The drawer drills into a thread, so it shows a forward affordance. */
  showChevron?: boolean;
}) {
  const identity = conversationIdentity(conversation);
  const Icon = CHANNEL_ICON[identity.channel];
  const preview = conversationPreview(conversation, fallbackPreview);
  const unread = conversation.unread_count;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border p-3 text-start transition',
        active
          ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/50'
          : 'border-transparent hover:bg-emerald-50/70 dark:hover:bg-emerald-900/30',
      )}
    >
      {/* Avatar, or a channel-tinted icon when the source has no picture. */}
      <span
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl',
          CHANNEL_TONE[identity.channel],
        )}
      >
        {identity.avatarUrl ? (
          <img src={identity.avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <Icon size={20} aria-hidden="true" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-fluid-sm',
              unread > 0
                ? 'font-extrabold text-slate-900 dark:text-white'
                : 'font-bold text-slate-800 dark:text-white',
            )}
          >
            {identity.title}
          </span>
          {unread > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-fluid-2xs font-bold text-white">
              {unread.toLocaleString('fa-IR')}
            </span>
          )}
        </span>

        {/* The source badge: the reader always knows where a message is from. */}
        <span className="mt-1 flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-fluid-2xs font-bold',
              CHANNEL_TONE[identity.channel],
            )}
          >
            {identity.channelLabel}
          </span>
          {/*
            Two states a desk thread can be in that change what the reader should
            do next: it was ended (so writing again reopens it), or it ended and
            the survey is still unanswered (so the desk's performance is rated).
          */}
          {conversation.status === 'closed' && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-fluid-2xs font-bold text-slate-600 dark:bg-emerald-900 dark:text-emerald-200">
              {conversation.survey.can_rate ? 'نظرخواهی' : 'بسته شده'}
            </span>
          )}
          <span
            className={cn(
              'truncate text-fluid-xs',
              unread > 0
                ? 'font-semibold text-slate-700 dark:text-emerald-100'
                : 'text-slate-500 dark:text-emerald-200',
            )}
          >
            {preview}
          </span>
        </span>
      </span>

      {showChevron && (
        <ArrowRight size={15} aria-hidden="true" className="shrink-0 -scale-x-100 text-slate-300" />
      )}
    </button>
  );
}
