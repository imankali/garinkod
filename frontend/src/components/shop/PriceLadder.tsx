import { useMemo } from 'react';
import { ArrowDown, Check } from 'lucide-react';

import { formatPrice } from '../../utils/formatPrice';
import type { PriceTier } from '../../types/shop';

type Props = {
  tiers: PriceTier[];
  /** The price of a single unit before any ladder, in تومان. */
  basePrice: number;
  /** What is in the cart right now; the row the buyer is on gets marked. */
  quantity?: number;
};

/**
 * The quantity ladder, written as prices rather than percentages.
 *
 * «۴۰ عدد → ۱۲٪ تخفیف» asks the buyer to do arithmetic on a number they are
 * being asked to trust, usually on a phone, usually standing in a field. This
 * table does the arithmetic and shows the answer: the unit price at each rung
 * and what it comes to for that many units. That is the whole reason
 * `PriceTierSerializer` carries `unit_price` instead of making the client
 * derive it.
 *
 * Two things this is careful about:
 *
 * 1. THE PRICE SHOWN IS THE PRICE CHARGED. `unit_price` comes from the same
 *    server property the cart uses. Both of the bugs found while building this
 *    feature were exactly a ladder that promised one number while checkout took
 *    another, so the client is not allowed to recompute it.
 *
 * 2. THE RUNGS DO NOT STACK. Only the highest rung the quantity reaches applies.
 *    The rows below the buyer's current quantity are therefore marked as reached
 *    rather than as additional savings, and the copy says «به‌جای» (instead of)
 *    rather than «علاوه بر» (on top of).
 */
export default function PriceLadder({ tiers, basePrice, quantity }: Props) {
  const rungs = useMemo(
    () => [...tiers].sort((a, b) => a.min_quantity - b.min_quantity),
    [tiers],
  );

  if (rungs.length === 0) return null;

  // The rung in force right now: the highest threshold the cart has reached.
  const reachedIndex = rungs.reduce(
    (best, rung, index) =>
      typeof quantity === 'number' && quantity >= rung.min_quantity ? index : best,
    -1,
  );

  return (
    <section
      aria-labelledby="price-ladder-heading"
      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/60"
    >
      <h3
        id="price-ladder-heading"
        className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800 dark:text-white"
      >
        <ArrowDown size={15} aria-hidden="true" className="text-emerald-600 dark:text-lime-300" />
        تخفیف پلکانی
      </h3>
      <p className="mt-1 text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-200">
        هرچه تعداد بیشتر، قیمت هر واحد کمتر. فقط بالاترین پلهٔ رسیده اعمال می‌شود؛ پله‌ها با هم جمع نمی‌شوند.
      </p>

      <table className="mt-3 w-full text-start text-fluid-xs">
        <caption className="sr-only">
          جدول قیمت بر پایهٔ تعداد سفارش
        </caption>
        <thead>
          <tr className="text-fluid-2xs text-slate-500 dark:text-emerald-300">
            <th scope="col" className="pb-1.5 text-start font-bold">تعداد</th>
            <th scope="col" className="pb-1.5 text-start font-bold">قیمت هر واحد</th>
            <th scope="col" className="pb-1.5 text-start font-bold">سود نسبت به تک‌فروشی</th>
          </tr>
        </thead>
        <tbody>
          {rungs.map((rung, index) => {
            const reached = index === reachedIndex;
            const savingPerUnit = Math.max(0, basePrice - rung.unit_price);
            return (
              <tr
                key={rung.id ?? rung.min_quantity}
                className={
                  reached
                    ? 'border-t border-emerald-200 bg-emerald-50 font-extrabold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/60 dark:text-lime-200'
                    : 'border-t border-slate-200/70 text-slate-700 dark:border-emerald-900 dark:text-emerald-100'
                }
              >
                <th scope="row" className="py-1.5 text-start font-bold">
                  <span className="inline-flex items-center gap-1">
                    {reached && <Check size={12} aria-hidden="true" />}
                    {/* «و بیشتر» only on the last rung — the one with no ceiling. */}
                    {rung.min_quantity.toLocaleString('fa-IR')}
                    {index === rungs.length - 1 ? ' و بیشتر' : ''}
                  </span>
                </th>
                <td className="py-1.5">{formatPrice(rung.unit_price)}</td>
                <td className="py-1.5">
                  {savingPerUnit > 0 ? (
                    <span className="text-emerald-700 dark:text-lime-300">
                      {formatPrice(savingPerUnit * rung.min_quantity)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
