// frontend/src/types/index.ts
// ✅ این فایل شامل تمام TypeScript interfaces پروژه است
// ✅ مطابق با serializers.py در Backend

// ========================================
// Category & SubCategory
// ========================================

export interface SubCategory {
  id: number;
  name: string;
  slug: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  subcategories?: SubCategory[];
  product_count: number;
}

// ========================================
// Product Detail Types (مطابق با models.py)
// ========================================

export interface FertilizerDetail {
  fertilizer_type: string;
  nitrogen: string;
  phosphorus: string;
  potassium: string;
}

export interface PesticideDetail {
  pesticide_type: string;
  active_ingredient: string;
  concentration: string;
}

export interface SeedDetail {
  crop_type: string;
  variety: string;
  weight: string;
}

export interface EquipmentDetail {
  tool_type: string;
  material: string;
  weight: string;
}

// ========================================
// Product (مطابق با ProductSerializer)
// ========================================

export interface Product {
  id: number;
  title: string;
  slug: string;
  author: string;
  category: Category | string;
  subcategory?: SubCategory | null;
  description: string;
  publish: string;
  created: string;
  updated: string;
  status: 'draft' | 'published';
  price: number;
  stock: number;
  available: boolean;
  is_featured: boolean;
  image: string | null;
  image_url: string;
  is_in_stock: boolean;

  // ✅ فیلدهای detail (اختیاری - فقط در detail endpoint برمی‌گردند)
  fertilizer_detail?: FertilizerDetail;
  pesticide_detail?: PesticideDetail;
  seed_detail?: SeedDetail;
  equipment_detail?: EquipmentDetail;
}

// ========================================
// ProductList (مطابق با ProductListSerializer - نسخه سبک)
// ========================================

export interface ProductList {
  id: number;
  title: string;
  slug: string;
  category: string;
  price: number;
  stock: number;
  available: boolean;
  is_featured: boolean;
  image: string | null;
  image_url: string;
  is_in_stock: boolean;
  discount_percent: number;
  sales_count: number;
  discounted_price: number;
}

// ========================================
// MockProduct (برای کامپوننت‌های فرانت‌اند)
// ========================================
// ✅ این interface برای داده‌های استاتیک در shopData.ts و تبدیل API به فرمت UI استفاده می‌شود

export interface MockProduct {
  id: number;
  /** API products have a slug; static recommendation cards may not. */
  slug?: string;
  name: string;
  category: string;
  categoryId: string;
  subCategoryId: string;
  brand: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  badge?: string;
  inStock: boolean;
  description: string;
  features: string[];
  cropTags: string[];
  pestTags: string[];
  usage: {
    dosage: string;
    method: string;
    timing: string;
    preHarvestInterval?: string;
  };
  warnings: string[];
  compatibleWith: string[];
  brochureAvailable: boolean;
}

// ========================================
// Cart & CartItem (مطابق با CartSerializer)
// ========================================

/** A listing as it appears inside a cart row (trimmed, no storefront tree). */
export interface CartListing {
  id: number;
  title: string;
  slug: string;
  price: number;
  unit: string;
  quantity_available: string;
  min_order_quantity: string;
  image_url: string;
  storefront_name: string;
  storefront_slug: string;
}

/**
 * A cart row is either a catalogue product or a storefront listing; `kind`
 * says which, and exactly one of `product` / `listing` is non-null.
 */
export interface CartItem {
  id: number;
  kind: 'product' | 'listing';
  product: ProductList | null;
  listing: CartListing | null;
  title: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  available_quantity: number;
  min_order_quantity: number;
  is_in_stock: boolean;
}

export interface Cart {
  id: number;
  items: CartItem[];
  total_price: number;
  total_items: number;
  created_at: string;
  updated_at: string;
}

// ========================================
// User & UserAccount (مطابق با UserSerializer و UserAccountSerializer)
// ========================================

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
  SELLER: 2,
  MODERATOR: 3,
  ADMIN: 4,
  OWNER: 5,
} as const;

export type UserLevel = (typeof USER_LEVEL)[keyof typeof USER_LEVEL];

export interface UserAccount {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  gender: 'male' | 'female';
  address: string;
  avatar: string | null;
  avatar_url: string;
  level: UserLevel;
  level_label: string;
  has_storefront: boolean;
  created: string;
  updated: string;
}

