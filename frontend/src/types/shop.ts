// frontend/src/types/shop.ts — domain types (split from types/index.ts)

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
  description?: string;
  seo_title?: string;
  seo_description?: string;
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

/** srcset payload built server-side by shop/image_pipeline.py — feeds <picture>. */
export interface ImageSrcset {
  avif: string;
  webp: string;
  fallback: string;
}

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
  image_srcset?: ImageSrcset | null;
  discount_percent: number;
  sales_count: number;
  discounted_price: number;
  brand: string;
  sku: string;
  gtin: string;
  seo_title: string;
  seo_description: string;
  shipping_weight_grams: number;
  shipping_length_cm: number;
  shipping_width_cm: number;
  shipping_height_cm: number;
  /** Package size as the supplier publishes it («۲۵ کیلوگرم»، «۱ تن»). */
  package_weight?: string;
  /** Quote-only line: the shop shows «تماس بگیرید» instead of a price. */
  price_on_request?: boolean;
  /** Structured specification table, detail endpoint only. */
  attributes?: ProductAttribute[];
  rating_summary?: RatingSummary;
  /** Batch dates the supplier declares; null means "not stated", never "old". */
  production_date?: string | null;
  expiry_date?: string | null;
  expiry_days_left?: number | null;
  is_expiring_soon?: boolean;
  /** Smallest quantity this line sells in (a bag, not a single kilo). */
  min_order_quantity?: number;
  /** «زیر ۵۰ کیلو از کیسه پر می‌شود» — the bulk rule for this product. */
  bulk_note?: string;
  /** Aparat/YouTube link, shown as a click-to-play card. */
  video_url?: string;
  views?: number;
  /** Address of the brand page; matched by slug so a rename cannot break it. */
  brand_slug?: string;
  tags?: TagRef[];
  /** Cover first, then the admin gallery. */
  gallery?: GalleryShot[];
  /** Purchasable packagings; one implicit row when none are declared. */
  packages?: ProductPackage[];

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
  image_srcset?: ImageSrcset | null;
  is_in_stock: boolean;
  discount_percent: number;
  sales_count: number;
  discounted_price: number;
  brand: string;
  sku: string;
  package_weight?: string;
  price_on_request?: boolean;
  /** Aggregate of approved 1-5 star reviews, computed on the server. */
  avg_rating?: number;
  reviews_count?: number;
  /** Second photo, for the hover swap; empty when the product has no gallery. */
  image_alt_url?: string;
  is_expiring_soon?: boolean;
  views?: number;
  brand_slug?: string;
  tags?: TagRef[];
}

/** A cross-category label («کود محلول‌پاشی»). */

export interface TagRef {
  id: number;
  name: string;
  slug: string;
  description?: string;
  product_count?: number;
}

export interface GalleryShot {
  url: string;
  caption: string;
  /** Present for backend-processed photos; absent in mock/demo data. */
  srcset?: ImageSrcset | null;
}

/** One purchasable packaging, priced and stocked on its own. */

export interface ProductPackage {
  id: number | null;
  label: string;
  weight_kg: number | null;
  price: number | null;
  effective_price: number;
  discounted_price: number;
  stock: number | null;
  effective_stock: number;
  min_order_quantity: number;
  bulk_note: string;
  production_date: string | null;
  expiry_date: string | null;
  expiry_days_left: number | null;
  is_in_stock: boolean;
  price_per_kg: number | null;
  is_default: boolean;
}

// ========================================
// Catalogue landing pages (category / subcategory / brand / tag)
// ========================================

export type CatalogKind = 'category' | 'subcategory' | 'brand' | 'tag';

export interface CatalogCard {
  kind: CatalogKind;
  title: string;
  slug: string;
  image_url: string;
  description: string;
  count: number;
  url: string;
}

