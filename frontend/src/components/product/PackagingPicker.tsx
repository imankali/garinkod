// frontend/src/components/product/PackagingPicker.tsx
//
// Which bag am I buying, and what does that bag actually promise?
//
// A 1 kg pouch and a 50 kg bag are the same input at two unit economics, and the
// only honest way to sell both is to price, stock and date them separately. This
// component is the picker plus the facts of the row that is selected: price per
// unit, remaining stock, the minimum order, the declared expiry and the bulk rule.
// Nothing here is decorative — with a single declared packaging it returns only
// that packaging's facts, and with none at all the caller hides it.

import { CalendarClock, Package, Scale, TriangleAlert } from 'lucide-react';

import { formatPrice } from '../../utils/formatPrice';
import { cn } from '../../utils/cn';
import type { ProductPackage } from '../../types';

function fa(value: number) {
  return value.toLocaleString('fa-IR');
}

function expiryLabel(days: number | null): { text: string; urgent: boolean } | null {
  if (days === null || days === undefined) return null;
  if (days < 0) return { text: `${fa(Math.abs(days))} روز از تاریخ انقضای اعلام‌شده گذشته است`, urgent: true };
  if (days <= 90) return { text: `${fa(days)} روز تا تاریخ انقضا`, urgent: true };
  return { text: `${fa(days)} روز تا تاریخ انقضا`, urgent: false };
}

export default function PackagingPicker({
  packages,
  selected,
  onSelect,
}: {
  packages: ProductPackage[];
  selected: ProductPackage | null;
  onSelect: (id: number | null) => void;
}) {
  const multiple = packages.length > 1;
  const expiry = selected ? expiryLabel(selected.expiry_days_left ?? null) : null;

  return (
    <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-emerald-900 dark:bg-emerald-950/40">
      {multiple && (
        <>
          <p className="mb-2 flex items-center gap-1.5 text-fluid-2xs font-bold text-slate-500 dark:text-emerald-200">
            <Package size={13} aria-hidden="true" /> بسته‌بندی
          </p>
          <div className="no-scrollbar flex flex-wrap gap-2" role="radiogroup" aria-label="انتخاب بسته‌بندی">
            {packages.map((item) => {
              const active = item.id === selected?.id;
              return (
                <button
                  key={item.id ?? item.label}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!item.is_in_stock}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    'flex min-h-11 flex-col items-start gap-0.5 rounded-xl border px-3 py-1.5 text-start transition',
                    active
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
                    !item.is_in_stock && 'cursor-not-allowed opacity-45',
                  )}
                >
                  <span className="text-fluid-xs font-bold">{item.label}</span>
                  <span className={cn('text-fluid-2xs', active ? 'text-emerald-50' : 'text-slate-400 dark:text-emerald-300')}>
                    {item.is_in_stock ? `${formatPrice(item.discounted_price)} تومان` : 'ناموجود'}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-fluid-2xs font-bold text-slate-500 dark:text-emerald-200">
        {selected?.price_per_kg ? (
          <li className="inline-flex items-center gap-1">
            <Scale size={13} aria-hidden="true" />
            هر واحد: <span className="text-slate-800 dark:text-white">{formatPrice(selected.price_per_kg)} تومان</span>
          </li>
        ) : null}
        <li className="inline-flex items-center gap-1">
          <Package size={13} aria-hidden="true" />
          موجودی این بسته: <span className="text-slate-800 dark:text-white">{fa(selected?.effective_stock ?? 0)} عدد</span>
        </li>
        {(selected?.min_order_quantity ?? 1) > 1 && (
          <li className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
            <TriangleAlert size={13} aria-hidden="true" />
            حداقل سفارش: {fa(selected?.min_order_quantity ?? 1)} عدد
          </li>
        )}
        {expiry && (
          <li className={cn('inline-flex items-center gap-1', expiry.urgent ? 'text-rose-600 dark:text-rose-300' : '')}>
            <CalendarClock size={13} aria-hidden="true" />
            {expiry.text}
          </li>
        )}
      </ul>

      {selected?.bulk_note && (
        <p className="mt-2.5 rounded-xl bg-amber-50 p-3 text-fluid-2xs leading-6 text-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {selected.bulk_note}
        </p>
      )}
    </div>
  );
}
