// frontend/src/types/user.ts — domain types (split from types/index.ts)

import type { Order } from './commerce';
import type { MarketplaceListing, StorefrontPost } from './storefront';
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

/** Access levels 1-5; see UserAccount.LEVEL_CHOICES on the backend. */

export const USER_LEVEL = {
  BUYER: 1,
  VERIFIED_BUYER: 2,
  SELLER: 3,
  VERIFIED_SELLER: 4,
  DESK_AGENT: 5,
  MODERATOR: 6,
  ADMIN: 7,
  OWNER: 8,
} as const;

export type UserLevel = (typeof USER_LEVEL)[keyof typeof USER_LEVEL];

/** The first staff rank: from here up, a person answers the desks. */

export const STAFF_LEVEL_FLOOR: UserLevel = USER_LEVEL.DESK_AGENT;

/**
 * What a rank buys. The list itself comes from the server (`/api/levels/`);
 * these names exist so a call site is a typo-checked string instead of a
 * free-form key.
 */

export type UserCapability =
  | 'browse'
  | 'order'
  | 'review'
  | 'contact_storefront'
  | 'support_chat'
  | 'consult_desk'
  | 'loyalty'
  | 'affiliate'
  | 'verified_badge'
  | 'sell'
  | 'featured_storefront'
  | 'desk_queue'
  | 'moderate'
  | 'console'
  | 'manage_staff'
  | 'own';

export type UserCapabilities = Partial<Record<UserCapability, boolean>>;

/** One step of the ladder, as the API publishes it. */

export interface LevelRank {
  value: UserLevel;
  key: string;
  label: string;
  short_label: string;
  promise: string;
  how: string;
  is_staff: boolean;
  unlocks: { key: UserCapability; label: string }[];
}

/** «یک پله جلوتر» on the profile card. */

export interface LevelNextStep {
  value: number;
  label: string;
  how: string;
  promise: string;
}

export interface LevelsSnapshot {
  ladder: LevelRank[];
  capabilities: Record<UserCapability, { label: string; minimum_level: number }>;
  level_range: { min: number; max: number };
  viewer_level: number;
  viewer_rank: Pick<LevelRank, 'value' | 'label' | 'short_label' | 'promise'> | null;
  viewer_is_staff: boolean;
  viewer_capabilities: UserCapabilities;
  next_step: LevelNextStep | null;
}

export interface UserAccount {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  phone_verified_at: string | null;
  gender: 'male' | 'female';
  address: string;
  avatar: string | null;
  avatar_url: string;
  level: UserLevel;
  level_label: string;
  /** «غرفه‌دار» without the «سطح ۳ — » prefix, for chips. */
  level_short_label: string;
  /** What this account may do, straight from the server's ladder. */
  capabilities?: UserCapabilities;
  /** The rank one step up and how to reach it; null at the top or at a wall. */
  next_level?: LevelNextStep | null;
  has_storefront: boolean;
  /** Wallet loyalty balance (100 pts = 10,000 toman at checkout); absent when
      the wallet row does not exist yet. Server: UserAccountSerializer. */
  loyalty_points?: number;
  created: string;
  updated: string;
}

// ========================================
// Comment (مطابق با CommentSerializer)
// ========================================

export interface AuthResponse {
  user: User;
  account: UserAccount | null;
  message: string;
  created?: boolean;
  /**
   * Present only in a preview started with GK_PREVIEW_IFRAME_COOKIES under DEBUG:
   * the fallback for a frame that will not store the session cookie. The production
   * response has no such field, so this is not a place to read a credential from.
   */
  preview_token?: string;
}

export interface OtpRequestResponse {
  request_id: string;
  masked_phone: string;
  channel: 'sms' | 'bale';
  expires_in: number;
  resend_after: number;
  message: string;
  /** Returned only when Django DEBUG and OTP_RETURN_DEBUG_CODE are both enabled. */
  debug_code?: string;
}

export interface ProfileResponse {
  user: User;
  account: UserAccount | null;
}

// ========================================
// Orders and agriculture platform
// ========================================

export interface WebPushSubscriptionSummary {
  id: string;
  endpoint_fingerprint: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManagementMetric {
  paid_revenue: number | null;
  pending_orders: number | null;
  open_complaints: number | null;
  pending_posts: number | null;
  pending_listings: number | null;
  low_stock_products: number | null;
  active_storefronts: number | null;
  active_affiliates: number | null;
}

export interface ManagementDashboard {
  viewer: { username: string; is_superuser: boolean; groups: string[] };
  viewer_level: number;
  metrics: ManagementMetric;
  recent_orders: Order[];
  /** Items awaiting review, surfaced directly on the dashboard. */
  pending_review: {
    listings: MarketplaceListing[];
    posts: StorefrontPost[];
  };
  alerts: { type: string; count: number | null; label: string }[];
}

export interface ManagementStaffMember {
  id: number;
  username: string;
  email: string;
  is_superuser: boolean;
  is_active: boolean;
  groups: string[];
}

export interface ManagementAuditLog {
  id: number;
  actor_username: string;
  action: string;
  target_type: string;
  target_id: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
