// frontend/src/api/services/catalog.ts
// Catalog and product endpoints.
//
// Keeping one bounded API surface per domain prevents the client layer
// from becoming a second monolith as new capabilities are added.

import apiClient from '../client';
import type { PaginatedResponse } from '@/types/common';
import type { Product, ProductList, Category, ProductQueryParams, ProductFacets, RatingSummary } from '@/types/shop';
import type { Comment } from '@/types/content';

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

  /**
   * Facet values (department, brand, package size, price ceiling) for the shop filters.
   * GET /api/products/facets/
   *
   * The current selection is sent along: each facet list is narrowed by every
   * filter except its own axis, which is what keeps «برندها» to the brands that
   * actually exist inside the chosen department.
   */
  getFacets: (params?: Record<string, string | number | boolean | undefined>) => {
    return apiClient.get<ProductFacets>('/products/facets/', { params });
  },
};

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

export const commentsApi = {
  /**
   * رأی مثبت (+1) یا منفی (-1) می‌دهد؛ تکرار همان رأی آن را پس می‌گیرد.
   * POST /api/comments/{id}/helpful/
   */
  toggleHelpful: (id: number, value: 1 | -1 = 1) => {
    return apiClient.post<{
      voted: boolean;
      my_value: 1 | -1 | null;
      helpful_count: number;
      up_count: number;
      down_count: number;
    }>(`/comments/${id}/helpful/`, { value });
  },

  /**
   * یک دیدگاه را برای بررسی به میز پشتیبانی می‌فرستد؛ منتشرشده را پنهان نمی‌کند.
   * POST /api/comments/{id}/report/
   */
  report: (id: number, reason?: string) => {
    return apiClient.post<{ reported: boolean }>(`/comments/${id}/report/`, { reason: reason || '' });
  },
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
  create: (data: {
    product: number;
    name: string;
    email?: string;
    body: string;
    parent?: number | null;
    sticker?: string;
    image?: File | null;
    /** 1..5 star score. Omitted for a question, which must not be averaged. */
    rating?: number | null;
  }) => {
    if (data.image) {
      const formData = new FormData();
      formData.append('product', String(data.product));
      formData.append('name', data.name);
      formData.append('body', data.body);
      if (data.email) formData.append('email', data.email);
      if (data.parent) formData.append('parent', String(data.parent));
      if (data.sticker) formData.append('sticker', data.sticker);
      if (data.rating) formData.append('rating', String(data.rating));
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

  /** Average score, review count and star histogram. GET /api/comments/rating_summary/ */
  getRatingSummary: (productSlug: string) => {
    return apiClient.get<RatingSummary>('/comments/rating_summary/', {
      params: { product: productSlug },
    });
  },
};
