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
  create: (data: { product: number; name: string; email?: string; body: string }) => {
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
  listMarketplace: (params?: { search?: string; ordering?: string }) =>
    apiClient.get<PaginatedResponse<MarketplaceListing>>('/marketplace/listings/', { params }),
  myListings: () => apiClient.get<MarketplaceListing[]>('/marketplace/listings/mine/'),
  createListing: (data: Partial<MarketplaceListing>) =>
    apiClient.post<MarketplaceListing>('/marketplace/listings/', data),
};