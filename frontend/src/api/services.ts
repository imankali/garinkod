// frontend/src/api/services.ts

import apiClient from './client';
import type {
  Product,
  ProductList,
  Category,
  Cart,
  Comment,
  PaginatedResponse,
  AuthResponse,
  ProfileResponse,
  ProductQueryParams,
  Order,
  CheckoutPayload,
  ServiceRequestPayload,
  ProcurementRequestPayload,
  Storefront,
  MarketplaceListing,
  PaymentProviderOption,
  AffiliateProfile,
  AffiliateConversion,
  FinancialLedgerEntry,
  PlatformFeedbackPayload,
  StorefrontComplaintPayload,
  VisualSearchResponse,
  Coupon,
  Wallet,
  StorefrontPost,
  ManagementDashboard,
  ManagementStaffMember,
  ManagementAuditLog,
  Location,
  AgriInput,
  DoseCalculation,
  AreaUnit,
  StorefrontProfile,
  StorefrontAvailability,
  StorefrontHighlight,
  FollowedStorefront,
  UserAccount,
} from '../types';

// ========================================
// Products API
// ========================================
export const productsApi = {
  /**
   * دریافت لیست محصولات (paginated)
   * GET /api/products/
   */
  getAll: (params?: ProductQueryParams) => {
    return apiClient.get<PaginatedResponse<ProductList>>('/products/', { params });
  },

  /**
   * دریافت جزئیات یک محصول بر اساس slug
   * GET /api/products/{slug}/
   */
  getBySlug: (slug: string) => {
    return apiClient.get<Product>(`/products/${slug}/`);
  },

  getSimilar: (slug: string) => {
    return apiClient.get<ProductList[]>(`/products/${slug}/similar/`);
  },

  /**
   * دریافت محصولات ویژه
   * GET /api/products/featured/
   */
  getFeatured: () => {
    return apiClient.get<ProductList[]>('/products/featured/');
  },

  /**
   * دریافت محصولات بر اساس دسته‌بندی
   * GET /api/products/by_category/?category=slug
   */
  getByCategory: (categorySlug: string) => {
    return apiClient.get<ProductList[]>('/products/by_category/', {
      params: { category: categorySlug },
    });
  },
};

// ========================================
// Categories API
// ========================================
export const categoriesApi = {
  /**
   * دریافت لیست دسته‌بندی‌ها
   * GET /api/categories/
   */
  getAll: () => {
    return apiClient.get<PaginatedResponse<Category>>('/categories/');
  },

  /**
   * دریافت جزئیات یک دسته‌بندی بر اساس slug
   * GET /api/categories/{slug}/
   */
  getBySlug: (slug: string) => {
    return apiClient.get<Category>(`/categories/${slug}/`);
  },
};