export interface CatalogLanding {
  kind: CatalogKind;
  title: string;
  slug: string;
  description: string;
  image_url: string;
  seo_title: string;
  seo_description: string;
  breadcrumb: Array<{ title: string; url: string }>;
  /** Exactly what to send to the product list so the grid matches the page. */
  filters: Record<string, string>;
  children: CatalogCard[];
  siblings: CatalogCard[];
  count: number;
  avg_rating: number;
  facets: {
    brands: Array<{ name: string; slug: string; count: number }>;
    packages: Array<{ label: string; count: number }>;
    price: { min: number; max: number; average: number };
    has_expiring_soon: boolean;
  };
  articles: Array<{
    title: string;
    slug: string;
    kind: string;
    excerpt: string;
    reading_minutes: number;
  }>;
  partner?: { website: string; since_year: number | null } | null;
}

export interface CatalogIndex {
  categories: CatalogCard[];
  tags: CatalogCard[];
  brands: CatalogCard[];
}

/** A review picked (or simply rated) for «تجربه خرید مشتریان». */

export interface BuyerExperience {
  id: number;
  name: string;
  body: string;
  rating: number | null;
  sticker: string;
  image_url: string;
  created: string;
  helpful_count: number;
  verified_purchase: boolean;
  product: { title: string; slug: string; brand: string; image_url: string; url: string };
}

export interface BuyerExperiencesResponse {
  /** curated = editor-pinned, verified = paid buyers, open = best-rated reviews. */
  mode: 'curated' | 'verified' | 'open';
  total: number;
  items: BuyerExperience[];
}

/** What the operator declared about returns and express delivery. */

export interface SitePolicies {
  return_window_days: number | null;
  return_window_label: string;
  return_conditions: string;
  express_shipping: { enabled: boolean; fee: number };
  updated_at: string;
}

// ========================================
// Spec sheets, ratings and site content
// ========================================

/** One label/value row of the «ویژگی‌ها» table on a product or آگهی. */

export interface ProductAttribute {
  id?: number;
  label: string;
  value: string;
  order?: number;
}

export interface RatingSummary {
  average: number;
  reviews_count: number;
  /** Star bucket -> how many reviews gave that score. */
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface FacetRow {
  value: string;
  label?: string;
  count: number;
  /** Which department a subcategory belongs to, so the two pickers can agree. */
  category?: string;
}

export interface ProductFacets {
  // `label` is what the API prints where a value is free text (a brand name, a
  // package size); older responses carry only the value, so the UI falls back.
  brands: Array<{ value: string; label?: string; count: number }>;
  package_weights: Array<{ value: string; label?: string; count: number }>;
  /** Departments and sub-departments, counted over the published catalogue. */
  categories?: FacetRow[];
  subcategories?: FacetRow[];
  max_price: number;
}

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
  /** Server-built AVIF/WebP variant strings; undefined for legacy/mock data. */
  imageSrcset?: ImageSrcset | null;
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
  /**
   * Catalogue additions that a card or the quick-view needs: the real star
   * average (0 until a review is approved), the spec table and the quote-only
   * flag that replaces the price with «تماس بگیرید».
   */
  attributes?: ProductAttribute[];
  priceOnRequest?: boolean;
  packageWeight?: string;
  /** Second catalogue photo; the card cross-fades to it on hover. */
  secondImage?: string;
  /** A declared batch inside the 90-day warning window. */
  expiringSoon?: boolean;
}

// ========================================
// Cart & CartItem (مطابق با CartSerializer)
// ========================================

/** A listing as it appears inside a cart row (trimmed, no storefront tree). */

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
  brand?: string;
  /** Brand pages filter on the slug, which survives a supplier renaming its text. */
  brand_slug?: string;
  subcategory?: string;
  tag?: string;
  /** Star floor and "has reviews", both computed from the same aggregate the cards show. */
  min_rating?: number;
  has_reviews?: boolean;
  expiring_soon?: boolean;
  package_weight?: string;
  price_on_request?: boolean;
}
