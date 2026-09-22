// frontend/src/api/services/farming.ts
// Farm and agricultural reference endpoints.
//
// Keeping one bounded API surface per domain prevents the client layer
// from becoming a second monolith as new capabilities are added.

import apiClient from '../client';
import type { Location, AgriInput, DoseCalculation, AreaUnit, FarmLand, FarmCalendarEvent, FarmConsultationRequest, ConsultantFarmerSummary, ConsultantFarmerDossier } from '@/types/farming';

export const locationsApi = {
  /** بدون پارامتر: فهرست استان‌ها */
  provinces: () => apiClient.get<{ count: number; results: Location[] }>('/locations/'),
  /** شهرهای یک استان */
  cities: (province: string) =>
    apiClient.get<{ count: number; results: Location[] }>('/locations/', { params: { province } }),
  search: (search: string) =>
    apiClient.get<{ count: number; results: Location[] }>('/locations/', { params: { search } }),
};

export const agriApi = {
  inputs: (params?: { search?: string; kind?: 'fertilizer' | 'pesticide'; crop?: string }) =>
    apiClient.get<{ count: number; results: AgriInput[] }>('/agri/inputs/', { params }),
  crops: () => apiClient.get<{ results: string[] }>('/agri/crops/'),
  calculate: (data: { input_id: number; crop: string; area: number; area_unit: AreaUnit }) =>
    apiClient.post<DoseCalculation>('/agri/calculate/', data),
};

export interface FarmLandPayload {
  name: string;
  land_type: FarmLand['land_type'];
  area: string;
  area_unit?: string;
  crop_type: string;
  crop_variety?: string;
  province?: string;
  city?: string;
  soil_type?: string;
  irrigation_type?: string;
  planting_date?: string | null;
  notes?: string;
}

export interface FarmEventPayload {
  kind: FarmCalendarEvent['kind'];
  title: string;
  date: string;
  notes?: string;
  status?: FarmCalendarEvent['status'];
}

export const farmApi = {
  /** All of the caller's lands (orchards / croplands / greenhouses). */
  lands: () => apiClient.get<FarmLand[]>('/farm/lands/'),
  createLand: (data: FarmLandPayload) => apiClient.post<FarmLand>('/farm/lands/', data),
  landDetail: (landId: number) =>
    apiClient.get<{ land: FarmLand; events: FarmCalendarEvent[] }>(`/farm/lands/${landId}/`),
  updateLand: (landId: number, data: Partial<FarmLandPayload>) =>
    apiClient.patch<FarmLand>(`/farm/lands/${landId}/`, data),
  deleteLand: (landId: number) => apiClient.delete<{ message: string }>(`/farm/lands/${landId}/`),

  /** Add an entry to one of the caller's own land calendars. */
  addEvent: (landId: number, data: FarmEventPayload) =>
    apiClient.post<FarmCalendarEvent>(`/farm/lands/${landId}/events/`, data),
  updateEvent: (eventId: number, data: Partial<FarmEventPayload>) =>
    apiClient.patch<FarmCalendarEvent>(`/farm/events/${eventId}/`, data),
  deleteEvent: (eventId: number) => apiClient.delete<{ message: string }>(`/farm/events/${eventId}/`),

  /** The caller's whole calendar, optionally filtered. */
  calendar: (params?: { kind?: FarmCalendarEvent['kind']; from?: string; to?: string }) =>
    apiClient.get<FarmCalendarEvent[]>('/farm/calendar/', { params }),

  /** The caller's consultation requests, or file a new one for a land. */
  consultations: () => apiClient.get<FarmConsultationRequest[]>('/farm/consultations/'),
  createConsultation: (data: { land_id: number; subject: string; message: string }) =>
    apiClient.post<FarmConsultationRequest>('/farm/consultations/', data),
};

export const consultingApi = {
  /** Consultant queue (level 3+): all requests, filterable. */
  requests: (params?: { status?: string; search?: string }) =>
    apiClient.get<FarmConsultationRequest[]>('/farm/consulting/requests/', { params }),
  reply: (consultationId: number, data: { reply: string; status?: string }) =>
    apiClient.patch<FarmConsultationRequest>(
      `/farm/consulting/requests/${consultationId}/reply/`, data,
    ),

  /** Farmer directory with lands and pending counts. */
  farmers: (params?: { search?: string }) =>
    apiClient.get<{ count: number; results: ConsultantFarmerSummary[] }>(
      '/farm/consulting/farmers/', { params },
    ),

  /** One farmer's full dossier: profile, lands with calendars, requests. */
  dossier: (userId: number) =>
    apiClient.get<ConsultantFarmerDossier>(`/farm/consulting/farmers/${userId}/`),

  /** Write a spraying/fertilizing/irrigation entry into any land's calendar. */
  addEvent: (landId: number, data: FarmEventPayload) =>
    apiClient.post<FarmCalendarEvent>(`/farm/consulting/lands/${landId}/events/`, data),
};
