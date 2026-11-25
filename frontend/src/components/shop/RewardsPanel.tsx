// frontend/src/components/shop/RewardsPanel.tsx
//
// The rewards a buyer has actually earned, on the account page.
//
// Everything here already existed on the server and was invisible:
//   • `wallet/me/` returns the loyalty points and the real-money balance with
//     its ledger; nothing rendered either.
//   • `rewards/me/` returns the single-use coupons `mark_order_paid_and_reward`
//     issues on every paid order; nothing rendered them.
//   • `levels/` explains what the viewer's level unlocks and what the next step
//     is; the account page only used it for a phone-verification hint.
//
// Two numbers that look alike are kept apart on purpose. Points are a loyalty
// ledger redeemed at 100 points = ۱۰٬۰۰۰ toman at checkout, and they are *not*
// money. The wallet balance is real money with its own transactions. A buyer who
// reads one as the other will feel cheated at the checkout, so they are two
// separate figures with their own sentences, and neither is labelled «اعتبار».

import { useQuery } from '@tanstack/react-query';
import { Award, Coins, Ticket } from 'lucide-react';

import { levelsApi, rewardsApi } from '../../api/services';
import type { Coupon } from '@/types/commerce';
import { date } from '../../lib/date';
import { money, nums } from '../../lib/price';
import { Skeleton } from '../ui/Skeleton';

/** Mirrors `Wallet.LOYALTY_POINTS_UNIT` / `LOYALTY_UNIT_VALUE` on the server. */
export const POINTS_PER_UNIT = 100;
export const TOMAN_PER_UNIT = 10_000;

/**
 * What a points balance is worth at checkout.
 *
 * The server rounds down to whole units and never discounts past the payable
 * amount; a viewer with ۳۰۰ points can therefore redeem ۳۰٬۰۰۰ toman, and a
 * viewer with ۹۹ points can redeem nothing. Printing «۱۰۰ امتیاز = ۱۰٬۰۰۰ تومان»
 * without that floor would promise a discount the checkout refuses to give.
 */
export function pointsValue(points: number): number {
  return Math.floor(points / POINTS_PER_UNIT) * TOMAN_PER_UNIT;
}

function couponValue(coupon: Coupon): string {
  if (coupon.discount_type === 'fixed') return money(coupon.discount_value);
  const percent = `${nums(coupon.discount_value)}٪`;
  return coupon.max_discount_amount ? `${percent} تا سقف ${money(coupon.max_discount_amount)}` : percent;
}

export default function RewardsPanel() {
  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => (await rewardsApi.wallet()).data,
    staleTime: 2 * 60 * 1000,
  });

  const coupons = useQuery({
    queryKey: ['my-coupons'],
    queryFn: async () => (await rewardsApi.myCoupons()).data,
    staleTime: 2 * 60 * 1000,
  });

  const levels = useQuery({
    queryKey: ['levels'],
    queryFn: async () => (await levelsApi.snapshot()).data,
    staleTime: 10 * 60 * 1000,
  });

  const points = wallet.data?.loyalty_points ?? 0;
  const worth = pointsValue(points);
  const available: Coupon[] = coupons.data ?? [];

  return (
    <section
      aria-labelledby="rewards-title"
      className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft"
    >
      <div className="flex items-center justify-between">
        <h2 id="rewards-title" className="text-sm font-extrabold text-ink dark:text-white">
          امتیاز و پاداش
        </h2>
        {levels.data?.viewer_rank && (
          <span className="rounded-sm bg-brand-50 px-2 py-1 text-2xs font-bold text-brand-800 dark:bg-night dark:text-brand-300">
            {levels.data.viewer_rank.short_label}
          </span>
        )}
      </div>

      {wallet.isLoading ? (
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-line p-3 dark:border-night-line">
            <p className="flex items-center gap-1.5 text-2xs font-bold text-ink-mute dark:text-white/50">
              <Award size={12} aria-hidden="true" />
              امتیاز وفاداری
            </p>
            <p className="dateline mt-1 text-xl font-extrabold text-ink dark:text-white">
              {nums(points)}
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-ink-mute dark:text-white/45">
              {worth > 0
                ? `در پرداخت بعدی، تا ${money(worth)} تخفیف می‌گیرید.`
                : `برای تخفیف، ${nums(POINTS_PER_UNIT - (points % POINTS_PER_UNIT))} امتیاز دیگر لازم است.`}
            </p>
          </div>

          <div className="rounded-md border border-line p-3 dark:border-night-line">
            <p className="flex items-center gap-1.5 text-2xs font-bold text-ink-mute dark:text-white/50">
              <Coins size={12} aria-hidden="true" />
              موجودی کیف پول
            </p>
            <p className="dateline mt-1 text-xl font-extrabold text-ink dark:text-white">
              {money(wallet.data?.balance ?? 0)}
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-ink-mute dark:text-white/45">
              بازگشت وجه و پاداش نقدی، جدا از امتیازها.
            </p>
          </div>
        </div>
      )}

      {/* The ladder's next rung, in the server's own words. */}
      {levels.data?.next_step && (
        <p className="mt-3 rounded-md border border-line bg-paper p-3 text-2xs leading-6 text-ink-soft dark:border-night-line dark:bg-night dark:text-white/60">
          <strong className="font-extrabold text-ink dark:text-white">
            یک پله بالاتر: {levels.data.next_step.label}
          </strong>
          <span className="block mt-0.5">{levels.data.next_step.how}</span>
        </p>
      )}

      <h3 className="mt-4 flex items-center gap-1.5 text-2xs font-extrabold text-ink dark:text-white">
        <Ticket size={12} aria-hidden="true" />
        کوپن‌های من
      </h3>
      {coupons.isLoading ? (
        <Skeleton className="mt-2 h-12" />
      ) : available.length === 0 ? (
        <p className="mt-2 text-2xs leading-6 text-ink-mute dark:text-white/45">
          هنوز کوپنی ندارید. با هر خرید موفق، یک کوپن خرید بعدی صادر می‌شود.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line dark:divide-night-line">
          {available.map((coupon) => (
            <li key={coupon.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p dir="ltr" className="dateline text-xs font-extrabold text-ink dark:text-white">
                  {coupon.code}
                </p>
                <p className="mt-0.5 text-2xs text-ink-mute dark:text-white/45">
                  {coupon.description || 'کوپن تخفیف'}
                  {coupon.min_order_amount > 0 && ` · از ${money(coupon.min_order_amount)} به بالا`}
                </p>
              </div>
              <div className="text-end">
                <p className="text-2xs font-extrabold text-brand-800 dark:text-brand-300">
                  {couponValue(coupon)}
                </p>
                {coupon.valid_until && (
                  <p className="dateline mt-0.5 text-[11px] text-ink-mute dark:text-white/40">
                    تا {date(coupon.valid_until)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <p className="mt-2 text-[11px] leading-5 text-ink-mute dark:text-white/45">
          کد کوپن را در صفحهٔ پرداخت، در فیلد «کد تخفیف» وارد کنید.
        </p>
      )}
    </section>
  );
}
