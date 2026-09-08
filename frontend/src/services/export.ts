// Read-only typed client for the export bounded context.

import apiClient from '../api/client';
import type { PaginatedResponse } from '../types/common';
import type { ExportOrder } from '../types/export';

/**
 * Return the signed-in buyer's export case files. Ownership is enforced by
 * the backend; this client never accepts a user id and exposes no mutations.
 */
export async function getMyExportOrders(): Promise<ExportOrder[]> {
  const response = await apiClient.get<PaginatedResponse<ExportOrder>>(
    '/export/orders/',
  );
  return response.data.results ?? [];
}
