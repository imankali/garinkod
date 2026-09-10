// frontend/src/types/farming.ts — domain types (split from types/index.ts)
export type LandType = 'orchard' | 'farmland' | 'greenhouse';

export type FarmEventKind = 'spraying' | 'fertilizing' | 'irrigation';

export interface FarmLand {
  id: number;
  owner: number;
  owner_name: string;
  name: string;
  land_type: LandType;
  land_type_label: string;
  area: string;
  area_unit: string;
  area_unit_label: string;
  area_label: string;
  crop_type: string;
  crop_variety: string;
  province: string;
  city: string;
  soil_type: string;
  soil_type_label: string;
  irrigation_type: string;
  irrigation_type_label: string;
  planting_date: string | null;
  notes: string;
  is_active: boolean;
  event_count: number;
  created_at: string;
  updated_at: string;
}

export interface FarmCalendarEvent {
  id: number;
  land: number;
  land_name: string;
  kind: FarmEventKind;
  kind_label: string;
  title: string;
  date: string;
  notes: string;
  status: 'planned' | 'done' | 'cancelled';
  status_label: string;
  created_by: number;
  created_by_name: string;
  is_consultant_note: boolean;
  created_at: string;
  updated_at: string;
}

export interface FarmConsultationRequest {
  id: number;
  farmer: number;
  farmer_name: string;
  farmer_username: string;
  land: FarmLand;
  land_id?: number;
  subject: string;
  subject_label: string;
  message: string;
  reply: string;
  status: 'pending' | 'answered' | 'closed';
  status_label: string;
  replied_by: number | null;
  /**
   * The messenger thread this request is mirrored into, and how many messages
   * it holds. A consultation is a conversation, not a form with one answer:
   * «ادامه گفتگو» needs the thread id to open it.
   */
  conversation_id: number | null;
  thread_message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConsultantFarmerSummary {
  id: number;
  username: string;
  full_name: string;
  phone: string;
  lands: FarmLand[];
  land_count: number;
  pending_requests: number;
}

export interface ConsultantFarmerDossier {
  farmer: {
    id: number;
    username: string;
    full_name: string;
    email: string;
    phone: string;
    address: string;
    level_label: string;
  };
  lands: (FarmLand & { events: FarmCalendarEvent[] })[];
  requests: FarmConsultationRequest[];
}

// ========================================
// Geography and agricultural reference data
// ========================================

export interface Location {
  id: number;
  name: string;
  slug: string;
  kind: 'province' | 'city';
  parent: number | null;
  province_name: string;
}

export interface AgriInputDose {
  id: number;
  crop_name: string;
  target: string;
  basis: 'per_hectare' | 'per_1000_liter';
  basis_label: string;
  min_rate: string;
  max_rate: string;
  rate_unit: string;
  notes: string;
}

export interface AgriInput {
  id: number;
  name: string;
  slug: string;
  kind: 'fertilizer' | 'pesticide';
  kind_label: string;
  active_ingredient: string;
  formulation: string;
  unit: string;
  product: number | null;
  product_slug: string;
  safety_notes: string;
  preharvest_interval_days: number | null;
  doses: AgriInputDose[];
}

export type AreaUnit = 'hectare' | 'jarib' | 'square_meter' | 'acre';

export interface DoseCalculation {
  input: { id: number; name: string; kind: string };
  crop: string;
  target: string;
  area: { value: string; unit: AreaUnit; unit_label: string; hectares: string };
  rate: { min: string; max: string; unit: string; basis: string; basis_label: string };
  total: { min: string; max: string; unit: string };
  notes: string;
  warnings: string[];
}
