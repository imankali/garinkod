// frontend/src/services/logistics.ts
// Thin typed client for the logistics bounded context (/api/logistics/).
//
// Backend contract (logistics/views.py):
// * list   GET /api/logistics/shipments/?ordering=-created_at  -> paginated,
//   already owner-scoped (a buyer only ever receives their own parcels).
// * filter GET /api/logistics/shipments/?tracking_code=<code>  -> at most one
//   row, because tracking_code is unique in the database.
// The service therefore resolves a shipment BY TRACKING CODE through that
// unique filter; the router's detail endpoint stays id-addressed and the
// backend contract needs no change for shareable /tracking/<code> links.

import apiClient from '../api/client';
import type { PaginatedResponse } from '../types/common';
import type { Shipment as LogisticsShipment } from '../types/logistics';

/**
 * Shipments of the signed-in buyer, newest first (default API ordering).
 *
 * Note: results follow the platform page size, so this answers the recent
 * shipments surface the tracking UI actually needs, not an archive dump.
 */
export async function getMyShipments(): Promise<LogisticsShipment[]> {
  const response = await apiClient.get<PaginatedResponse<LogisticsShipment>>(
    '/logistics/shipments/',
  );
  return response.data.results ?? [];
}

/**
 * Resolve one shipment by its unique, shareable tracking code.
 *
 * Returns `null` when the code is unknown - or belongs to another buyer,
 * because the API never confirms a foreign parcel exists - so the page can
 * render a calm "not found" state instead of an exception. Transport and
 * server failures still reject like any axios call and are handled as errors.
 */
export async function getShipmentByTrackingCode(
  trackingCode: string,
): Promise<LogisticsShipment | null> {
  const response = await apiClient.get<PaginatedResponse<LogisticsShipment>>(
    '/logistics/shipments/',
    { params: { tracking_code: trackingCode.trim() } },
  );
  return response.data.results?.[0] ?? null;
}
