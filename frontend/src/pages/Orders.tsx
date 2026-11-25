// frontend/src/pages/Orders.tsx

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Package, XCircle } from 'lucide-react';

import { ordersApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { useAuthStore } from '../store/authStore';
import { money, nums } from '../lib/price';
import PageHead from '../components/shop/PageHead';
import { Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import type { Order } from '@/types/commerce';

/**
 * Whether the buyer may cancel this order *by themselves*.
 *
 * This mirrors `Order.cancel_and_restore_stock` on the server, which is the
 * authority: an unpaid order in `awaiting_review` or `confirmed` can be
 * cancelled, anything already paid needs a refund workflow, an in-flight
 * payment attempt has to resolve first, and a shipped or delivered order is
 * past the point. The page repeats those rules instead of showing a button
 * that comes back 409 — and the server still re-checks, because a stale page
 * must not be able to cancel a paid order.
 */
function canSelfCancel(order: Order): boolean {
  return (
    !['cancelled', 'delivered', 'shipped'].includes(order.status) &&
    order.payment_status !== 'paid' &&
    ['awaiting_review', 'confirmed'].includes(order.status)
  );
}

function selfCancelReason(order: Order): string | null {
  // Three states, not two: `null` means "may cancel", so an order that is
  // already cancelled has to say something — returning null there was how the
  // first version of this offered to cancel a cancelled order.
  if (order.status === 'cancelled') return 'این سفارش قبلاً لغو شده است.';
  if (order.payment_status !== 'paid' && order.status === 'delivered') {
    return 'سفارش تحویل شده است؛ برای مرجوعی با پشتیبانی تماس بگیرید.';
  }
  if (order.payment_status === 'paid') {
    return 'این سفارش پرداخت شده است؛ لغو آن به فرایند بازپرداخت نیاز دارد — با پشتیبانی تماس بگیرید.';
  }
  if (!['awaiting_review', 'confirmed'].includes(order.status)) {
    return 'این سفارش از مرحلهٔ لغو توسط خریدار گذشته است.';
  }
  return null;
}

/** The signed-in buyer's order history: one row per order, newest first. */
export default function Orders() {
  const isAuthed = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // `ordersApi.cancel` had no caller at all. It takes the order code and the
  // phone the order was placed with — not a session — which is why the row
  // can use it directly: the order object already carries both.
  const cancel = useMutation({
    mutationFn: async (order: Order) => (await ordersApi.cancel(order.code, order.phone)).data,
    onSuccess: () => {
      setConfirming(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (caught) => setError(parseApiError(caught).message),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await ordersApi.mine()).data,
    enabled: isAuthed,
    staleTime: 60 * 1000,
  });

  if (!isAuthed) {
    return (
      <div className="shell py-16">
        <EmptyState
          icon={Package}
          title="برای دیدن سفارش‌ها وارد شوید"
          description="سفارش‌های ثبت‌شده با حساب شما به این صفحه وصل می‌شوند. اگر مهمان خرید کرده‌اید، با کد سفارش پیگیری کنید."
          action={<Button to="/login" size="sm">ورود</Button>}
        />
      </div>
    );
  }

  const list = data ?? [];

  return (
    <div className="shell flex flex-col gap-5 py-8">
      <PageHead title="سفارش‌های من" lead="وضعیت هر سفارش و مبلغ نهایی آن. برای جزئیات ارسال، روی پیگیری بزنید." />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Package}
          title="هنوز سفارشی ثبت نشده"
          description="پس از نخستین خرید، همهٔ سفارش‌ها با وضعیت ارسالشان اینجا می‌مانند."
          action={<Button to="/products" size="sm">دیدن کالاها</Button>}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft"
            >
              <div className="min-w-0">
                <p className="dateline text-xs font-extrabold text-ink dark:text-white">سفارش {order.code}</p>
                <p className="mt-0.5 text-2xs text-ink-mute dark:text-white/45">
                  {order.status_label} · {nums(order.total_items)} قلم · {order.payment_status_label}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="dateline text-sm font-extrabold text-ink dark:text-white">{money(order.total_price)}</span>
                <Link
                  to={`/track?code=${order.code}`}
                  className="inline-flex min-h-9 items-center rounded-sm border border-line px-3 text-2xs font-bold text-brand-700 transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50 dark:border-night-line dark:text-brand-300 dark:hover:bg-night"
                >
                  پیگیری
                </Link>

                {canSelfCancel(order) && (
                  confirming === order.id ? (
                    <span className="flex items-center gap-1.5">
                      <Button
                        variant="danger"
                        size="sm"
                        loading={cancel.isPending}
                        onClick={() => cancel.mutate(order)}
                      >
                        بله، لغو کن
                      </Button>
                      <Button variant="quiet" size="sm" onClick={() => setConfirming(null)}>
                        نه
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="quiet"
                      size="sm"
                      icon={XCircle}
                      onClick={() => {
                        setError(null);
                        setConfirming(order.id);
                      }}
                    >
                      لغو سفارش
                    </Button>
                  )
                )}
              </div>

              {/* Says why there is no button, rather than leaving the buyer to
                  guess or to call support to find out. */}
              {!canSelfCancel(order) && selfCancelReason(order) && (
                <p className="basis-full text-[11px] leading-5 text-ink-mute dark:text-white/40">
                  {selfCancelReason(order)}
                </p>
              )}
              {confirming === order.id && (
                <p className="basis-full text-[11px] leading-5 text-ink-mute dark:text-white/40">
                  با لغو، موجودی رزروشدهٔ این سفارش آزاد می‌شود و لغو قابل بازگشت نیست.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-2xs font-bold text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}
