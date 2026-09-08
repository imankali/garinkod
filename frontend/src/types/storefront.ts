// frontend/src/types/storefront.ts — domain types (split from types/index.ts)

import type { ImageSrcset } from './shop';
import type { ProductAttribute } from './shop';
export type SellerType = 'farmer' | 'cooperative' | 'merchant' | 'company';

export interface Storefront {
  id: number;
  name: string;
  slug: string;
  seller_type: SellerType;
  seller_type_label: string;
  bio: string;
  avatar: string | null;
  avatar_url: string;
  cover: string | null;
  cover_url: string;
  province: string;
  city: string;
  is_verified: boolean;
  is_active: boolean;
  commission_rate: string;
  rating: string;
  sales_count: number;
  followers_count: number;
  listing_count: number;
  is_following: boolean;
  is_owner: boolean;
  has_active_stories: boolean;
  has_unseen_stories: boolean;
  owner_name: string;
  created_at: string;
}

export interface StorefrontHighlightItem {
  id: number;
  post: number;
  position: number;
  image_url: string;
  caption: string;
  created_at: string;
}

export interface StorefrontHighlight {
  id: number;
  title: string;
  cover: string | null;
  cover_url: string;
  position: number;
  items: StorefrontHighlightItem[];
  created_at: string;
}

/** Everything the public storefront page needs, in one response. */

export interface StorefrontProfile {
  storefront: Storefront;
  listings: MarketplaceListing[];
  posts: StorefrontPost[];
  stories: StorefrontPost[];
  highlights: StorefrontHighlight[];
  counts: {
    listings: number;
    posts: number;
    stories: number;
    followers: number;
  };
}

export interface StorefrontAvailability {
  name?: { value: string; available: boolean; reason: string };
  slug?: { value: string; available: boolean; suggestion: string; reason: string };
}

export interface FollowedStorefront {
  storefront: Storefront;
  stories: StorefrontPost[];
}

export interface MarketplaceListing {
  id: number;
  storefront: Storefront;
  title: string;
  slug: string;
  crop_name: string;
  description: string;
  price: number;
  unit: string;
  quantity_available: string;
  min_order_quantity: string;
  minimum_order: number;
  harvest_date: string | null;
  image: string | null;
  image_url: string;
  image_srcset?: ImageSrcset | null;
  status: string;
  status_label: string;
  is_purchasable: boolean;
  discount_percent: number;
  sales_count: number;
  discounted_price: number;
  rejection_reason: string;
  reviewed_at: string | null;
  /** Optional spec rows the seller can publish with the آگهی. */
  attributes?: ProductAttribute[];
  created_at: string;
  updated_at: string;
}

// ========================================
// Direct messages between buyers and storefronts
// ========================================

export interface AttachedListing {
  id: number;
  title: string;
  slug: string;
  price: number;
  discounted_price: number;
  unit: string;
  image_url: string;
  storefront_name: string;
  storefront_slug: string;
}

/** Where a thread comes from — shown as a badge so provenance is never lost. */

export interface StorefrontPost {
  id: number;
  storefront: number;
  storefront_name: string;
  storefront_slug: string;
  storefront_avatar_url: string;
  storefront_is_verified: boolean;
  listing: number | null;
  post_type: 'post' | 'story';
  post_type_label: string;
  caption: string;
  image: string | null;
  image_url: string;
  status: string;
  status_label: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Instagram-style social state.
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  /** Whether the viewer has already watched this story. */
  is_seen: boolean;
  is_owner: boolean;
}

export interface StorefrontPostComment {
  id: number;
  post: number;
  parent: number | null;
  body: string;
  author_name: string;
  author_avatar_url: string;
  is_mine: boolean;
  /** The comment author, or the owner of the post it sits on. */
  can_moderate: boolean;
  replies: StorefrontPostComment[];
  created_at: string;
}

// ========================================
// Legal documents
// ========================================

/** A section of a legal document as authored in the admin panel. */
