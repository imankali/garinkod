// frontend/src/api/services/content.ts
// Editorial and public content endpoints.
//
// Keeping one bounded API surface per domain prevents the client layer
// from becoming a second monolith as new capabilities are added.

import apiClient from '../client';
import type { BuyerExperiencesResponse, CatalogIndex, CatalogKind, CatalogLanding, SitePolicies } from '@/types/shop';
import type { LegalDocument, LegalIndex, SiteArticleCard, SiteArticleDetail, FarmService, SitePage, AboutResponse, SiteContactInfo } from '@/types/content';

export interface ArticleQuery {
  kind?: 'article' | 'guide';
  crop?: string;
  search?: string;
  featured?: boolean;
  product?: string | number;
  limit?: number;
}

export interface HeroSlideData {
  id: number;
  kicker: string;
  title: string;
  body: string;
  cta_label: string;
  cta_url: string;
  background_url: string;
  gradient: string;
}

export const heroSlidesApi = {
  /** GET /api/hero-slides/ — active slides in display order. */
  list: () => apiClient.get<HeroSlideData[]>('/hero-slides/'),
};

export const articlesApi = {
  /** GET /api/articles/ — published site articles and growing guides. */
  getAll: (params?: ArticleQuery) => {
    return apiClient.get<SiteArticleCard[]>('/articles/', { params });
  },

  /** GET /api/articles/{slug}/ — full body, TOC headings, related products. */
  getBySlug: (slug: string) => {
    return apiClient.get<SiteArticleDetail>(`/articles/${slug}/`);
  },

  /** GET /api/articles/guides/ — growing guides only. */
  getGuides: () => {
    return apiClient.get<SiteArticleCard[]>('/articles/guides/');
  },

  /** Crops that already have a guide. */
  getCrops: () => {
    return apiClient.get<Array<{ crop: string; article_count: number }>>('/articles/crops/');
  },

  getRelated: (slug: string) => {
    return apiClient.get<SiteArticleCard[]>(`/articles/${slug}/related/`);
  },
};

export const farmServicesApi = {
  /** GET /api/services/catalog/ */
  getAll: () => {
    return apiClient.get<FarmService[]>('/services/catalog/');
  },

  /** GET /api/services/catalog/{slug}/ */
  getBySlug: (slug: string) => {
    return apiClient.get<FarmService>(`/services/catalog/${slug}/`);
  },
};

export const sitePagesApi = {
  /** GET /api/pages/ — admin-editable info pages and product landings. */
  getAll: (params?: { kind?: 'page' | 'landing' }) => {
    return apiClient.get<SitePage[]>('/pages/', { params });
  },

  getBySlug: (slug: string) => {
    return apiClient.get<SitePage>(`/pages/${slug}/`);
  },
};

export const catalogApi = {
  /**
   * GET /api/catalog/index/ — every addressable landing page in one read,
   * used by the footer, the shop's «همه دسته‌ها» panel and the sitemap editor.
   */
  index: () => {
    return apiClient.get<CatalogIndex>('/catalog/index/');
  },

  /**
   * GET /api/catalog/landing/<kind>/<slug>/ — one category, subcategory, brand
   * or tag page: its intro text, its children, and the filter its grid must use.
   */
  landing: (kind: CatalogKind, slug: string) => {
    return apiClient.get<CatalogLanding>(`/catalog/landing/${kind}/${encodeURIComponent(slug)}/`);
  },
};

export const testimonialsApi = {
  /** GET /api/testimonials/ — real reviews, editor-pinned when there are any. */
  list: () => {
    return apiClient.get<BuyerExperiencesResponse>('/testimonials/');
  },
};

export const policiesApi = {
  /**
   * GET /api/site/policies/ — the return window and the express option as the
   * operator configured them. An unset window means the site states no number.
   */
  get: () => {
    return apiClient.get<SitePolicies>('/site/policies/');
  },
};

export const legalApi = {
  /** GET /api/legal/ — the hub: every document, its summary and the text version. */
  index: () => {
    return apiClient.get<LegalIndex>('/legal/');
  },

  /** GET /api/legal/<slug>/ — one document, admin text or shipped wording. */
  document: (slug: string) => {
    return apiClient.get<LegalDocument>(`/legal/${slug}/`);
  },
};

export const siteInfoApi = {
  /** Company contact channels, maintained in the admin. */
  getContact: () => {
    return apiClient.get<SiteContactInfo>('/site/contact/');
  },

  /** Team, represented brands and counters taken from real rows. */
  getAbout: () => {
    return apiClient.get<AboutResponse>('/site/about/');
  },

  /** What the site can already advise on, per crop. */
  getGrowingIndex: () => {
    return apiClient.get<{
      categories: Array<{ name: string; slug: string; product_count: number; guide_count: number }>;
      crops: Array<{ crop: string; guide_count: number }>;
    }>('/guides/index/');
  },
};

export const newsletterApi = {
  subscribe: (data: { email?: string; mobile?: string; topics?: string; source?: string }) => {
    return apiClient.post<{ subscribed: boolean; message: string }>('/newsletter/subscribe/', data);
  },
  unsubscribe: (data: { email?: string; mobile?: string }) => {
    return apiClient.post<{ unsubscribed: boolean; count: number }>('/newsletter/unsubscribe/', data);
  },
};