// ========================================
// Comment (مطابق با CommentSerializer)
// ========================================

export interface Comment {
  id: number;
  product: number;
  name: string;
  email: string;
  body: string;
  image: string | null;
  sticker: string;
  parent: number | null;
  created: string;
  updated: string;
  active: boolean;
  replies?: Comment[];
}

// ========================================
// API Response Types
// ========================================

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AuthResponse {
  user: User;
  message: string;
}

export interface ProfileResponse {
  user: User;
  account: UserAccount | null;
}

// ========================================
// Orders and agriculture platform
// ========================================
export interface OrderItem {
  id: number;
  kind: 'product' | 'listing';
  kind_label: string;
  product: number | null;
  listing: number | null;
  product_title: string;
  product_slug: string;
  storefront: number | null;
  storefront_name: string;
  storefront_slug: string;
  seller_name: string;
  unit: string;
  unit_price: number;
  quantity: number;
  total_price: number;
}

export interface Order {
  id: number;
  code: string;
  customer_name: string;
  phone: string;
  email: string;
  province: string;
  city: string;
  address: string;
  postal_code: string;
  notes: string;
  subtotal: number;
  discount_amount: number;
  coupon_code: string;
  shipping_price: number;
  total_price: number;
  status: string;
  status_label: string;
  payment_status: string;
  payment_status_label: string;
  payment_method: string;
  payment_method_label: string;
  total_items: number;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface CheckoutPayload {
  customer_name: string;
  phone: string;
  email?: string;
  province: string;
  city: string;
  address: string;
  postal_code?: string;
  notes?: string;
  payment_method: 'coordination' | 'zarinpal' | 'stripe_card' | 'paypal' | 'crypto';
  affiliate_code?: string;
  coupon_code?: string;
  terms_accepted: boolean;
}

export interface PaymentProviderOption {
  code: CheckoutPayload['payment_method'];
  label: string;
  currency: string;
  enabled: boolean;
  configured: boolean;
  reason: string;
}

export interface AffiliateProfile {
  id: number;
  code: string;
  commission_rate: string;
  status: 'pending' | 'active' | 'suspended';
  status_label: string;
  created_at: string;
}

export interface AffiliateConversion {
  id: number;
  order_code: string;
  commission_amount: number;
  status: string;
  status_label: string;
  created_at: string;
}

export interface FinancialLedgerEntry {
  id: number;
  /** Stable human reference, e.g. GKF-00000123. */
  reference: string;
  order_code: string;
  owner_type: string;
  entry_type: string;
  entry_type_label: string;
  status: string;
  status_label: string;
  amount: number;
  currency: string;
  description: string;
  created_at: string;
  available_at: string | null;
}

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

export interface VisualSearchResponse {
  request: {
    id: number;
    target: string;
    status: string;
    status_label: string;
    result_payload: Record<string, unknown>;
    created_at: string;
  };
  message: string;
}

export interface ServiceRequestPayload {
  service_type: 'agronomy' | 'irrigation' | 'soil' | 'greenhouse' | 'machinery' | 'other';
  customer_name: string;
  phone: string;
  province: string;
  city: string;
  crop?: string;
  farm_area_hectare?: number;
  description: string;
}

export interface ProcurementRequestPayload {
  farmer_name: string;
  phone: string;
  crop_name: string;
  variety?: string;
  quantity: number;
  unit?: string;
  requested_price?: number;
  province: string;
  city: string;
  harvest_date?: string;
  description?: string;
}

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
  status: string;
  status_label: string;
  is_purchasable: boolean;
  discount_percent: number;
  sales_count: number;
  discounted_price: number;
  rejection_reason: string;
  reviewed_at: string | null;
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

export interface StorefrontMessage {
  id: number;
  conversation: number;
  sender: number;
  sender_name: string;
  is_mine: boolean;
  body: string;
  listing: AttachedListing | null;
  is_read: boolean;
  created_at: string;
}

export interface StorefrontConversation {
  id: number;
  storefront: Storefront;
  counterpart_name: string;
  last_message: StorefrontMessage | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

// ========================================
// Farm profile: lands, calendars and consultation
// ========================================

export type LandType = 'orchard' | 'farmland' | 'greenhouse';
export type FarmEventKind = 'spraying' | 'fertilizing' | 'irrigation';

export interface FarmLand {
  id: number;
  owner: number;
  owner_name: string;
  name: string;
  land_type: LandType;
  land_type_label: string;
  area: string;
  area_unit: string;
  area_unit_label: string;
  area_label: string;
  crop_type: string;
  crop_variety: string;
  province: string;
  city: string;
  soil_type: string;
  soil_type_label: string;
  irrigation_type: string;
  irrigation_type_label: string;
  planting_date: string | null;
  notes: string;
  is_active: boolean;
  event_count: number;
  created_at: string;
  updated_at: string;
}

export interface FarmCalendarEvent {
  id: number;
  land: number;
  land_name: string;
  kind: FarmEventKind;
  kind_label: string;
  title: string;
  date: string;
  notes: string;
  status: 'planned' | 'done' | 'cancelled';
  status_label: string;
  created_by: number;
  created_by_name: string;
  is_consultant_note: boolean;
  created_at: string;
  updated_at: string;
}

export interface FarmConsultationRequest {
  id: number;
  farmer: number;
  farmer_name: string;
  farmer_username: string;
  land: FarmLand;
  land_id?: number;
  subject: string;
  subject_label: string;
  message: string;
  reply: string;
  status: 'pending' | 'answered' | 'closed';
  status_label: string;
  replied_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultantFarmerSummary {
  id: number;
  username: string;
  full_name: string;
  phone: string;
  lands: FarmLand[];
  land_count: number;
  pending_requests: number;
}

export interface ConsultantFarmerDossier {
  farmer: {
    id: number;
    username: string;
    full_name: string;
    email: string;
    phone: string;
    address: string;
    level_label: string;
  };
  lands: (FarmLand & { events: FarmCalendarEvent[] })[];
  requests: FarmConsultationRequest[];
}

// ========================================
// Geography and agricultural reference data
// ========================================

export interface Location {
  id: number;
  name: string;
  slug: string;
  kind: 'province' | 'city';
  parent: number | null;
  province_name: string;
}

export interface AgriInputDose {
  id: number;
  crop_name: string;
  target: string;
  basis: 'per_hectare' | 'per_1000_liter';
  basis_label: string;
  min_rate: string;
  max_rate: string;
  rate_unit: string;
  notes: string;
}

export interface AgriInput {
  id: number;
  name: string;
  slug: string;
  kind: 'fertilizer' | 'pesticide';
  kind_label: string;
  active_ingredient: string;
  formulation: string;
  unit: string;
  product: number | null;
  product_slug: string;
  safety_notes: string;
  preharvest_interval_days: number | null;
  doses: AgriInputDose[];
}

export type AreaUnit = 'hectare' | 'jarib' | 'square_meter' | 'acre';

export interface DoseCalculation {
  input: { id: number; name: string; kind: string };
  crop: string;
  target: string;
  area: { value: string; unit: AreaUnit; unit_label: string; hectares: string };
  rate: { min: string; max: string; unit: string; basis: string; basis_label: string };
  total: { min: string; max: string; unit: string };
  notes: string;
  warnings: string[];
}

export interface Coupon {
  id: number;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount_amount: number | null;
  min_order_amount: number;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
}

export interface WalletTransaction {
  id: number;
  order: number | null;
  amount: number;
  transaction_type: string;
  type_label: string;
  status: string;
  status_label: string;
  description: string;
  created_at: string;
  available_at: string | null;
}

export interface Wallet {
  id: number;
  currency: string;
  balance: number;
  updated_at: string;
  transactions: WalletTransaction[];
}

export interface StorefrontPost {
  id: number;
  storefront: number;
  storefront_name: string;
  storefront_slug: string;
  storefront_avatar_url: string;
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
}

// ========================================
// Helper Types
// ========================================

export type SortOption = 'popular' | 'cheapest' | 'expensive';

export interface ProductQueryParams {
  page?: number;
  page_size?: number;
  category?: string;
  search?: string;
  ordering?: string;
  is_featured?: boolean;
  available?: boolean;
  in_stock?: boolean;
  has_discount?: boolean;
  min_price?: number;
  max_price?: number;
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
