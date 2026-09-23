// frontend/src/components/listing/StockBadge.tsx
//
// The «موجودی محدود» badge — a fact a buyer can act on before the checkout
// wall: the listing has fewer than LOW_STOCK_THRESHOLD units left. Sellers with
// healthy stock stay badge-free, because a badge that fires everywhere stops
// being read (the same lesson the «نو» badge taught this codebase).

import { AlertTriangle } from 'lucide-react';

/** Below this many units the listing counts as running out. */
export const LOW_STOCK_THRESHOLD = 10;

export function isLowStock(quantityAvailable: string | number): boolean {
  const n = Number(quantityAvailable);
  return Number.isFinite(n) && n > 0 && n < LOW_STOCK_THRESHOLD;
}

export default function StockBadge({
  quantityAvailable,
  className = '',
}: {
  quantityAvailable: string | number;
  className?: string;
}) {
  if (!isLowStock(quantityAvailable)) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-fluid-2xs font-bold text-amber-900 ring-1 ring-amber-300 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/40 ${className}`}
      title={`${LOW_STOCK_THRESHOLD} واحد یا کمتر باقی مانده است`}
    >
      <AlertTriangle size={11} aria-hidden="true" />
      موجودی محدود
    </span>
  );
}
