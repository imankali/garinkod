// frontend/src/types/logistics.ts — domain types for the logistics module
// (buyer-facing shipment tracking; mirrors logistics/serializers.py).
//
// Naming note: commerce.ts already owns `Shipment` for the ops/carrier
// record (shop.models.Shipment). These are the holding logistics module's
// customer-side types; the barrel re-exports them aliased as
// LogisticsShipment / LogisticsShipmentEvent to keep both contracts visible
// without a collision.

export type LogisticsShipmentStatus =
  | "pending"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed";

export interface ShipmentEvent {
  id: number;
  status: LogisticsShipmentStatus;
  /** Persian display label resolved server-side (get_status_display). */
  status_label: string;
  description: string;
  location: string;
  /** ISO timestamp set by the server when the event was recorded. */
  timestamp: string;
}

export interface Shipment {
  id: number;
  /** Kernel order code exposed as a plain string (DDD local contract). */
  order_code: string;
  tracking_code: string;
  carrier_name: string;
  status: LogisticsShipmentStatus;
  status_label: string;
  estimated_delivery_date: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  /** Timeline served newest-first by the API. */
  events: ShipmentEvent[];
  created_at: string;
  updated_at: string;
}
