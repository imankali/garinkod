// frontend/src/components/direct/ShareLandButton.tsx
//
// «افزودن زمین» in the desk composer.
//
// The button is deliberately small and the flow behind it is the one the farmer
// already knows from the زمین‌ها section: pick a registered land, or create a
// record if none exists yet. Attaching sends the actual `FarmLand` row with the
// message, so the desk reads the same soil, area and irrigation data the farmer
// entered — not a photo of it.
//
// It appears only in the two service threads: a land record has nothing to do
// with haggling over a listing in a storefront chat.

import { useState } from 'react';
import { Sprout, X } from 'lucide-react';

import ShareLandSheet from './ShareLandSheet';
import { cn } from '../../utils/cn';
import type { FarmLand } from '../../types';

export function AttachLandButton({
  disabled = false,
  onPick,
  className,
}: {
  disabled?: boolean;
  onPick: (land: FarmLand) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label="افزودن پرونده زمین به گفتگو"
        title="پرونده زمین را با کارشناس در میان بگذارید"
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition',
          'hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50',
          'dark:text-emerald-300 dark:hover:bg-emerald-900',
          className,
        )}
      >
        <Sprout size={19} />
      </button>

      <ShareLandSheet open={open} onClose={() => setOpen(false)} onPick={onPick} />
    </>
  );
}

/** The chip above the input: what will be sent along with the text. */
export function AttachedLandChip({
  land,
  onRemove,
}: {
  land: FarmLand;
  onRemove: () => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-700 dark:bg-emerald-900/40">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white"
        aria-hidden="true"
      >
        <Sprout size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-fluid-xs font-bold text-slate-700 dark:text-emerald-50">
          {land.name}
        </span>
        <span className="block truncate text-fluid-2xs text-slate-500 dark:text-emerald-200">
          {land.land_type_label} · {land.area_label}
          {land.crop_type ? ` · ${land.crop_type}` : ''}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-rose-500 dark:hover:bg-emerald-950"
        aria-label="برداشتن پرونده زمین از پیام"
      >
        <X size={14} />
      </button>
    </div>
  );
}
