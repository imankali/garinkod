// frontend/src/components/StarRating.tsx
//
// Star display and the reviewer's input. Kept in one file because both states
// share the same geometry: five 20px icons, RTL-safe, and a text alternative
// for screen readers (a row of icons alone is meaningless to a reader).

import { Star } from 'lucide-react';

import { cn } from '../utils/cn';

/** Persian ordinal for a bucket label, e.g. «۴ ستاره». */
function faNumber(value: number) {
  return value.toLocaleString('fa-IR');
}

export function StarRow({
  value,
  size = 14,
  className,
  showValue = false,
  count,
}: {
  value: number;
  size?: number;
  className?: string;
  /** Render «۴٫۲ از ۵» next to the stars. */
  showValue?: boolean;
  /** Review count, shown as « (۱۲ دیدگاه)». */
  count?: number;
}) {
  const rounded = Math.round(value);
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-amber-400', className)}>
      <span className="flex items-center gap-0.5" role="img" aria-label={`امتیاز ${faNumber(Math.round(value))} از ۵`}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            size={size}
            strokeWidth={1.6}
            fill={index < rounded ? 'currentColor' : 'none'}
            className={index < rounded ? '' : 'text-slate-300 dark:text-emerald-800'}
            aria-hidden="true"
          />
        ))}
      </span>
      {showValue && (
        <span className="ms-1 text-fluid-xs font-bold text-slate-600 dark:text-emerald-100">
          {value ? value.toLocaleString('fa-IR', { maximumFractionDigits: 1 }) : '—'}
        </span>
      )}
      {typeof count === 'number' && (
        <span className="text-fluid-2xs text-slate-400 dark:text-emerald-300">({faNumber(count)} دیدگاه)</span>
      )}
    </span>
  );
}

export function StarPicker({
  value,
  onChange,
  disabled = false,
  label = 'امتیاز شما به این محصول',
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${faNumber(star)} ستاره`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className={cn(
            'tap-target flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
            star <= value ? 'bg-amber-50 text-amber-400 dark:bg-amber-500/10' : 'text-slate-300 hover:text-amber-300 dark:text-emerald-800',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <Star size={18} fill={star <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
      <span className="ms-1 text-fluid-xs text-slate-500 dark:text-emerald-200">
        {value ? `${faNumber(value)} از ۵` : 'امتیاز ندهید اگر فقط سؤال دارید'}
      </span>
    </div>
  );
}

/**
 * The histogram next to the average: five bars, longest first, each clickable
 * so a shopper can jump to the reviews of that bucket.
 */
export function RatingBars({
  distribution,
  total,
  onSelect,
  activeBucket,
}: {
  distribution: Record<string, number>;
  total: number;
  onSelect?: (star: number) => void;
  activeBucket?: number | null;
}) {
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[String(star)] ?? 0;
        const share = total ? Math.round((count / total) * 100) : 0;
        const active = activeBucket === star;
        return (
          <button
            key={star}
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(star)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-start transition-colors',
              onSelect && 'hover:bg-emerald-50 dark:hover:bg-emerald-900/40',
              active && 'bg-emerald-50 dark:bg-emerald-900/50',
            )}
            aria-label={`نمایش دیدگاه‌های ${faNumber(star)} ستاره`}
          >
            <span className="w-8 shrink-0 text-fluid-2xs font-bold text-slate-500 dark:text-emerald-200">
              {faNumber(star)} ★
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-emerald-900">
              <span
                className="block h-full rounded-full bg-gradient-to-l from-amber-400 to-amber-300"
                style={{ width: `${share}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-end text-fluid-2xs text-slate-400">{faNumber(count)}</span>
          </button>
        );
      })}
    </div>
  );
}
