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
  category_slug: string | null;
  subcategory_slug: string | null;
  price: number;
  stock: number;
  available: boolean;
  is_featured: boolean;
  image: string | null;
  image_url: string;
  is_in_stock: boolean;
  short_description: string;
  reviews_count: number;
}

// ========================================
// MockProduct (برای کامپوننت‌های فرانت‌اند)
// ========================================
// ✅ این interface برای داده‌های استاتیک در shopData.ts و تبدیل API به فرمت UI استفاده می‌شود

export interface MockProduct {
  id: number;
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
// Helper Types
// ========================================

export type SortOption = 'popular' | 'cheapest' | 'expensive' | 'rating';

export interface ProductQueryParams {
  page?: number;
  category?: string;
  subcategory?: string;
  search?: string;
  ordering?: string;
  is_featured?: boolean;
  available?: boolean;
  in_stock?: boolean;
  min_price?: number;
  max_price?: number;
}
