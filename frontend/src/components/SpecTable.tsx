// frontend/src/components/SpecTable.tsx
//
// The «ویژگی‌ها» table. A wholesale buyer decides on the numbers — variety,
// germination temperature, days to harvest, rate per hectare — so these render as
// a definition list, not prose, and stay readable on a phone.

import { ListChecks } from 'lucide-react';

import type { ProductAttribute } from '../types';

import { cn } from '../utils/cn';

export default function SpecTable({
  rows,
  title = 'ویژگی‌های محصول',
  columns = 1,
  className,
}: {
  rows: ProductAttribute[];
  title?: string;
  /** Two columns on wide screens once a sheet has more than six rows. */
  columns?: 1 | 2;
  className?: string;
}) {
  const filled = (rows || []).filter((row) => row.value && row.value.trim());
  if (!filled.length) return null;

  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 dark:border-emerald-900 dark:bg-emerald-950',
        className,
      )}
      aria-label={title}
    >
      <h3 className="flex items-center gap-2 text-fluid-sm font-extrabold text-slate-800 dark:text-white">
        <ListChecks size={16} className="text-emerald-600 dark:text-lime-300" />
        {title}
      </h3>
      <dl
        className={cn(
          'mt-3 gap-x-8 border-t border-slate-100 pt-3 dark:border-emerald-900',
          columns === 2 ? 'grid sm:grid-cols-2' : 'grid',
        )}
      >
        {filled.map((row) => (
          <div
            key={`${row.label}-${row.order ?? 0}`}
            className="flex items-baseline justify-between gap-4 border-b border-dashed border-slate-100 py-2 last:border-b-0 dark:border-emerald-900"
          >
            <dt className="shrink-0 text-fluid-xs font-bold text-slate-500 dark:text-emerald-300">{row.label}</dt>
            <dd className="text-start text-fluid-sm font-semibold text-slate-800 dark:text-white">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
