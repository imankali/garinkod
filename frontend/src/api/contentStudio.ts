// frontend/src/api/contentStudio.ts
//
// The management console's content API — everything under
// /api/management/content/*.
//
// A separate module rather than another block in services.ts because this is a
// different audience: the shop endpoints serve buyers and sellers and their
// shapes are frozen by the published OpenAPI document, while these exist only
// for the console and mirror the *writable* serializers (every field of a
// product or an article, including the ones a buyer never sees).
//
// The shapes below are deliberately wide and optional-friendly: the console is
// the only consumer, and a field the serializer added last week should not be a
// type error here.

import apiClient from './client';

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SpecRow {
  label: string;
  value: string;
  order?: number;
}

export interface PackageRow {
  id?: number;
  label: string;
  weight_kg: string | number | null;
  price: number | null;
  stock: number | null;
  min_order_quantity: number | null;
  bulk_note: string;
  production_date: string | null;
  expiry_date: string | null;
  is_default: boolean;
  // Read-only, computed per package.
  effective_price?: number;
  discounted_price?: number;
  effective_stock?: number;
  price_per_kg?: number;
  is_in_stock?: boolean;
  expiry_days_left?: number;
}

export interface ProductWork {
  id: number;
  title: string;
  slug: string;
  description: string;
  category: number | null;
  category_name?: string;
  subcategory: number | null;
  subcategory_name?: string;
  brand: string;
  brand_slug?: string;
  package_weight: string;
  price: number;
  discount_percent: number;
  discounted_price?: number;
  stock: number;
  available: boolean;
  is_in_stock?: boolean;
  is_featured: boolean;
  status: 'draft' | 'published' | string;
  publish: string | null;
  price_on_request: boolean;
  sku: string;
  gtin: string;
  seo_title: string;
  seo_description: string;
  video_url: string;
  shipping_weight_grams: number | null;
  shipping_length_cm: number | null;
  shipping_width_cm: number | null;
  shipping_height_cm: number | null;
  production_date: string | null;
  expiry_date: string | null;
  expiry_days_left?: number;
  min_order_quantity: number;
  bulk_note: string;
  image: string | null;
  image_url: string;
  images?: { id: number; url: string; caption: string }[];
  gallery?: string[];
  packages?: PackageRow[];
  attributes?: SpecRow[];
  tags?: { id: number; name: string; slug: string }[];
  tag_names?: string[];
  views?: number;
  sales_count?: number;
  author?: number;
  author_name?: string;
  created?: string;
  updated?: string;
}

export interface ArticleWork {
  id: number;
  title: string;
  slug: string;
  kind: string;
  excerpt: string;
  body: string;
  cover: string | null;
  cover_url: string;
  url?: string;
  crop: string;
  author?: number;
  author_name?: string;
  products: number[];
  listings: number[];
  related_articles: number[];
  linked_products?: { id: number; title: string; slug: string }[];
  linked_listings?: { id: number; title: string; slug: string }[];
  reading_minutes: number;
  views?: number;
  is_published: boolean;
  published_at: string | null;
  is_featured: boolean;
  seo_title: string;
  seo_description: string;
  created_at?: string;
  updated_at?: string;
}

export interface TaxonomyCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image?: string | null;
  seo_title?: string;
  seo_description?: string;
  /** Departments only the marketplace trades in (produce, livestock). */
  storefront_only?: boolean;
  subcategories?: TaxonomySubCategory[];
  product_count?: number;
}

export interface TaxonomySubCategory {
  id: number;
  name: string;
  slug: string;
  category: number;
  category_name?: string;
  product_count?: number;
  ad_count?: number;
}

export interface TaxonomyTag {
  id: number;
  name: string;
  slug: string;
}

export interface StudioOptions {
  categories: TaxonomyCategory[];
  brands: { brand: string; slug: string; count: number }[];
  tags: TaxonomyTag[];
  crops: { crop: string; article_count: number }[];
  product_statuses: Record<string, string>;
  article_kinds: Record<string, string>;
  spec_template: string[];
}

export interface ProductListParams {
  search?: string;
  ordering?: string;
  status?: string;
  category?: number | string;
  brand?: string;
  low_stock?: 1;
  unfiled?: 1;
  page?: number;
  page_size?: number;
}

export interface ArticleListParams {
  search?: string;
  ordering?: string;
  kind?: string;
  state?: 'published' | 'draft';
  featured?: 1;
  page?: number;
  page_size?: number;
}

type Writable<T> = Partial<T>;

export const contentStudioApi = {
  options: () => apiClient.get<StudioOptions>('/management/content/options/'),

  products: {
    list: (params?: ProductListParams) =>
      apiClient.get<Paginated<ProductWork>>('/management/content/products/', { params }),
    get: (id: number) => apiClient.get<ProductWork>(`/management/content/products/${id}/`),
    create: (data: Writable<ProductWork>) =>
      apiClient.post<ProductWork>('/management/content/products/', data),
    update: (id: number, data: Writable<ProductWork>) =>
      apiClient.patch<ProductWork>(`/management/content/products/${id}/`, data),
    remove: (id: number) => apiClient.delete(`/management/content/products/${id}/`),
    /** One press, no form: flips draft ⇄ published and stamps the date. */
    publish: (id: number) =>
      apiClient.post<ProductWork>(`/management/content/products/${id}/publish/`),
  },

  articles: {
    list: (params?: ArticleListParams) =>
      apiClient.get<Paginated<ArticleWork>>('/management/content/articles/', { params }),
    get: (id: number) => apiClient.get<ArticleWork>(`/management/content/articles/${id}/`),
    create: (data: Writable<ArticleWork>) =>
      apiClient.post<ArticleWork>('/management/content/articles/', data),
    update: (id: number, data: Writable<ArticleWork>) =>
      apiClient.patch<ArticleWork>(`/management/content/articles/${id}/`, data),
    remove: (id: number) => apiClient.delete(`/management/content/articles/${id}/`),
    publish: (id: number) => apiClient.post<ArticleWork>(`/management/content/articles/${id}/publish/`),
  },

  categories: {
    list: () => apiClient.get<TaxonomyCategory[]>('/management/content/categories/'),
    create: (data: Partial<TaxonomyCategory>) =>
      apiClient.post<TaxonomyCategory>('/management/content/categories/', data),
    update: (id: number, data: Partial<TaxonomyCategory>) =>
      apiClient.patch<TaxonomyCategory>(`/management/content/categories/${id}/`, data),
    remove: (id: number) => apiClient.delete(`/management/content/categories/${id}/`),
  },

  subcategories: {
    list: (params?: { category?: number | string }) =>
      apiClient.get<TaxonomySubCategory[]>('/management/content/subcategories/', { params }),
    create: (data: Partial<TaxonomySubCategory>) =>
      apiClient.post<TaxonomySubCategory>('/management/content/subcategories/', data),
    update: (id: number, data: Partial<TaxonomySubCategory>) =>
      apiClient.patch<TaxonomySubCategory>(`/management/content/subcategories/${id}/`, data),
    remove: (id: number) => apiClient.delete(`/management/content/subcategories/${id}/`),
  },

  tags: {
    list: () => apiClient.get<TaxonomyTag[]>('/management/content/tags/'),
    create: (data: { name: string; slug?: string }) =>
      apiClient.post<TaxonomyTag>('/management/content/tags/', data),
    update: (slug: string, data: { name?: string; slug?: string }) =>
      apiClient.patch<TaxonomyTag>(`/management/content/tags/${slug}/`, data),
    remove: (slug: string) => apiClient.delete(`/management/content/tags/${slug}/`),
  },
};