// ========================================
// Comments API
// ========================================
export const commentsApi = {
  /**
   * دریافت لیست نظرات
   * GET /api/comments/
   */
  getAll: () => {
    return apiClient.get<PaginatedResponse<Comment>>('/comments/');
  },

  /**
   * ثبت نظر جدید
   * POST /api/comments/
   */
  create: (data: { product: number; name: string; email?: string; body: string; parent?: number | null; sticker?: string; image?: File | null }) => {
    if (data.image) {
      const formData = new FormData();
      formData.append('product', String(data.product));
      formData.append('name', data.name);
      formData.append('body', data.body);
      if (data.email) formData.append('email', data.email);
      if (data.parent) formData.append('parent', String(data.parent));
      if (data.sticker) formData.append('sticker', data.sticker);
      formData.append('image', data.image);
      return apiClient.post<Comment>('/comments/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return apiClient.post<Comment>('/comments/', data);
  },

  /**
   * دریافت نظرات یک محصول
   * GET /api/comments/by_product/?product=slug
   */
  getByProduct: (productSlug: string) => {
    return apiClient.get<Comment[]>('/comments/by_product/', {
      params: { product: productSlug },
    });
  },
};

// ========================================
// Cart API
// ========================================
export const cartApi = {
  /**
   * دریافت سبد خرید
   * GET /api/cart/
   */
  get: () => {
    return apiClient.get<Cart>('/cart/');
  },

  /**
   * افزودن محصول به سبد خرید
   * POST /api/cart/add/
   */
  add: (productId: number, quantity: number = 1) => {
    return apiClient.post<Cart>('/cart/add/', { product_id: productId, quantity });
  },

  /**
   * افزودن آگهی غرفه به سبد خرید
   * POST /api/cart/add-listing/
   * تعداد باید بین حداقل سفارش و موجودی آگهی باشد.
   */
  addListing: (listingId: number, quantity?: number) => {
    return apiClient.post<Cart>('/cart/add-listing/', {
      listing_id: listingId,
      ...(quantity !== undefined ? { quantity } : {}),
    });
  },

  /**
   * حذف محصول از سبد خرید
   * POST /api/cart/remove/
   */
  remove: (itemId: number) => {
    return apiClient.post<Cart>('/cart/remove/', { item_id: itemId });
  },

  /**
   * به‌روزرسانی تعداد محصول در سبد
   * POST /api/cart/update_quantity/
   */
  updateQuantity: (itemId: number, quantity: number) => {
    return apiClient.post<Cart>('/cart/update_quantity/', {
      item_id: itemId,
      quantity,
    });
  },
};

// ========================================
// Auth API
// ========================================
export const authApi = {
  /**
   * ورود کاربر
   * POST /api/auth/login/
   */
  login: (username: string, password: string) => {
    return apiClient.post<AuthResponse>('/auth/login/', {
      username,
      password,
    });
  },

  /**
   * ثبت‌نام کاربر
   * POST /api/auth/register/
   */
  register: (data: {
    username: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    password: string;
    password2: string;
    phone?: string;
    gender?: 'male' | 'female';
    address?: string;
  }) => {
    return apiClient.post<AuthResponse>('/auth/register/', data);
  },

  /**
   * خروج کاربر
   * POST /api/auth/logout/
   */
  logout: () => {
    return apiClient.post<{ message: string }>('/auth/logout/');
  },

  session: () => apiClient.get<ProfileResponse>('/auth/session/'),

  /**
   * دریافت پروفایل کاربر
   * GET /api/profile/
   */
  getProfile: () => {
    return apiClient.get<ProfileResponse>('/profile/');
  },

  /**
   * به‌روزرسانی پروفایل کاربر
   * PUT/PATCH /api/profile/
   */
  updateProfile: (data: Partial<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    gender: 'male' | 'female';
    address: string;
  }>) => {
    return apiClient.patch<ProfileResponse>('/profile/', data);
  },
};

// ========================================
// Orders — interim expert-coordination checkout
// ========================================
export const ordersApi = {
  checkout: (data: CheckoutPayload) =>
    apiClient.post<{ order: Order; message: string }>('/orders/checkout/', data),
  lookup: (code: string, phone: string) =>
    apiClient.get<Order>('/orders/lookup/', { params: { code, phone } }),
  cancel: (code: string, phone: string) =>
    apiClient.post<{ order: Order; message: string }>('/orders/cancel/', { code, phone }),
  mine: () => apiClient.get<Order[]>('/orders/mine/'),
};

// ========================================
// Agriculture services, procurement and marketplace
// ========================================
export const agricultureApi = {
  requestService: (data: ServiceRequestPayload) => apiClient.post('/services/requests/', data),
  requestProcurement: (data: ProcurementRequestPayload) => apiClient.post('/procurement/requests/', data),
  getStorefront: () => apiClient.get<Storefront | null>('/marketplace/storefront/'),
  createStorefront: (data: Pick<Storefront, 'name' | 'slug' | 'seller_type' | 'bio' | 'province' | 'city'>) =>
    apiClient.post<Storefront>('/marketplace/storefront/', data),
  updateStorefront: (data: Partial<Storefront>) =>
    apiClient.patch<Storefront>('/marketplace/storefront/', data),

  /** بررسی زنده آزاد بودن نام و آدرس غرفه هنگام تایپ */
  checkStorefrontAvailability: (params: { name?: string; slug?: string }) =>
    apiClient.get<StorefrontAvailability>('/marketplace/storefront/availability/', { params }),

  listMarketplace: (params?: MarketplaceQueryParams) =>
    apiClient.get<PaginatedResponse<MarketplaceListing>>('/marketplace/listings/', { params }),
  getListing: (slug: string) =>
    apiClient.get<MarketplaceListing>(`/marketplace/listings/${slug}/`),
  myListings: () => apiClient.get<MarketplaceListing[]>('/marketplace/listings/mine/'),
  createListing: (data: Partial<MarketplaceListing>) =>
    apiClient.post<MarketplaceListing>('/marketplace/listings/', data),
};

/** فیلترهای سمت سرور برای بازار غرفه‌داران */
export interface MarketplaceQueryParams {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
  province?: string;
  city?: string;
  seller_type?: string;
  storefront?: string;
  crop?: string;
  unit?: string;
  verified?: string;
  in_stock?: string;
  min_price?: string;
  max_price?: string;
  min_quantity?: string;
}

/** فیلترهای فهرست غرفه‌داران */
export interface StorefrontQueryParams {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
  province?: string;
  city?: string;
  seller_type?: string;
  verified?: string;
  has_listings?: string;
}

// ========================================
// Public storefront pages, following and highlights
// ========================================
export const storefrontsApi = {
  list: (params?: StorefrontQueryParams) =>
    apiClient.get<PaginatedResponse<Storefront>>('/marketplace/storefronts/', { params }),
  featured: (limit = 5) =>
    apiClient.get<Storefront[]>('/marketplace/storefronts/featured/', { params: { limit } }),
  profile: (slug: string) =>
    apiClient.get<StorefrontProfile>(`/marketplace/storefronts/${slug}/profile/`),
  follow: (slug: string) =>
    apiClient.post<{ is_following: boolean; followers_count: number }>(
      `/marketplace/storefronts/${slug}/follow/`,
    ),
  unfollow: (slug: string) =>
    apiClient.delete<{ is_following: boolean; followers_count: number }>(
      `/marketplace/storefronts/${slug}/follow/`,
    ),
  following: () =>
    apiClient.get<{ count: number; results: FollowedStorefront[] }>('/marketplace/following/'),

  highlights: (storefrontSlug: string) =>
    apiClient.get<PaginatedResponse<StorefrontHighlight> | StorefrontHighlight[]>(
      '/marketplace/highlights/',
      { params: { storefront: storefrontSlug } },
    ),
  createHighlight: (data: { title: string; post_ids: number[] }) =>
    apiClient.post<StorefrontHighlight>('/marketplace/highlights/', data),
  updateHighlight: (id: number, data: { title?: string; post_ids?: number[] }) =>
    apiClient.patch<StorefrontHighlight>(`/marketplace/highlights/${id}/`, data),
  deleteHighlight: (id: number) => apiClient.delete(`/marketplace/highlights/${id}/`),
};

// ========================================
// Reference data: geography and agri inputs
// ========================================
export const locationsApi = {
  /** بدون پارامتر: فهرست استان‌ها */
  provinces: () => apiClient.get<{ count: number; results: Location[] }>('/locations/'),
  /** شهرهای یک استان */
  cities: (province: string) =>
    apiClient.get<{ count: number; results: Location[] }>('/locations/', { params: { province } }),
  search: (search: string) =>
    apiClient.get<{ count: number; results: Location[] }>('/locations/', { params: { search } }),
};

export const agriApi = {
  inputs: (params?: { search?: string; kind?: 'fertilizer' | 'pesticide'; crop?: string }) =>
    apiClient.get<{ count: number; results: AgriInput[] }>('/agri/inputs/', { params }),
  crops: () => apiClient.get<{ results: string[] }>('/agri/crops/'),
  calculate: (data: { input_id: number; crop: string; area: number; area_unit: AreaUnit }) =>
    apiClient.post<DoseCalculation>('/agri/calculate/', data),
};
// ========================================
// Payment readiness, affiliate, finance and trust
// ========================================
export const paymentsApi = {
  options: () => apiClient.get<{ providers: PaymentProviderOption[] }>('/payments/options/'),
};

export const affiliateApi = {
  me: () => apiClient.get<{ profile: AffiliateProfile | null; conversions: AffiliateConversion[]; ledger: FinancialLedgerEntry[] }>('/affiliate/me/'),
  join: () => apiClient.post<{ profile: AffiliateProfile; message: string }>('/affiliate/me/'),
};

export const financeApi = {
  storefront: () => apiClient.get<{ storefront: Storefront; balances: Record<string, number>; entries: FinancialLedgerEntry[]; notice: string }>('/marketplace/finance/'),
};

export const trustApi = {
  feedback: (data: PlatformFeedbackPayload) => apiClient.post('/feedback/', data),
  complaint: (data: StorefrontComplaintPayload) => apiClient.post('/complaints/storefront/', data),
  visualSearch: (image: File, target: 'product' | 'pest' = 'product') => {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('target', target);
    return apiClient.post<VisualSearchResponse>('/visual-search/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const rewardsApi = {
  myCoupons: () => apiClient.get<Coupon[]>('/rewards/me/'),
  wallet: () => apiClient.get<Wallet>('/wallet/me/'),
};

export const storefrontPostsApi = {
  list: (params?: { post_type?: 'post' | 'story' }) =>
    apiClient.get<PaginatedResponse<StorefrontPost>>('/marketplace/posts/', { params }),
  mine: () => apiClient.get<StorefrontPost[]>('/marketplace/posts/mine/'),
  create: (data: { post_type: 'post' | 'story'; caption: string; listing?: number; image?: File | null }) => {
    const formData = new FormData();
    formData.append('post_type', data.post_type);
    formData.append('caption', data.caption);
    if (data.listing) formData.append('listing', String(data.listing));
    if (data.image) formData.append('image', data.image);
    return apiClient.post<StorefrontPost>('/marketplace/posts/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const managementApi = {
  dashboard: () => apiClient.get<ManagementDashboard>('/management/dashboard/'),
  staff: () => apiClient.get<{ roles: string[]; staff: ManagementStaffMember[] }>('/management/staff/'),
  updateStaff: (username: string, groups: string[], isActive: boolean) =>
    apiClient.patch<{ username: string; groups: string[]; is_active: boolean }>('/management/staff/', { username, groups, is_active: isActive }),
  audit: () => apiClient.get<ManagementAuditLog[]>('/management/audit/'),
  markOrderPaid: (code: string) => apiClient.post(`/management/orders/${code}/mark-paid/`),
  moderate: (type: 'comment' | 'post' | 'listing', id: number, status: string, reason?: string) =>
    apiClient.post(`/management/moderate/${type}/${id}/`, { status, reason }),
  bulkModerate: (contentType: 'listing' | 'post' | 'comment', ids: number[], status: string, reason?: string) =>
    apiClient.post<{ updated: number; status: string }>('/management/moderation/bulk/', {
      content_type: contentType,
      ids,
      status,
      reason,
    }),
  moderationQueue: (params?: {
    type?: string;
    status?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) =>
    apiClient.get<{
      count: number;
      page: number;
      page_size: number;
      total_pages: number;
      results: ModerationQueueRow[];
    }>('/management/moderation/queue/', { params }),
  users: (params?: { search?: string; level?: string; page?: number; page_size?: number }) =>
    apiClient.get<{
      count: number;
      page: number;
      page_size: number;
      total_pages: number;
      levels: { value: number; label: string }[];
      results: ManagedUser[];
    }>('/management/users/', { params }),
  updateUser: (username: string, data: { level?: number; is_active?: boolean }) =>
    apiClient.patch<{ username: string; level: number; is_active: boolean; is_staff: boolean }>(
      '/management/users/',
      { username, ...data },
    ),
};

/** یک ردیف در صف بررسی مدیریت (آگهی، پست، کامنت، بازخورد یا شکایت) */
export interface ModerationQueueRow {
  type: 'listing' | 'post' | 'comment' | 'feedback' | 'complaint';
  id: number;
  title: string;
  excerpt: string;
  status: string;
  status_label: string;
  storefront: string;
  storefront_slug: string;
  image_url: string;
  rejection_reason: string;
  created_at: string;
}

export interface ManagedUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  level: number;
  level_label: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  groups: string[];
  date_joined: string;
}

// ========================================
// Profile avatar
// ========================================
export const avatarApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiClient.post<UserAccount>('/profile/avatar/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  remove: () => apiClient.delete<UserAccount>('/profile/avatar/'),
};
