// frontend/src/components/direct/LandDossierCard.tsx
//
// A land case file inside a chat bubble — the record itself, not a screenshot of
// one. A consultant answering «چه کودی بزنم؟» needs the soil, the irrigation and
// the area, and making them leave the conversation to look them up in the farm
// panel is how a consultation ends up taking three days.
//
// It shows exactly what the message carried when it was sent: a farmer who
// later edits the land does not retroactively change what the desk was told.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronDown, MapPin, Ruler, Sprout } from 'lucide-react';

import { cn } from '../../utils/cn';
import type { SharedLandDossier } from '../../types';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Persian digits, because a Latin «2.5» inside a Persian sentence reads broken. */
function faNumber(value: number | string) {
  return String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)] ?? digit);
}

interface FactRow {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

function Fact({ icon, label, value }: FactRow) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      {icon}
      <span className="opacity-70">{label}:</span>
      <span className="min-w-0 truncate font-bold">{value}</span>
    </span>
  );
}

export default function LandDossierCard({
  land,
  tone = 'light',
}: {
  land: SharedLandDossier;
  /** `dark` is a bubble on the sender's side, which needs reversed contrast. */
  tone?: 'light' | 'dark';
}) {
  const [open, setOpen] = useState(false);
  const facts = [
    { label: 'مساحت', value: land.area_label, icon: <Ruler size={11} aria-hidden="true" /> },
    { label: 'خاک', value: land.soil_type_label },
    { label: 'آبیاری', value: land.irrigation_type_label },
    { label: 'کشت', value: land.planting_date ? faNumber(land.planting_date) : '' },
  ].filter((fact) => fact.value);

  return (
    <div
      className={cn(
        'mt-2 overflow-hidden rounded-xl border p-2.5 text-start',
        tone === 'dark'
          ? 'border-white/25 bg-white/10 text-white'
          : 'border-emerald-200 bg-emerald-50/80 text-slate-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-50',
      )}
    >
      <span className="flex items-start gap-2">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            tone === 'dark' ? 'bg-white/20 text-white' : 'bg-emerald-600 text-white',
          )}
          aria-hidden="true"
        >
          <Sprout size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-fluid-xs font-extrabold">{land.name}</span>
          <span className="mt-0.5 block truncate text-fluid-2xs opacity-80">
            {land.land_type_label}
            {land.crop_type ? ` · ${land.crop_type}` : ''}
            {land.crop_variety ? ` (${land.crop_variety})` : ''}
          </span>
        </span>
      </span>

      <span className="mt-2 block space-y-1 text-fluid-2xs">
        {facts.map((fact) => (
          <Fact key={fact.label} label={fact.label} value={fact.value} />
        ))}
        {(land.province || land.city) && (
          <Fact
            icon={<MapPin size={11} aria-hidden="true" />}
            label="موقعیت"
            value={[land.province, land.city].filter(Boolean).join(' / ')}
          />
        )}
      </span>

      {land.notes && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={cn(
            'mt-2 flex w-full items-center gap-1 rounded-lg px-1 py-1 text-fluid-2xs font-bold transition',
            tone === 'dark' ? 'hover:bg-white/15' : 'hover:bg-white dark:hover:bg-emerald-900',
          )}
        >
          <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} aria-hidden="true" />
          یادداشت کشاورز
        </button>
      )}
      {land.notes && open && (
        <span className="mt-1 block whitespace-pre-wrap rounded-lg bg-black/10 p-2 text-fluid-2xs leading-6 dark:bg-black/20">
          {land.notes}
        </span>
      )}

      {land.event_count > 0 && (
        <span className="mt-2 flex items-center gap-1 text-fluid-2xs opacity-80">
          <CalendarDays size={11} aria-hidden="true" />
          {faNumber(land.event_count)} رویداد در تقویم کار این زمین ثبت شده
        </span>
      )}

      <Link
        // The farmer's own land dossier, where the calendar and the consultation
        // history live. There is no per-land page, so this is the honest target.
        to="/profile?tab=farm"
        className={cn(
          'mt-2 inline-flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-fluid-2xs font-extrabold transition',
          tone === 'dark'
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-emerald-600 text-white hover:bg-emerald-700',
        )}
      >
        پرونده کامل زمین
      </Link>
    </div>
  );
}
