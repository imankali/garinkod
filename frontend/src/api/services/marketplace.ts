// frontend/src/api/services/marketplace.ts
// Marketplace and storefront endpoints.
//
// Keeping one bounded API surface per domain prevents the client layer
// from becoming a second monolith as new capabilities are added.

import apiClient from '../client';
import type { PaginatedResponse } from '@/types/common';
import type { ProductFacets } from '@/types/shop';
import type { ServiceRequestPayload, ServiceRequestResult, ProcurementRequestPayload } from '@/types/commerce';
import type { Storefront, MarketplaceListing, StorefrontPost, StorefrontPostComment, StorefrontProfile, StorefrontAvailability, StorefrontHighlight, FollowedStorefront } from '@/types/storefront';

export const agricultureApi = {
  requestService: (data: ServiceRequestPayload) =>
    apiClient.post<ServiceRequestResult>('/services/requests/', data),
  requestProcurement: (data: ProcurementRequestPayload) => apiClient.post('/procurement/requests/', data),
  getStorefront: () => apiClient.get<Storefront | null>('/marketplace/storefront/'),
  /**
   * ساخت غرفه. نام و نام خانوادگی و کد ملی در همین فرم گرفته می‌شوند و روی
   * حساب کاربر ذخیره می‌شوند؛ بدون آن‌ها سرور ۴۰۰ می‌دهد، چون غرفه‌ای که
   * کسی پشتش نباشد قابل پیگیری نیست.
   */
  createStorefront: (data: {
    name: string;
    slug?: string;
    seller_type: Storefront['seller_type'];
    bio?: string;
    province?: string;
    city?: string;
    owner_first_name: string;
    owner_last_name: string;
    national_id: string;
    card_number: string;
    rules_accepted: boolean;
  }) => apiClient.post<Storefront>('/marketplace/storefront/', data),
  updateStorefront: (data: (Partial<Storefront> & { card_number?: string }) | FormData) =>
    apiClient.patch<Storefront>('/marketplace/storefront/', data),

  /** بررسی زنده آزاد بودن نام و آدرس غرفه هنگام تایپ */
  checkStorefrontAvailability: (params: { name?: string; slug?: string }) =>
    apiClient.get<StorefrontAvailability>('/marketplace/storefront/availability/', { params }),

  listMarketplace: (params?: MarketplaceQueryParams) =>
    apiClient.get<PaginatedResponse<MarketplaceListing>>('/marketplace/listings/', { params }),

  /**
   * Facets for the آگهی‌های غرفه‌داران tab, in the same shape the catalogue's own
   * facets use — one filter bar can therefore drive both sources.
   * GET /api/marketplace/listings/facets/
   */
  listingFacets: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<ProductFacets>('/marketplace/listings/facets/', { params }),
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

export interface MarketplaceQueryParams {
  search?: string;
  /**
   * همه‌ی این محورها چندمقداری‌اند (لیست جدا‌شده با کاما): همان دستوری که
   * فیلترهای کاتالوگ محصولات می‌فرستد، تا یک نوار فیلتر برای هر دو منبع کافی باشد.
   */
  category?: string;
  subcategory?: string;
  brand?: string;
  package_size?: string;
  stock?: string;
  has_discount?: string;
  min_rating?: string;
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

export const storefrontsApi = {
  list: (params?: StorefrontQueryParams) =>
    apiClient.get<PaginatedResponse<Storefront>>('/marketplace/storefronts/', { params }),
  featured: (limit = 5) =>
    apiClient.get<Storefront[]>('/marketplace/storefronts/featured/', { params: { limit } }),
  profile: (slug: string) =>
    apiClient.get<StorefrontProfile>(`/marketplace/storefronts/${slug}/profile/`),

  /** جستجو داخل آگهی‌ها، پست‌ها و استوری‌های یک غرفه (مثلاً «اصلاح درخت»). */
  searchContent: (slug: string, query: string) =>
    apiClient.get<{ query: string; posts: StorefrontPost[]; stories: StorefrontPost[]; listings: MarketplaceListing[] }>(
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
  createHighlight: (data: { title: string; post_ids?: number[]; cover?: File | null }) => {
    const form = new FormData();
    form.append('title', data.title);
    (data.post_ids || []).forEach((id) => form.append('post_ids', String(id)));
    if (data.cover) form.append('cover', data.cover);
    return apiClient.post<StorefrontHighlight>('/marketplace/highlights/', form);
  },
  updateHighlight: (
    id: number,
    data: { title?: string; post_ids?: number[]; cover?: File | null },
  ) => {
    const form = new FormData();
    if (data.title !== undefined) form.append('title', data.title);
    if (data.post_ids !== undefined) data.post_ids.forEach((id) => form.append('post_ids', String(id)));
    if (data.cover) form.append('cover', data.cover);
    return apiClient.patch<StorefrontHighlight>(`/marketplace/highlights/${id}/`, form);
  },
  deleteHighlight: (id: number) => apiClient.delete(`/marketplace/highlights/${id}/`),

  /** آرشیو استوری‌های غرفه‌دار — منقضی و حذف‌شده‌های نرم، با شناسه هایلایت‌ها. */
  storyArchive: () =>
    apiClient.get<Array<StorefrontPost & { highlight_ids?: number[] }>>('/marketplace/posts/story_archive/'),
};

export const storefrontPostsApi = {
  list: (params?: {
    post_type?: 'post' | 'story';
    storefront?: number | string;
    page?: number;
    page_size?: number;
    /**
     * `-likes_total` is what «پست‌های غرفه‌داران» asks for: the ranking has to be
     * computed over every post on the server, not over the first page in the
     * browser, or the "top five" would just be the five most recent ones.
     */
    ordering?: '-likes_total' | '-comments_total' | '-created_at';
    /** Shuffled feed: a new mix on every page load, excluding this reader's
     *  already-served posts (server-side marks) until the pool runs dry. */
    shuffle?: boolean;
    /** Pin the shuffle so a paginated scroll keeps one coherent ordering. */
    seed?: number;
  }) => apiClient.get<PaginatedResponse<StorefrontPost>>('/marketplace/posts/', { params }),
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
  /** Record a whole served feed in one call — the storefronts page marks every
      post it just showed, and one request must not compete with page paint. */
  markManySeen: (ids: number[]) =>
    apiClient.post<{ marked: number }>('/marketplace/posts/mark_seen/', { ids }),

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
