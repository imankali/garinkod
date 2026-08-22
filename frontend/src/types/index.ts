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

export interface CartItem {
  id: number;
  product: ProductList;
  quantity: number;
  total_price: number;
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

export interface UserAccount {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  gender: 'male' | 'female';
  address: string;
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
  token: string;
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
  product: number | null;
  product_title: string;
  product_slug: string;
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
  payment_method: 'coordination';
  terms_accepted: boolean;
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

export interface Storefront {
  id: number;
  name: string;
  slug: string;
  seller_type: 'farmer' | 'cooperative' | 'merchant' | 'company';
  bio: string;
  province: string;
  city: string;
  is_verified: boolean;
  commission_rate: string;
  owner_name: string;
  created_at: string;
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
  harvest_date: string | null;
  image: string | null;
  image_url: string;
  status: string;
  status_label: string;
  created_at: string;
  updated_at: string;
}

// ========================================
// Helper Types
// ========================================

export type SortOption = 'popular' | 'cheapest' | 'expensive';

export interface ProductQueryParams {
  page?: number;
  category?: string;
  search?: string;
  ordering?: string;
  is_featured?: boolean;
  available?: boolean;
  in_stock?: boolean;
  min_price?: number;
  max_price?: number;
}