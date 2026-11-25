// frontend/src/components/ui/Price.tsx

import { cn } from '../../lib/cn';
import { money, percent, priceOf } from '../../lib/price';

/**
 * The price block on a card or a line item.
 *
 * One line: the price you pay, in the weight that makes it findable. The
 * struck original sits beside it, smaller and muted, and the discount is
 * stated as a number — never as a colour, a badge, or a "deal" graphic.
 * Quote-only products say «تماس بگیرید» rather than showing a stale figure
 * the shop cannot honour.
 */
export default function Price({
  product,
  size = 'md',
  className,
}: {
  product: {
    price: number;
    discounted_price?: number | null;
    discount_percent?: number | null;
    price_on_request?: boolean | null;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { quote, current, was, off } = priceOf(product);

  if (quote) {
    return (
      <p className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
        <span
          className={cn(
            'font-extrabold text-ink dark:text-white',
            size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-base',
          )}
        >
          تماس بگیرید
        </span>
        <span className="text-2xs text-ink-mute dark:text-white/50">قیمت استعلامی</span>
      </p>
    );
  }

  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span
        className={cn(
          'dateline font-extrabold text-ink dark:text-white',
          size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-base',
        )}
      >
        {money(current)}
      </span>
      {was !== null && (
        <>
          <span className="dateline text-2xs text-ink-mute line-through decoration-ink-mute/50 dark:text-white/40">
            {money(was)}
          </span>
          <span className="rounded-sm bg-gold-100 px-1.5 py-0.5 text-2xs font-bold text-gold-700 dark:bg-gold-700/20 dark:text-gold-100">
            {percent(off)}
          </span>
        </>
      )}
    </p>
  );
}
