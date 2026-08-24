// frontend/src/components/farm/farmOptions.ts
//
// Labels and option lists shared by the land form and the calendar UI.

import type { FarmEventKind, LandType } from '../../types';

export const LAND_TYPES: { value: LandType; label: string; emoji: string }[] = [
  { value: 'orchard', label: 'باغ', emoji: '🌳' },
  { value: 'farmland', label: 'زمین زراعی', emoji: '🌾' },
  { value: 'greenhouse', label: 'گلخانه', emoji: '🏡' },
];

export const AREA_UNITS = [
  { value: 'hectare', label: 'هکتار' },
  { value: 'jarib', label: 'جریب' },
  { value: 'square_meter', label: 'مترمربع' },
];

export const SOIL_TYPES = [
  { value: 'loam', label: 'لومی' },
  { value: 'clay', label: 'رسی' },
  { value: 'sandy', label: 'شنی' },
  { value: 'calcareous', label: 'آهکی' },
  { value: 'other', label: 'سایر' },
];

export const IRRIGATION_TYPES = [
  { value: 'drip', label: 'قطره‌ای' },
  { value: 'sprinkler', label: 'بارانی' },
  { value: 'flood', label: 'غرقابی' },
  { value: 'furrow', label: 'کرتی/نشتی' },
  { value: 'other', label: 'سایر' },
];

export const EVENT_KINDS: { value: FarmEventKind; label: string; color: string }[] = [
  { value: 'spraying', label: 'سم‌پاشی', color: 'rose' },
  { value: 'fertilizing', label: 'کوددهی', color: 'amber' },
  { value: 'irrigation', label: 'آبیاری', color: 'sky' },
];

export const EVENT_COLORS: Record<FarmEventKind, string> = {
  spraying: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
  fertilizing: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  irrigation: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
};

export const CONSULTATION_SUBJECTS = [
  { value: 'general', label: 'مشاوره عمومی' },
  { value: 'spraying', label: 'مشاوره سم‌پاشی' },
  { value: 'fertilizing', label: 'مشاوره کوددهی' },
  { value: 'irrigation', label: 'مشاوره آبیاری' },
  { value: 'pest', label: 'آفت و بیماری' },
];

/** تاریخ میلادی به شمسی برای نمایش. */
export function formatFaDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('fa-IR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return iso;
  }
}
