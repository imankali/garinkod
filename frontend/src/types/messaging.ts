// frontend/src/types/messaging.ts — domain types (split from types/index.ts)

import type { AttachedListing, Storefront } from './storefront';
import type { LandType } from './farming';
export type MessageChannel = 'storefront' | 'support' | 'consulting' | 'comment';

export type MessageAttachmentType = 'image' | 'video' | 'audio';

/** The compact quote of the message a reply answers. */

export interface QuotedMessage {
  id: number;
  sender_name: string;
  is_mine: boolean;
  body: string;
  attachment_type: MessageAttachmentType | '';
  listing_title: string;
  is_deleted: boolean;
}

/** The land case file a farmer shares, in the shape a consultant reads it. */

export interface SharedLandDossier {
  id: number;
  name: string;
  land_type: LandType;
  land_type_label: string;
  area_label: string;
  crop_type: string;
  crop_variety: string;
  province: string;
  city: string;
  soil_type_label: string;
  irrigation_type_label: string;
  planting_date: string | null;
  notes: string;
  event_count: number;
  owner_name: string;
}

/** A button inside a message bubble: the post, product or desk it refers to. */

export interface MessageLink {
  kind: string;
  label: string;
  url: string;
}

/** The desk profile of whoever answers — the name the farmer should see. */

export interface DeskAgentPublic {
  id: number;
  name: string;
  title: string;
  photo_url: string;
  role: 'consulting' | 'support';
  specialties: string[];
  on_duty: boolean;
  online: boolean;
  open_threads: number;
  rating_average: number;
  rating_count: number;
}

export interface DeskQuickReply {
  id: number;
  label: string;
  text: string;
  first_message_only: boolean;
}

/** One object that answers «کی هست و کی جواب می‌دهد», shared by chat and queue. */

export interface DeskState {
  channel: Exclude<MessageChannel, 'storefront' | 'comment'>;
  channel_label: string;
  is_open: boolean;
  tracked: boolean;
  hours: string;
  work_days: string[];
  opens_at: string | null;
  opens_at_label: string;
  out_of_hours_note: string;
  online_count: number;
  waiting_expected_minutes: number;
  agents: DeskAgentPublic[];
  viewer_is_staff: boolean;
  quick_replies: DeskQuickReply[];
  /**
   * Whether this viewer may be a *customer* of this desk. Nobody queues in
   * front of a farmer at the desk they staff, so the card offers the queue
   * instead of a chat, and says why.
   */
  customer_allowed: boolean;
  customer_denied_reason: string;
}

/** Whether the satisfaction card is due on this thread. */

export interface ConversationSurvey {
  closed: boolean;
  closed_at: string | null;
  has_rating: boolean;
  can_rate: boolean;
}

/** The stored answer of one farmer, shown to the desk's managers only. */

export interface ConversationRating {
  id: number;
  conversation: number;
  conversation_info: { id: number; channel: MessageChannel; channel_label: string; customer: string };
  rater: number;
  rater_name: string;
  agent: number | null;
  agent_name: string;
  score: number;
  solved: boolean | null;
  comment: string;
  created_at: string;
}

export interface DeskRatingReport {
  days: number;
  window: { ratings: number; average: number; solved_rate: number };
  agents: {
    agent: DeskAgentPublic;
    window_ratings: number;
    window_average: number;
    open_threads: number;
  }[];
  results: ConversationRating[];
}

export interface StorefrontMessage {
  id: number;
  conversation: number;
  sender: number | null;
  sender_name: string;
  sender_avatar_url: string;
  /** «مشاور کشاورزی» under the name, so the title travels with the reply. */
  sender_role_label: string;
  /** Level 2+ (a confirmed phone number) or staff: the name carries the mark. */
  sender_verified?: boolean;
  /** Written by the platform (closing, hours), not by a person. */
  is_system: boolean;
  is_mine: boolean;
  body: string;
  listing: AttachedListing | null;
  land: SharedLandDossier | null;
  link: MessageLink | null;
  attachment: string | null;
  attachment_url: string;
  attachment_type: MessageAttachmentType | '';
  attachment_duration: number | null;
  reply_to: QuotedMessage | null;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  /** Server-side verdicts, so the menu never offers what the API refuses. */
  can_edit: boolean;
  can_delete: boolean;
  is_read: boolean;
  created_at: string;
}

export interface StorefrontConversation {
  id: number;
  channel: MessageChannel;
  channel_label: string;
  subject: string;
  /** Only storefront threads have one. */
  storefront: Storefront | null;
  counterpart_name: string;
  counterpart_avatar_url: string;
  last_message: StorefrontMessage | null;
  unread_count: number;
  /** «اتمام مکالمه» moves an open thread to closed, which unlocks the survey. */
  status: 'open' | 'closed';
  status_label: string;
  closed_at: string | null;
  /** Who the desk placed this thread with. */
  agent: DeskAgentPublic | null;
  /** Set only when someone else answered last: whose name the header shows. */
  last_agent: DeskAgentPublic | null;
  assigned_to_me: boolean;
  survey: ConversationSurvey;
  created_at: string;
  updated_at: string;
}

/** The service-thread response also carries the desk's own state. */

export interface ServiceConversationResponse extends StorefrontConversation {
  desk: DeskState;
}

export interface InboxResponse {
  count: number;
  results: StorefrontConversation[];
  unread_total: number;
  unread_by_channel: Partial<Record<MessageChannel, number>>;
  channels: { value: MessageChannel; label: string }[];
}

// ========================================
// Farm profile: lands, calendars and consultation
// ========================================
