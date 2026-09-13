// frontend/src/types/commerce.ts — domain types (split from types/index.ts)

import type { ProductList } from './shop';
export interface CartListing {
  id: number;
  title: string;
  slug: string;
  price: number;
  unit: string;
  quantity_available: string;
  min_order_quantity: string;
  image_url: string;
  storefront_name: string;
  storefront_slug: string;
}

/**
 * A cart row is either a catalogue product or a storefront listing; `kind`
 * says which, and exactly one of `product` / `listing` is non-null.
 */

export interface CartItem {
  id: number;
  kind: 'product' | 'listing';
  product: ProductList | null;
  listing: CartListing | null;
  title: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  available_quantity: number;
  min_order_quantity: number;
  is_in_stock: boolean;
  /** The chosen packaging, when the product declares more than one. */
  product_package?: number | null;
  package_label?: string;

  /**
   * The unit price before the quantity ladder, in تومان. Present so the row can
   * show what the ladder took off; equal to `unit_price` when there is no ladder
   * or the cart has not reached the first rung.
   */
  base_unit_price?: number;
  /** The discount percent of the rung currently in force; 0 when none. */
  tier_discount_percent?: number;
  /** What the ladder saved on this row, in تومان, across all units. */
  tier_saving?: number;
  /** The next rung up, or null at the top of the ladder. */
  next_tier?: {
    id: number;
    min_quantity: number;
    discount_percent: number;
    unit_price: number;
  } | null;
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

export interface OrderItem {
  id: number;
  kind: 'product' | 'listing';
  kind_label: string;
  product: number | null;
  listing: number | null;
  product_title: string;
  product_slug: string;
  storefront: number | null;
  storefront_name: string;
  storefront_slug: string;
  seller_name: string;
  unit: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  /** Packaging as it was sold; snapshotted, so a retired label still reads right. */
  package_label?: string;
}

export interface ShipmentTrackingEvent {
  id: number;
  status: string;
  status_label: string;
  description: string;
  location: string;
  occurred_at: string;
}

export interface Shipment {
  id: string;
  provider: string;
  provider_label: string;
  service_name: string;
  status: string;
  status_label: string;
  tracking_code: string;
  tracking_url: string;
  shipping_cost: number;
  shipped_at: string | null;
  delivered_at: string | null;
  last_event_at: string | null;
  events: ShipmentTrackingEvent[];
  created_at: string;
  updated_at: string;
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
  latitude: string | null;
  longitude: string | null;
  notes: string;
  subtotal: number;
  discount_amount: number;
  coupon_code: string;
  /** Loyalty redemption folded into total_price at checkout; both are the
      audit trail of Wallet.redeem_loyalty on the order row. */
  loyalty_discount: number;
  loyalty_points_used: number;
  shipping_price: number;
  shipping_provider: string;
  shipping_service: string;
  total_price: number;
  status: string;
  status_label: string;
  payment_status: string;
  payment_status_label: string;
  payment_method: string;
  payment_method_label: string;
  total_items: number;
  items: OrderItem[];
  shipments: Shipment[];
  created_at: string;
  updated_at: string;
  /** When the buyer accepted the terms, and which text they accepted. */
  terms_accepted_at: string | null;
  legal_version: string;
}

export interface CheckoutPayload {
  customer_name: string;
  phone: string;
  email?: string;
  province: string;
  city: string;
  address: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  payment_method: 'coordination' | 'zarinpal' | 'stripe_card' | 'paypal' | 'crypto';
  affiliate_code?: string;
  coupon_code?: string;
  /** Grants the server permission to redeem available wallet loyalty points
      (100 pts = 10,000 toman) against this order's payable amount. */
  use_loyalty_points?: boolean;
  terms_accepted: boolean;
  /**
   * Which delivery service the buyer picked. Only the services the server
   * offered are accepted; the price is always recomputed at checkout.
   */
  shipping_service?: 'standard' | 'express';
}

export interface PaymentProviderOption {
  code: CheckoutPayload['payment_method'];
  label: string;
  currency: string;
  enabled: boolean;
  configured: boolean;
  reason: string;
}

export interface PaymentAttempt {
  id: number;
  provider: string;
  provider_label: string;
  status: string;
  status_label: string;
  amount: number;
  currency: string;
  checkout_url: string;
  created_at: string;
  updated_at: string;
}

export interface ShippingQuote {
  provider: string;
  service: string;
  label: string;
  amount: number;
  currency: 'IRT';
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

export interface AffiliateProfile {
  id: number;
  code: string;
  commission_rate: string;
  status: 'pending' | 'active' | 'suspended';
  status_label: string;
  created_at: string;
}

export interface AffiliateConversion {
  id: number;
  order_code: string;
  commission_amount: number;
  status: string;
  status_label: string;
  created_at: string;
}

export interface FinancialLedgerEntry {
  id: number;
  /** Stable human reference, e.g. GKF-00000123. */
  reference: string;
  order_code: string;
  owner_type: string;
  entry_type: string;
  entry_type_label: string;
  status: string;
  status_label: string;
  amount: number;
  currency: string;
  description: string;
  created_at: string;
  available_at: string | null;
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

export interface Coupon {
  id: number;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount_amount: number | null;
  min_order_amount: number;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
}

export interface WalletTransaction {
  id: number;
  order: number | null;
  amount: number;
  transaction_type: string;
  type_label: string;
  status: string;
  status_label: string;
  description: string;
  created_at: string;
  available_at: string | null;
}

export interface Wallet {
  id: number;
  currency: string;
  balance: number;
  updated_at: string;
  transactions: WalletTransaction[];
}
