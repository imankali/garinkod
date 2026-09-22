// frontend/src/api/services/commerce.ts
// Cart, orders and money endpoints.
//
// Keeping one bounded API surface per domain prevents the client layer
// from becoming a second monolith as new capabilities are added.

import apiClient from '../client';
import type { WebPushSubscriptionSummary } from '@/types/user';
import type { PlatformFeedbackPayload, StorefrontComplaintPayload, VisualSearchResponse } from '@/types/content';
import type { Cart, Order, CheckoutPayload, PaymentProviderOption, PaymentAttempt, ShippingQuote, AffiliateProfile, AffiliateConversion, FinancialLedgerEntry, Coupon, Wallet } from '@/types/commerce';
import type { Storefront } from '@/types/storefront';

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
  add: (productId: number, quantity: number = 1, packageId?: number | null) => {
    return apiClient.post<Cart>('/cart/add/', {
      product_id: productId,
      quantity,
      // Which bag was picked, when the product sells in more than one.
      ...(packageId ? { package_id: packageId } : {}),
    });
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

export const ordersApi = {
  checkout: (data: CheckoutPayload) =>
    apiClient.post<{
      order: Order;
      payment: PaymentAttempt | null;
      payment_error: string;
      message: string;
      /** Flat math receipt mirroring the order: payable before loyalty, the
          discount actually applied, and the final charged total. */
      original_total?: number;
      loyalty_discount?: number;
      final_total?: number;
    }>('/orders/checkout/', data),
  lookup: (code: string, phone: string) =>
    apiClient.get<Order>('/orders/lookup/', { params: { code, phone } }),
  cancel: (code: string, phone: string) =>
    apiClient.post<{ order: Order; message: string }>('/orders/cancel/', { code, phone }),
  mine: () => apiClient.get<Order[]>('/orders/mine/'),
};

export const featureFlagsApi = {
  get: () => apiClient.get<{ flags: Record<string, boolean> }>('/features/'),
};

export const shippingApi = {
  quote: (province: string, city: string) =>
    apiClient.post<{ quotes: ShippingQuote[]; authoritative_at_checkout: boolean }>(
      '/shipping/quote/',
      { province, city },
    ),
};

export const paymentsApi = {
  options: () => apiClient.get<{ providers: PaymentProviderOption[] }>('/payments/options/'),
  restartZarinpal: (code: string, phone = '') =>
    apiClient.post<{ payment: PaymentAttempt }>('/payments/zarinpal/restart/', { code, phone }),
};

export const webPushApi = {
  status: () => apiClient.get<{
    enabled: boolean;
    public_key: string;
    subscriptions: WebPushSubscriptionSummary[];
  }>('/notifications/webpush/'),
  subscribe: (subscription: PushSubscriptionJSON) =>
    apiClient.post<WebPushSubscriptionSummary>('/notifications/webpush/', { subscription }),
  remove: (id: string) => apiClient.delete('/notifications/webpush/', { data: { id } }),
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

export interface WithdrawalRequest {
  id: number;
  amount: number;
  commission_rate: string;
  commission_amount: number;
  net_amount: number;
  card_number_masked: string;
  status: 'pending' | 'paid' | 'rejected';
  status_label: string;
  created_at: string;
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
      withdrawals: WithdrawalRequest[];
      notice: string;
    }>('/marketplace/finance/', { params }),

  /** Register a withdrawal request against the available balance. */
  withdraw: (data: { amount: number }) =>
    apiClient.post<{ withdrawal: WithdrawalRequest; balances: Record<string, number> }>(
      '/marketplace/finance/withdraw/',
      data,
    ),

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
