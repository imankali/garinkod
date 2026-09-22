// frontend/src/api/services/management.ts
// Management and operations endpoints.
//
// Keeping one bounded API surface per domain prevents the client layer
// from becoming a second monolith as new capabilities are added.

import apiClient from '../client';
import type { LevelRank, ManagementDashboard, ManagementStaffMember, ManagementAuditLog } from '@/types/user';

export const managementApi = {
  dashboard: () => apiClient.get<ManagementDashboard>('/management/dashboard/'),
  staff: () => apiClient.get<{ roles: string[]; staff: ManagementStaffMember[] }>('/management/staff/'),
  updateStaff: (username: string, groups: string[], isActive: boolean) =>
    apiClient.patch<{ username: string; groups: string[]; is_active: boolean }>('/management/staff/', { username, groups, is_active: isActive }),
  audit: () => apiClient.get<ManagementAuditLog[]>('/management/audit/'),
  markOrderPaid: (code: string) => apiClient.post(`/management/orders/${code}/mark-paid/`),
  moderate: (type: 'comment' | 'post' | 'listing', id: number, status: string, reason?: string) =>
    apiClient.post(`/management/moderate/${type}/${id}/`, { status, reason }),
  bulkModerate: (contentType: 'listing' | 'post' | 'comment', ids: number[], status: string, reason?: string) =>
    apiClient.post<{ updated: number; status: string }>('/management/moderation/bulk/', {
      content_type: contentType,
      ids,
      status,
      reason,
    }),
  moderationQueue: (params?: {
    type?: string;
    status?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) =>
    apiClient.get<{
      count: number;
      page: number;
      page_size: number;
      total_pages: number;
      results: ModerationQueueRow[];
    }>('/management/moderation/queue/', { params }),
  users: (params?: {
    search?: string;
    level?: string;
    /** «who is in the shop right now» — presence rows, not a guess. */
    online?: 1;
    /** The opposite question: people with an account who have not come lately. */
    inactive?: 1;
    page?: number;
    page_size?: number;
  }) =>
    apiClient.get<{
      count: number;
      page: number;
      page_size: number;
      total_pages: number;
      levels: { value: number; label: string }[];
      results: ManagedUser[];
      presence_window_minutes?: number;
      /** The ladder with what each step unlocks, so the console explains itself. */
      ladder?: LevelRank[];
    }>('/management/users/', { params }),
  updateUser: (username: string, data: { level?: number; is_active?: boolean }) =>
    apiClient.patch<{ username: string; level: number; is_active: boolean; is_staff: boolean }>(
      '/management/users/',
      { username, ...data },
    ),
};

export interface ModerationQueueRow {
  type: 'listing' | 'post' | 'comment' | 'feedback' | 'complaint';
  id: number;
  title: string;
  excerpt: string;
  status: string;
  status_label: string;
  storefront: string;
  storefront_slug: string;
  image_url: string;
  rejection_reason: string;
  created_at: string;
}

export interface ManagedUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  level: number;
  level_label: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  groups: string[];
  date_joined: string;
  /** Only sent by the management directory; the health panel is what reads them. */
  orders?: number;
  reviews?: number;
  online?: boolean;
  last_seen_at?: string | null;
  requests_in_window?: number;
  current_path?: string;
}

export interface OpsMeasurements {
  cpu_count: number | null;
  load_1m: number | null;
  load_5m: number | null;
  memory_total_mb: number | null;
  memory_available_mb: number | null;
  container_limit_mb: number | null;
  disk_free_mb: number | null;
  gpu: string;
}

export interface OpsSample {
  at: string;
  online: number;
  online_users: number;
  online_guests: number;
  waiting: number;
  capacity: number;
  basis: string;
  load_1m: number | null;
  memory_available_mb: number | null;
  disk_free_mb: number | null;
}

export interface OpsPresenceRow {
  identity: string;
  kind: string;
  kind_label: string;
  path: string;
  requests: number;
  last_seen_at: string;
  who: string;
  is_staff: boolean;
}

export interface OpsHealth {
  capacity: number;
  capacity_basis: string;
  strategy: string;
  strategy_label: string;
  inside_now: number;
  online_users: number;
  online_guests: number;
  waiting_now: number;
  spare_places: number;
  utilisation_percent: number;
  activity_window_minutes: number;
  measured_at: string;
  measurements: OpsMeasurements;
  uptime: { process_seconds: number; label: string; started_at: string; note: string };
  database: { vendor: string; label: string; file: string };
  queue: {
    enabled: boolean;
    max_minutes: number;
    waiting: number;
    admitted_recently: number;
    next_positions: Array<{ position: number; path: string; waiting_minutes: number }>;
  };
  presence: {
    window_minutes: number;
    since: string;
    staff: number;
    recent: OpsPresenceRow[];
  };
  signals: {
    users_total: number;
    users_active: number;
    products_published: number;
    orders_today: number;
    orders_24h: number;
    reviews_today: number;
    open_logs: number;
    errors_24h: number;
  };
  samples: OpsSample[];
}

export interface OpsLogRow {
  id: number;
  level: string;
  level_label: string;
  source: string;
  title: string;
  message: string;
  path: string;
  method: string;
  status_code: number | null;
  count: number;
  first_at: string;
  last_at: string;
  user: string;
  is_open: boolean;
  resolved_at: string | null;
  resolved_by: string;
  note: string;
  context: Record<string, unknown> | string;
}

export interface OpsLogPage {
  count: number;
  page: number;
  pages: number;
  summary: {
    error_24h: number;
    warning_24h: number;
    notice_24h: number;
    open: number;
    occurrences_open: number;
  };
  sources: Array<{ source: string; groups: number; occurrences: number }>;
  results: OpsLogRow[];
}

export interface AdmissionAnswer {
  state: 'inside' | 'waiting';
  position: number;
  waiting_minutes: number;
  refresh_seconds: number;
  capacity: number;
  capacity_basis: string;
  /** The ceiling the operator promised: nobody waits longer than this. */
  max_wait_minutes: number;
  inside_now: number;
  waiting_now: number;
  message: string;
}

export const opsApi = {
  health: () => apiClient.get<OpsHealth>('/ops/health/'),
  logs: (params?: { level?: string; source?: string; search?: string; hours?: number; open?: 1; page?: number; page_size?: number }) =>
    apiClient.get<OpsLogPage>('/ops/logs/', { params }),
  resolveLog: (id: number, note?: string, action: 'resolve' | 'reopen' = 'resolve') =>
    apiClient.post<OpsLogRow>(`/ops/logs/${id}/resolve/`, { note: note ?? '', action }),
  admission: () => apiClient.get<AdmissionAnswer>('/ops/admission/'),
};
