// frontend/src/pages/Orders.tsx

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Package } from 'lucide-react';

import { ordersApi } from '../api/services';
import { useAuthStore } from '../store/authStore';
import { money, nums } from '../lib/price';
import PageHead from '../components/shop/PageHead';
import { Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';

/** The signed-in buyer's order history: one row per order, newest first. */
export default function Orders() {
  const isAuthed = useAuthStore((state) => state.isAuthenticated);

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
              <div className="flex items-center gap-3">
                <span className="dateline text-sm font-extrabold text-ink dark:text-white">{money(order.total_price)}</span>
                <Link
                  to={`/track?code=${order.code}`}
                  className="inline-flex min-h-9 items-center rounded-sm border border-line px-3 text-2xs font-bold text-brand-700 transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50 dark:border-night-line dark:text-brand-300 dark:hover:bg-night"
                >
                  پیگیری
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
