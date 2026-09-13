// frontend/src/components/shop/FilterPopover.tsx
//
// One dropdown button and its panel — the whole shop filter bar is built from
// these, in both of its tabs.
//
// The bar used to be rows of chips: «مرتب‌سازی:» followed by seven pills, then
// «برند:» with another dozen. On a phone that is four horizontal scrollers before
// any product, and on a desktop it pushes the grid below the fold. The catalogue
// is deep, but a filter bar doesn't have to be: each axis is now a button that
// opens only what it needs, and the button itself says what is selected.
//
// The button deliberately reuses the navigation dropdown's shape (min-h-11,
// rounded, a chevron that turns) so the header reads as one interface rather than
// a widget per page.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '../../utils/cn';

export interface FacetOption {
  value: string;
  label: string;
  count?: number;
  /** Which department this row belongs to, for dependent dropdowns. */
  category?: string;
}

/** Close on anything outside the button+panel, and on Escape. */
function useDismissable(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return ref;
}

export function FilterShell({
  label,
  summary,
  active,
  badge,
  align = 'start',
  width = 'w-72',
  children,
  render,
}: {
  label: string;
  /** What the button prints instead of the axis name when something is picked. */
  summary?: string;
  active: boolean;
  /** How many values are selected, shown as a count chip. */
  badge?: number;
  align?: 'start' | 'end';
  width?: string;
  children: ReactNode;
  /** Panels that need the open state (a "همه" row that closes them) get a render prop. */
  render?: (state: { open: boolean; close: () => void }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable(open, () => setOpen(false));
  const panelId = useId();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-fluid-xs font-bold transition-colors',
          active
            ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/60 dark:text-lime-200'
            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:border-emerald-600',
        )}
      >
        <span className="min-w-0 truncate">{summary || label}</span>
        {badge ? (
          <span className="rounded-full bg-emerald-600 px-1.5 text-fluid-2xs font-extrabold leading-5 text-white">
            {badge.toLocaleString('fa-IR')}
          </span>
        ) : null}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn('shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className={cn(
            'absolute z-40 mt-2 max-h-[min(70vh,26rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-emerald-800 dark:bg-[#06301f]',
            align === 'end' ? 'end-0' : 'start-0',
            width,
          )}
        >
          {render ? render({ open, close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}

/**
 * A multi-select facet: categories, brands, packages.
 *
 * Several values are the point — «کود و سم»، «دو برند برای مقایسه» — so a tick
 * adds to the selection and a second tick on the same row removes it, with the
 * panel staying open. Closing is the buyer's business, not the widget's.
 */
export function MultiSelectFacet({
  label,
  options,
  selected,
  onToggle,
  onClear,
  searchable = true,
  emptyHint = 'موردی برای نمایش نیست.',
  footer,
}: {
  label: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  searchable?: boolean;
  emptyHint?: string;
  footer?: ReactNode;
}) {
  const [term, setTerm] = useState('');
  const visible = term.trim()
    ? options.filter((option) => option.label.toLowerCase().includes(term.trim().toLowerCase()))
    : options;

  return (
    <FilterShell
      label={label}
      active={selected.length > 0}
      badge={selected.length}
      summary={selected.length === 1 ? options.find((o) => o.value === selected[0])?.label || label : undefined}
    >
      {searchable && options.length > 7 && (
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={`جست‌وجو در ${label}`}
          aria-label={`جست‌وجو در ${label}`}
          className="mb-2 min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-fluid-xs font-semibold outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50"
        />
      )}

      <ul className="space-y-0.5">
        {visible.map((option) => {
          const isChecked = selected.includes(option.value);
          return (
            <li key={option.value}>
              <button
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                onClick={() => onToggle(option.value)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-start text-fluid-xs font-bold transition-colors',
                  isChecked
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/60 dark:text-lime-200'
                    : 'text-slate-600 hover:bg-slate-50 dark:text-emerald-100 dark:hover:bg-emerald-900/40',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                    isChecked
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-300 dark:border-emerald-700',
                  )}
                >
                  {isChecked ? <Check size={13} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {typeof option.count === 'number' && option.count > 0 && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-fluid-2xs text-slate-500 dark:bg-emerald-900 dark:text-emerald-200">
                    {option.count.toLocaleString('fa-IR')}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-2 py-3 text-fluid-xs text-slate-500 dark:text-emerald-300/70">{emptyHint}</li>
        )}
      </ul>

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-emerald-800/70">
        {footer}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-9 rounded-lg px-2 text-fluid-2xs font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            برداشتن همه ({selected.length.toLocaleString('fa-IR')})
          </button>
        )}
      </div>
    </FilterShell>
  );
}
