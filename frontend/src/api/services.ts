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
  StorefrontPostComment,
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
  StorefrontConversation,
  StorefrontMessage,
  MessageChannel,
  InboxResponse,
  FarmLand,
  FarmCalendarEvent,
  FarmConsultationRequest,
  ConsultantFarmerSummary,
  ConsultantFarmerDossier,
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
  updateStorefront: (data: Partial<Storefront> | FormData) =>
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
  /** Owner edits one of their own آگهی‌ها; the viewset scopes writes to them. */
  updateListing: (slug: string, data: Partial<MarketplaceListing>) =>
    apiClient.patch<MarketplaceListing>(`/marketplace/listings/${slug}/`, data),
  deleteListing: (slug: string) => apiClient.delete(`/marketplace/listings/${slug}/`),
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

  /** جستجو داخل پست‌ها و استوری‌های یک غرفه (مثلاً «اصلاح درخت»). */
  searchContent: (slug: string, query: string) =>
    apiClient.get<{ query: string; posts: StorefrontPost[]; stories: StorefrontPost[] }>(
      `/marketplace/storefronts/${slug}/search-content/`,
      { params: { q: query } },
    ),
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

export interface LedgerQueryParams {
  status?: string;
  entry_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export const financeApi = {
  storefront: (params?: LedgerQueryParams) =>
    apiClient.get<{
      storefront: Storefront;
      balances: Record<string, number>;
      entries: FinancialLedgerEntry[];
      entry_types: { value: string; label: string }[];
      statuses: { value: string; label: string }[];
      count: number;
      page: number;
      total_pages: number;
      notice: string;
    }>('/marketplace/finance/', { params }),

  /** Download the ledger as CSV; the response is a blob, not JSON. */
  exportLedger: (params?: Omit<LedgerQueryParams, 'page' | 'page_size'>) =>
    apiClient.get('/marketplace/finance/export/', { params, responseType: 'blob' }),
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

// ========================================
// Direct messages (DM) between buyers and storefronts
// ========================================
export const messagesApi = {
  /** The caller's whole inbox, optionally narrowed to one channel. */
  conversations: (channel?: MessageChannel) =>
    apiClient.get<InboxResponse>('/marketplace/conversations/', {
      params: channel ? { channel } : undefined,
    }),

  /** Open (or fetch) the caller's thread with a service desk. */
  openServiceConversation: (channel: Exclude<MessageChannel, 'storefront'>) =>
    apiClient.post<StorefrontConversation>(`/marketplace/conversations/service/${channel}/`),

  /** A consultant starts the consulting thread with one farmer. */
  openFarmerConversation: (userId: number) =>
    apiClient.post<StorefrontConversation>(`/marketplace/conversations/farmer/${userId}/`),

  /** Get or create the caller's private thread with one storefront. */
  openStorefrontConversation: (storefrontSlug: string) =>
    apiClient.post<StorefrontConversation>(
      `/marketplace/storefronts/${storefrontSlug}/conversation/`,
    ),

  getStorefrontConversation: (storefrontSlug: string) =>
    apiClient.get<StorefrontConversation | null>(
      `/marketplace/storefronts/${storefrontSlug}/conversation/`,
    ),

  /** Messages of one conversation, oldest first. Reading marks them as seen. */
  messages: (conversationId: number, page = 1) =>
    apiClient.get<PaginatedResponse<StorefrontMessage> & { conversation: StorefrontConversation }>(
      `/marketplace/conversations/${conversationId}/messages/`,
      { params: { page } },
    ),

  /** Send a message: text, a listing card, and/or one media attachment. */
  send: (
    conversationId: number,
    data: {
      body?: string;
      listing?: number;
      attachment?: Blob | null;
      attachmentName?: string;
      attachmentDuration?: number;
    },
  ) => {
    const url = `/marketplace/conversations/${conversationId}/messages/`;
    if (!data.attachment) {
      return apiClient.post<StorefrontMessage>(url, {
        body: data.body,
        listing: data.listing,
      });
    }
    // A media message goes as multipart; the request interceptor drops the
    // JSON content-type so the browser can add the multipart boundary.
    const formData = new FormData();
    if (data.body) formData.append('body', data.body);
    if (data.listing) formData.append('listing', String(data.listing));
    formData.append('attachment', data.attachment, data.attachmentName || 'attachment');
    if (data.attachmentDuration !== undefined) {
      formData.append('attachment_duration', String(Math.round(data.attachmentDuration)));
    }
    return apiClient.post<StorefrontMessage>(url, formData);
  },
};

// ========================================
// Farm profile: lands, calendars and consultation
// ========================================
export interface FarmLandPayload {
  name: string;
  land_type: FarmLand['land_type'];
  area: string;
  area_unit?: string;
  crop_type: string;
  crop_variety?: string;
  province?: string;
  city?: string;
  soil_type?: string;
  irrigation_type?: string;
  planting_date?: string | null;
  notes?: string;
}

export interface FarmEventPayload {
  kind: FarmCalendarEvent['kind'];
  title: string;
  date: string;
  notes?: string;
  status?: FarmCalendarEvent['status'];
}

export const farmApi = {
  /** All of the caller's lands (orchards / croplands / greenhouses). */
  lands: () => apiClient.get<FarmLand[]>('/farm/lands/'),
  createLand: (data: FarmLandPayload) => apiClient.post<FarmLand>('/farm/lands/', data),
  landDetail: (landId: number) =>
    apiClient.get<{ land: FarmLand; events: FarmCalendarEvent[] }>(`/farm/lands/${landId}/`),
  updateLand: (landId: number, data: Partial<FarmLandPayload>) =>
    apiClient.patch<FarmLand>(`/farm/lands/${landId}/`, data),
  deleteLand: (landId: number) => apiClient.delete<{ message: string }>(`/farm/lands/${landId}/`),

  /** Add an entry to one of the caller's own land calendars. */
  addEvent: (landId: number, data: FarmEventPayload) =>
    apiClient.post<FarmCalendarEvent>(`/farm/lands/${landId}/events/`, data),
  updateEvent: (eventId: number, data: Partial<FarmEventPayload>) =>
    apiClient.patch<FarmCalendarEvent>(`/farm/events/${eventId}/`, data),
  deleteEvent: (eventId: number) => apiClient.delete<{ message: string }>(`/farm/events/${eventId}/`),

  /** The caller's whole calendar, optionally filtered. */
  calendar: (params?: { kind?: FarmCalendarEvent['kind']; from?: string; to?: string }) =>
    apiClient.get<FarmCalendarEvent[]>('/farm/calendar/', { params }),

  /** The caller's consultation requests, or file a new one for a land. */
  consultations: () => apiClient.get<FarmConsultationRequest[]>('/farm/consultations/'),
  createConsultation: (data: { land_id: number; subject: string; message: string }) =>
    apiClient.post<FarmConsultationRequest>('/farm/consultations/', data),
};

export const consultingApi = {
  /** Consultant queue (level 3+): all requests, filterable. */
  requests: (params?: { status?: string; search?: string }) =>
    apiClient.get<FarmConsultationRequest[]>('/farm/consulting/requests/', { params }),
  reply: (consultationId: number, data: { reply: string; status?: string }) =>
    apiClient.patch<FarmConsultationRequest>(
      `/farm/consulting/requests/${consultationId}/reply/`, data,
    ),

  /** Farmer directory with lands and pending counts. */
  farmers: (params?: { search?: string }) =>
    apiClient.get<{ count: number; results: ConsultantFarmerSummary[] }>(
      '/farm/consulting/farmers/', { params },
    ),

  /** One farmer's full dossier: profile, lands with calendars, requests. */
  dossier: (userId: number) =>
    apiClient.get<ConsultantFarmerDossier>(`/farm/consulting/farmers/${userId}/`),

  /** Write a spraying/fertilizing/irrigation entry into any land's calendar. */
  addEvent: (landId: number, data: FarmEventPayload) =>
    apiClient.post<FarmCalendarEvent>(`/farm/consulting/lands/${landId}/events/`, data),
};

export const storefrontPostsApi = {
  list: (params?: { post_type?: 'post' | 'story'; storefront?: number; page?: number }) =>
    apiClient.get<PaginatedResponse<StorefrontPost>>('/marketplace/posts/', { params }),
  mine: () => apiClient.get<StorefrontPost[]>('/marketplace/posts/mine/'),

  create: (data: {
    post_type: 'post' | 'story';
    caption: string;
    listing?: number;
    image?: File | null;
  }) => {
    const formData = new FormData();
    formData.append('post_type', data.post_type);
    formData.append('caption', data.caption);
    if (data.listing) formData.append('listing', String(data.listing));
    if (data.image) formData.append('image', data.image);
    return apiClient.post<StorefrontPost>('/marketplace/posts/', formData);
  },

  /** Owner edits their own post; the revision re-enters moderation. */
  update: (id: number, data: { caption?: string; listing?: number | null; image?: File | null }) => {
    const formData = new FormData();
    if (data.caption !== undefined) formData.append('caption', data.caption);
    if (data.listing !== undefined && data.listing !== null) {
      formData.append('listing', String(data.listing));
    }
    if (data.image) formData.append('image', data.image);
    return apiClient.patch<StorefrontPost>(`/marketplace/posts/${id}/`, formData);
  },

  remove: (id: number) => apiClient.delete(`/marketplace/posts/${id}/`),

  // --- Instagram-style social actions ---
  like: (id: number) =>
    apiClient.post<{ is_liked: boolean; like_count: number }>(`/marketplace/posts/${id}/like/`),
  unlike: (id: number) =>
    apiClient.delete<{ is_liked: boolean; like_count: number }>(`/marketplace/posts/${id}/like/`),
  /** Mark a story as watched so its ring turns grey. */
  markSeen: (id: number) => apiClient.post<{ is_seen: boolean }>(`/marketplace/posts/${id}/seen/`),

  comments: (id: number) =>
    apiClient.get<{ count: number; results: StorefrontPostComment[] }>(
      `/marketplace/posts/${id}/comments/`,
    ),
  addComment: (id: number, body: string, parent?: number) =>
    apiClient.post<StorefrontPostComment>(`/marketplace/posts/${id}/comments/`, { body, parent }),
  updateComment: (commentId: number, body: string) =>
    apiClient.patch<StorefrontPostComment>(`/marketplace/post-comments/${commentId}/`, { body }),
  deleteComment: (commentId: number) =>
    apiClient.delete(`/marketplace/post-comments/${commentId}/`),
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
