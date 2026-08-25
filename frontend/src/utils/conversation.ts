// frontend/src/utils/conversation.ts
//
// One place that answers "who is this thread with, and where did it come
// from?". Every inbox surface (the drawer, the full page, the thread header)
// used to reach into `conversation.storefront` directly, which broke as soon
// as threads could also come from support, consulting or comment replies.

import type { MessageChannel, StorefrontConversation } from '../types';

export interface ConversationIdentity {
  /** Display name of the other party. */
  title: string;
  /** Avatar to show, or '' when the channel should render an icon instead. */
  avatarUrl: string;
  /** Human-readable source, e.g. "پشتیبانی" — always shown as a badge. */
  channelLabel: string;
  channel: MessageChannel;
  /** Link to the counterpart's page, when one exists. */
  href?: string;
}

/** Tailwind classes per channel, so a source is recognisable at a glance. */
export const CHANNEL_TONE: Record<MessageChannel, string> = {
  storefront: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
  support: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200',
  consulting: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  comment: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200',
};

export function conversationIdentity(
  conversation: StorefrontConversation,
): ConversationIdentity {
  const channelLabel = conversation.channel_label;

  if (conversation.channel === 'storefront' && conversation.storefront) {
    return {
      title: conversation.counterpart_name || conversation.storefront.name,
      avatarUrl: conversation.counterpart_avatar_url || conversation.storefront.avatar_url || '',
      channelLabel,
      channel: conversation.channel,
      href: `/storefronts/${conversation.storefront.slug}`,
    };
  }

  return {
    title: conversation.counterpart_name || channelLabel,
    avatarUrl: conversation.counterpart_avatar_url || '',
    channelLabel,
    channel: conversation.channel,
  };
}

/** A one-line preview of the newest message, including media placeholders. */
export function conversationPreview(
  conversation: StorefrontConversation,
  fallback: string,
): string {
  const message = conversation.last_message;
  if (!message) return fallback;
  if (message.body) return message.body;
  if (message.attachment_type === 'image') return '🖼 تصویر';
  if (message.attachment_type === 'video') return '🎬 ویدیو';
  if (message.attachment_type === 'audio') return '🎤 پیام صوتی';
  if (message.listing) return `📦 ${message.listing.title}`;
  return fallback;
}
