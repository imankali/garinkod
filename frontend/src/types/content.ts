// frontend/src/types/content.ts — domain types (split from types/index.ts)

import type { ProductList } from './shop';
export type ArticleKind = 'article' | 'guide';

export interface SiteArticleCard {
  id: number;
  title: string;
  slug: string;
  kind: ArticleKind;
  kind_label: string;
  excerpt: string;
  crop: string;
  cover: string | null;
  cover_url: string;
  author_name: string;
  published_at: string | null;
  updated_at: string;
  reading_minutes: number;
  views: number;
  is_featured: boolean;
  products_count: number;
  seo_title: string;
  seo_description: string;
}

export interface SiteArticleDetail extends Omit<SiteArticleCard, 'products_count'> {
  body: string;
  author: number | null;
  products: ProductList[];
  listings: Array<{
    id: number;
    title: string;
    slug: string;
    crop_name: string;
    price: number;
    unit: string;
    image_url: string;
    storefront_name: string;
    storefront_slug: string;
  }>;
  related_articles: SiteArticleCard[];
  headings: Array<{ title: string; anchor: string }>;
}

export interface FarmService {
  id: number;
  title: string;
  slug: string;
  code: string;
  summary: string;
  body: string;
  highlights: string[];
  icon: string;
  image: string | null;
  image_url: string;
  price_note: string;
  order: number;
  seo_title: string;
  seo_description: string;
}

export type SitePageBlockType =
  | 'heading'
  | 'text'
  | 'bullets'
  | 'image'
  | 'spec_table'
  | 'price_table'
  | 'video'
  | 'products'
  | 'articles'
  | 'cta'
  | 'quote'
  /** Question/answer rows, rendered as an accordion with FAQPage schema. */
  | 'faq';

/** The shop's own return window / express option, read from the admin record. */

export interface LegalPolicy {
  return_window_days: number | null;
  return_window_label: string;
  return_conditions: string;
  express_shipping: { enabled: boolean; fee: number };
  updated_at: string;
}

export interface SitePageBlock {
  id: number;
  block_type: SitePageBlockType;
  block_type_label: string;
  title: string;
  text: string;
  rows: string[][];
  image: string | null;
  image_url: string;
  video: string | null;
  video_url: string;
  link: string;
  data: Record<string, unknown>;
  position: number;
}

export interface SitePage {
  id: number;
  title: string;
  slug: string;
  kind: 'page' | 'landing';
  kind_label: string;
  hero_text: string;
  hero_image: string | null;
  hero_image_url: string;
  badge: string;
  product: {
    id: number;
    title: string;
    slug: string;
    price: number;
    discounted_price: number;
    image_url: string;
    is_in_stock: boolean;
    price_on_request: boolean;
  } | null;
  cta_label: string;
  cta_url: string;
  blocks: SitePageBlock[];
  published_at: string | null;
  updated_at: string;
  updated_by: string;
  seo_title: string;
  seo_description: string;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  bio: string;
  photo: string | null;
  photo_url: string;
  order: number;
}

export interface BrandPartner {
  id: number;
  name: string;
  /** The brand page of the catalogue; a partner without products still has one. */
  slug: string;
  logo: string | null;
  logo_url: string;
  website: string;
  description: string;
  since_year: number | null;
  order: number;
}

export interface SiteContactInfo {
  address: string;
  provinces_note: string;
  phones: string[];
  emails: string[];
  working_hours: string;
  whatsapp_number: string;
  telegram_url: string;
  instagram_url: string;
  eitaa_url: string;
  map_lat: number | string | null;
  map_lng: number | string | null;
  map_note: string;
  expert_name: string;
  expert_role: string;
  expert_photo: string | null;
  expert_photo_url: string;
  expert_note: string;
  updated_at: string;
}

export interface AboutResponse {
  team: TeamMember[];
  brands: BrandPartner[];
  stats: {
    products: number;
    storefronts: number;
    listings: number;
    articles: number;
    orders: number;
    provinces: number;
  };
  contact: SiteContactInfo;
}

// ========================================
// MockProduct (برای کامپوننت‌های فرانت‌اند)
// ========================================
// ✅ این interface برای داده‌های استاتیک در shopData.ts و تبدیل API به فرمت UI استفاده می‌شود

export interface Comment {
  id: number;
  product: number;
  name: string;
  email: string;
  body: string;
  image: string | null;
  sticker: string;
  /** 1..5 star score of a review; null on a question or an answer. */
  rating: number | null;
  /** The reviewer has a paid order containing this product. */
  is_verified_purchase?: boolean;
  parent: number | null;
  created: string;
  updated: string;
  active: boolean;
  replies?: Comment[];
  /** How many readers marked this review useful. */
  helpful_count?: number;
  is_featured?: boolean;
  is_reported?: boolean;
}

// ========================================
// API Response Types
// ========================================

export interface PlatformFeedbackPayload {
  name?: string;
  email?: string;
  kind: 'suggestion' | 'criticism' | 'consultation' | 'other';
  subject: string;
  message: string;
}

export interface StorefrontComplaintPayload {
  storefront: number;
  listing?: number;
  order?: number;
  subject: string;
  description: string;
}

export interface VisualDiagnosis {
  status: string;
  key: string;
  title: string;
  category: string;
  confidence_score: number;
  confidence_percent: number;
  symptoms: string[];
  treatment_advice: string;
  image_meta?: {
    width: number;
    height: number;
    dominant_hue: string;
  };
  suggested_inputs?: Array<{
    id: number;
    name: string;
    kind: string;
    active_ingredient?: string;
    safety_notes?: string;
    preharvest_interval_days?: number;
  }>;
  suggested_products?: Array<{
    id: number;
    title: string;
    slug: string;
    price: number;
    image_url?: string;
    in_stock: boolean;
  }>;
  disclaimer: string;
}

export interface VisualSearchResponse {
  request: {
    id: number;
    target: string;
    status: string;
    status_label: string;
    result_payload: Record<string, unknown>;
    created_at: string;
  };
  diagnosis?: VisualDiagnosis;
  message: string;
}

export interface LegalBlock {
  id: number;
  type: SitePageBlockType;
  title: string;
  text: string;
}

export interface LegalDocumentSummary {
  slug: string;
  title: string;
  /** The footer/menu label: shorter than the page heading. */
  short_title: string;
  group: string;
  group_label: string;
  icon: string;
  summary: string;
  /** `page` = published admin text, `code` = the wording shipped with the app. */
  source: 'page' | 'code';
  updated_at: string | null;
  url: string;
}

export interface LegalDocument extends LegalDocumentSummary {
  blocks: LegalBlock[];
  sections: Array<{ title: string; body: string }>;
  /** Present on «بازگشت کالا»: the live window, so the text never guesses one. */
  policy?: LegalPolicy;
}

export interface LegalIndex {
  groups: Array<{ id: string; label: string; items: LegalDocumentSummary[] }>;
  documents: LegalDocumentSummary[];
  /** Fingerprint of the text in force; recorded on every order. */
  version: string;
  /** What the operator configured for returns and express delivery. */
  policy?: LegalPolicy;
}

// ========================================
// Helper Types
// ========================================
