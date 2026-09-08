// frontend/src/services/export.ts
// Thin typed client for the export bounded context (/api/export/).
//
// Contract note: the buyer surface is strictly read-only. Status moves and
// paper uploads are legal acts owned by the staff desk (Django admin /
// ops), so this service deliberately exposes no mutation at all. The types
// live next to the service because they mirror exactly this read contract
// (logistics keeps theirs in types/ only because that module mandated it).

import apiClient from '../api/client';
import type { PaginatedResponse } from '../types/common';

/** One customs paper of a trade file (row of export.ExportDocument). */
export interface ExportDocument {
  id: number;
  export_order: number;
  document_type:
    | 'commercial_invoice'
    | 'certificate_of_origin'
    | 'phytosanitary'
    | 'packing_list';
  document_type_label: string;
  /** URL of the stored scan (absolute in production, root-relative locally). */
  file: string;
  issue_date: string;
  is_verified: boolean;
  created_at: string;
}

export type ExportOrderStatus =
  | 'draft'
  | 'pending_docs'
  | 'customs_clearance'
  | 'shipped'
  | 'completed';

/** The trade file of one export-bound order (row of export.ExportOrder). */
export interface ExportOrder {
  id: number;
  order: number;
  order_code: string;
  /** ISO 3166-1 alpha-2 country code. */
  destination_country: string;
  destination_country_label: string;
  currency: 'USD' | 'EUR' | 'AED' | 'IRT';
  currency_label: string;
  /** Decimal served by DRF as a string; format it only for display. */
  total_value_foreign: string;
  status: ExportOrderStatus;
  status_label: string;
  documents: ExportDocument[];
  created_at: string;
  updated_at: string;
}

/**
 * Export trade files of the signed-in buyer, newest first (default API
 * ordering; the endpoint itself already scopes rows to their owner).
 */
export async function getMyExportOrders(): Promise<ExportOrder[]> {
  const response = await apiClient.get<PaginatedResponse<ExportOrder>>('/export/orders/');
  return response.data.results ?? [];
}
