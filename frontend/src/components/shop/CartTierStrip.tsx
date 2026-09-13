import { ArrowDown, Sparkles } from 'lucide-react';

import { formatPrice } from '../../utils/formatPrice';

type Props = {
  quantity: number;
  baseUnitPrice?: number;
  tierDiscountPercent?: number;
  tierSaving?: number;
  nextTier?: {
    min_quantity: number;
    discount_percent: number;
    unit_price: number;
  } | null;
  /** Called with the absolute quantity, not a delta. */
  onSetQuantity?: (quantity: number) => void;
  /** Stock ceiling; the nudge is suppressed when it cannot be honoured. */
  availableQuantity?: number;
};

/**
 * The one line in a cart row that tells the buyer what the ladder is doing.
 *
 * It exists because a quantity discount the buyer has to go and look up on the
 * product page does not change how much anyone orders. The cart is the last
 * place the number can be changed, so it is the only place a nudge actually
 * converts.
 *
 * Three things this is deliberately careful about:
 *
 * 1. **IT STATES A PRICE, NOT A PERCENTAGE.** "۵ عدد دیگر، هر واحد ۹۰۰ تومان"
 *    is a decision the buyer can make. "۵ عدد دیگر، ۱۰٪" is arithmetic. The
 *    unit price comes from the server, computed off the same property the cart
 *    charges — see the pricing invariants in AGENTS.md; two separate bugs in
 *    this feature were a ladder that promised one number while checkout took
 *    another.
 *
 * 2. **IT DOES NOT NUDGE INTO UNAVAILABLE STOCK.** A row with 3 left cannot
 *    honestly offer "add 20". The nudge is suppressed when the next rung is out
 *    of reach, because a promise the site cannot keep is worse than no promise.
 *
 * 3. **IT DOES NOT IMPLY THE RUNGS STACK.** Copy says «به‌جای» (instead of) and
 *    the saving shown is against the base price, not added to an earlier rung.
 */
export default function CartTierStrip({
  quantity,
  baseUnitPrice,
  tierDiscountPercent = 0,
  tierSaving = 0,
  nextTier,
  onSetQuantity,
  availableQuantity,
}: Props) {
  const reached = tierDiscountPercent > 0;
  const shortfall = nextTier ? nextTier.min_quantity - quantity : 0;
  const reachable =
    nextTier != null &&
    shortfall > 0 &&
    (availableQuantity == null || nextTier.min_quantity <= availableQuantity);

  if (!reached && !reachable) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-fluid-2xs leading-5">
      {reached && (
        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-lime-300">
          <Sparkles size={11} aria-hidden="true" />
          {tierDiscountPercent.toLocaleString('fa-IR')}٪ تخفیف پلکانی
          {tierSaving > 0 && (
            <span className="font-normal text-emerald-600 dark:text-emerald-200">
              · {formatPrice(tierSaving)} سود
            </span>
          )}
        </span>
      )}

      {reachable && nextTier && (
        <span className="inline-flex flex-wrap items-center gap-x-1 text-slate-500 dark:text-emerald-200">
          <ArrowDown size={11} aria-hidden="true" className="text-emerald-600 dark:text-lime-300" />
          {/* The number of additional units, and the price each would cost. */}
          <strong className="font-extrabold text-slate-700 dark:text-emerald-100">
            {shortfall.toLocaleString('fa-IR')} عدد دیگر
          </strong>
          <span>·</span>
          <span>
            هر واحد{' '}
            <strong className="font-extrabold text-emerald-700 dark:text-lime-300">
              {formatPrice(nextTier.unit_price)}
            </strong>{' '}
            به‌جای {baseUnitPrice != null ? formatPrice(baseUnitPrice) : '—'}
          </span>
          {onSetQuantity && (
            <button
              type="button"
              onClick={() => onSetQuantity(nextTier.min_quantity)}
              className="ms-1 rounded-lg border border-emerald-200 px-2 py-0.5 font-bold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-emerald-800 dark:text-lime-300 dark:hover:bg-emerald-900/60"
            >
              برو به {nextTier.min_quantity.toLocaleString('fa-IR')}
            </button>
          )}
        </span>
      )}
    </div>
  );
}
