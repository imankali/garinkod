// frontend/src/pages/Orders.tsx

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Package,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  ShoppingBag,
  Store,
  Truck,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { ordersApi, paymentsApi } from '../api/services';
import { parseApiError, type FieldErrors } from '../api/errors';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import type { Order } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { toEnglishDigits, normalizePhoneNumber } from '../utils/normalizeDigits';

/** Colour per order status, so state is readable at a glance. */
const STATUS_TONE: Record<string, string> = {
  awaiting_review: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100',
  confirmed: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-100',
  preparing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-100',
  shipped: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-100',
  delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-lime-200',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
};

const PAYMENT_TONE: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-lime-200',
  unpaid: 'bg-slate-100 text-slate-600 dark:bg-emerald-900 dark:text-emerald-100',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100',
  refunded: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
};

const ORDER_STEPS = [
  { key: 'awaiting_review', label: 'ثبت سفارش', icon: ClipboardList },
  { key: 'confirmed', label: 'تأیید سفارش', icon: CheckCircle2 },
  { key: 'preparing', label: 'آماده‌سازی', icon: Package },
  { key: 'shipped', label: 'ارسال', icon: Truck },
  { key: 'delivered', label: 'تحویل', icon: PackageCheck },
];

function getStepIndex(status: string): number {
  switch (status) {
    case 'awaiting_review':
      return 0;
    case 'confirmed':
      return 1;
    case 'preparing':
      return 2;
    case 'shipped':
      return 3;
    case 'delivered':
      return 4;
    default:
      return -1;
  }
}

function OrderTimelineStepper({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <div className="my-3 flex items-center gap-2 rounded-2xl bg-rose-50 p-3.5 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
        <XCircle size={18} className="shrink-0 text-rose-600 dark:text-rose-400" />
        <span>این سفارش لغو شده است و موجودی کالا به انبار بازگردانده شده است.</span>
      </div>
    );
  }

  const currentIndex = getStepIndex(status);

  return (
    <div className="my-4 rounded-2xl bg-slate-50/80 p-3.5 dark:bg-emerald-900/30">
      <div className="relative flex items-center justify-between">
        {/* Progress bar background */}
        <div className="absolute inset-x-4 top-4 h-1 -translate-y-1/2 bg-slate-200 dark:bg-emerald-800" />
        {/* Active progress fill */}
        <div
          className="absolute start-4 top-4 h-1 -translate-y-1/2 bg-emerald-600 transition-all duration-500 dark:bg-lime-400"
          style={{
            width: currentIndex >= 0 ? `${(currentIndex / (ORDER_STEPS.length - 1)) * 90}%` : '0%',
          }}
        />

        {ORDER_STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const Icon = step.icon;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300 ${
                  isDone
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : isCurrent
                      ? 'border-emerald-600 bg-white text-emerald-700 ring-4 ring-emerald-100 dark:border-lime-400 dark:bg-emerald-950 dark:text-lime-300 dark:ring-emerald-900'
                      : 'border-slate-200 bg-white text-slate-400 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
                title={step.label}
              >
                {isDone ? <Check size={14} /> : <Icon size={14} />}
              </div>
              <span
                className={`mt-1.5 text-center text-fluid-2xs font-bold sm:text-fluid-xs ${
                  isCurrent
                    ? 'text-emerald-700 dark:text-lime-300'
                    : isDone
                      ? 'text-slate-700 dark:text-white'
                      : 'text-slate-400 dark:text-emerald-400/60'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Orders() {
  const { isAuthenticated } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [code, setCode] = useState(() => localStorage.getItem('last_order_code') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('last_order_phone') || '');
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [restartingOrderId, setRestartingOrderId] = useState<number | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    ordersApi
      .mine()
      .then((response) => setMyOrders(response.data))
      .catch(() => undefined);
  }, [isAuthenticated]);

  useEffect(() => {
    const result = searchParams.get('payment');
    const returnedCode = searchParams.get('order');
    if (!result) return;
    if (returnedCode) {
      setCode(returnedCode);
      localStorage.setItem('last_order_code', returnedCode);
    }
    if (result === 'success' || result === 'already_paid') {
      toast.success(result === 'success' ? 'پرداخت با موفقیت تأیید شد.' : 'این پرداخت قبلاً تأیید شده بود.');
    } else if (result === 'cancelled') {
      toast.error('پرداخت در درگاه لغو شد؛ سفارش شما همچنان قابل پیگیری است.');
    } else {
      toast.error('تأیید پرداخت انجام نشد. پیش از تلاش مجدد وضعیت سفارش را بررسی کنید.');
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  async function restartPayment(order: Order) {
    setRestartingOrderId(order.id);
    try {
      const response = await paymentsApi.restartZarinpal(order.code, order.phone);
      window.location.assign(response.data.payment.checkout_url);
    } catch (error) {
      toast.error(parseApiError(error).message);
      setRestartingOrderId(null);
    }
  }

  async function cancel(order: Order) {
    if (!window.confirm('آیا از لغو این سفارش مطمئن هستید؟ موجودی رزروشده آزاد می‌شود.')) return;
    try {
      const response = await ordersApi.cancel(order.code, order.phone);
      setFoundOrder((current) => (current?.id === order.id ? response.data.order : current));
      setMyOrders((current) =>
        current.map((item) => (item.id === order.id ? response.data.order : item)),
      );
      toast.success(response.data.message);
    } catch {
      // The API client explains why this order cannot be cancelled.
    }
  }

  async function lookup(event: FormEvent) {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    if (!code.trim()) nextErrors.code = 'کد سفارش را وارد کنید.';
    if (!phone.trim()) nextErrors.phone = 'شماره تماس را وارد کنید.';
    setErrors(nextErrors);
    setLookupError('');
    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(`track-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }

    setLoading(true);
    try {
      const response = await ordersApi.lookup(code, phone);
      setFoundOrder(response.data);
      localStorage.setItem('last_order_code', code.toUpperCase());
      localStorage.setItem('last_order_phone', phone);
    } catch (error) {
      setFoundOrder(null);
      const parsed = parseApiError(error);
      setLookupError(
        parsed.status === 404 ? 'سفارشی با این کد و شماره تماس پیدا نشد.' : parsed.message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell py-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-fluid-sm font-bold text-emerald-700 dark:text-lime-300">
            پیگیری شفاف سفارش
          </p>
          <h1 className="mt-1 text-fluid-2xl font-extrabold text-slate-800 dark:text-white">
            سفارش‌های من
          </h1>
        </div>
        <Button to="/products" variant="secondary" icon={ShoppingBag}>
          بازگشت به محصولات
        </Button>
      </header>

      {/* Guest tracking */}
      <section className="mt-7 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
            <PackageSearch size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-fluid-base font-extrabold text-slate-800 dark:text-white">
              پیگیری سفارش مهمان
            </h2>
            <p className="text-fluid-xs text-slate-500 dark:text-emerald-200">
              کد سفارش و همان شماره‌ای که هنگام ثبت وارد کردید را بنویسید.
            </p>
          </div>
        </div>

        <form onSubmit={lookup} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <div>
            <label htmlFor="track-code" className="mb-1 block text-fluid-xs font-bold text-slate-600 dark:text-emerald-100">
              کد سفارش
            </label>
            <input
              id="track-code"
              required
              dir="ltr"
              value={code}
              onChange={(event) => setCode(toEnglishDigits(event.target.value).toUpperCase().trim())}
              placeholder="GK-..."
              aria-invalid={Boolean(errors.code)}
              aria-describedby={errors.code ? 'track-code-error' : undefined}
              className={`min-h-11 w-full rounded-xl border bg-white px-3 text-fluid-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-900 dark:text-white ${
                errors.code ? 'border-rose-400' : 'border-slate-200 dark:border-emerald-700'
              }`}
            />
            {errors.code && (
              <p id="track-code-error" role="alert" className="mt-1 text-fluid-2xs font-semibold text-rose-600">
                {errors.code}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="track-phone" className="mb-1 block text-fluid-xs font-bold text-slate-600 dark:text-emerald-100">
              شماره تماس
            </label>
            <input
              id="track-phone"
              required
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(normalizePhoneNumber(event.target.value))}
              placeholder="۰۹۱۲..."
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'track-phone-error' : undefined}
              className={`min-h-11 w-full rounded-xl border bg-white px-3 text-fluid-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-900 dark:text-white ${
                errors.phone ? 'border-rose-400' : 'border-slate-200 dark:border-emerald-700'
              }`}
            />
            {errors.phone && (
              <p id="track-phone-error" role="alert" className="mt-1 text-fluid-2xs font-semibold text-rose-600">
                {errors.phone}
              </p>
            )}
          </div>

          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <Button type="submit" loading={loading} icon={RefreshCw} fullWidth className="lg:w-auto">
              پیگیری
            </Button>
          </div>
        </form>

        {lookupError && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-fluid-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {lookupError}
          </p>
        )}
      </section>

      {foundOrder && <OrderCard order={foundOrder} className="mt-6" onCancel={cancel} onRestartPayment={restartPayment} restarting={restartingOrderId === foundOrder.id} />}

      {/* Signed-in history */}
      {isAuthenticated && (
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="text-emerald-600" aria-hidden="true" />
            <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">
              سفارش‌های حساب کاربری
            </h2>
          </div>

          {myOrders.length ? (
            <div className="space-y-4">
              {myOrders.map((order) => (
                <OrderCard key={order.id} order={order} onCancel={cancel} onRestartPayment={restartPayment} restarting={restartingOrderId === order.id} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-fluid-sm text-slate-400 dark:border-emerald-800 dark:text-emerald-300">
              هنوز سفارشی ثبت نکرده‌اید.
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function OrderCard({
  order,
  className = '',
  onCancel,
  onRestartPayment,
  restarting = false,
}: {
  order: Order;
  className?: string;
  onCancel?: (order: Order) => void;
  onRestartPayment?: (order: Order) => void;
  restarting?: boolean;
}) {
  const cancellable = order.status === 'awaiting_review' && order.payment_status === 'unpaid';
  const canPay = order.payment_method === 'zarinpal'
    && order.payment_status !== 'paid'
    && order.status !== 'cancelled';

  return (
    <article
      className={`rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-5 ${className}`}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-fluid-2xs text-slate-400">کد سفارش</p>
          <h3 className="mt-0.5 text-fluid-base font-extrabold text-emerald-700 dark:text-lime-300" dir="ltr">
            {order.code}
          </h3>
          <p className="mt-1 text-fluid-2xs text-slate-400">
            {new Date(order.created_at).toLocaleDateString('fa-IR')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-fluid-2xs font-bold ${
              STATUS_TONE[order.status] ?? 'bg-slate-100 text-slate-600'
            }`}
          >
            {order.status_label}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-fluid-2xs font-bold ${
              PAYMENT_TONE[order.payment_status] ?? 'bg-slate-100 text-slate-600'
            }`}
          >
            {order.payment_status_label}
          </span>
        </div>
      </div>

      {/* Visual Order Progress Stepper */}
      <OrderTimelineStepper status={order.status} />

      {/* Items. On phones each row stacks so nothing is truncated. */}
      <ul className="mt-4 divide-y divide-slate-100 border-y border-slate-100 dark:divide-emerald-900 dark:border-emerald-900">
        {order.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
            <span className="min-w-0 flex-1 text-fluid-sm text-slate-700 dark:text-emerald-100">
              {item.quantity.toLocaleString('fa-IR')} × {item.product_title}
              {item.package_label && (
                // What the bag was called on the day it sold: labels change, the
                // invoice must not.
                <span className="text-fluid-2xs font-bold text-emerald-700 dark:text-lime-300">
                  ({item.package_label})
                </span>
              )}
              {item.kind === 'listing' && item.storefront_name && (
                <span className="mt-0.5 flex items-center gap-1 text-fluid-2xs text-emerald-600 dark:text-lime-300">
                  <Store size={11} aria-hidden="true" />
                  غرفه {item.storefront_name}
                </span>
              )}
            </span>
            <strong className="whitespace-nowrap text-fluid-sm text-slate-800 dark:text-white">
              {formatPrice(item.total_price)}
            </strong>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-1.5">
        <Row label="جمع کالاها" value={formatPrice(order.subtotal)} />
        {order.discount_amount > 0 && (
          <Row label="تخفیف" value={`− ${formatPrice(order.discount_amount)}`} tone="text-emerald-600" />
        )}
        <Row
          label="هزینه ارسال"
          value={order.shipping_price === 0 ? 'رایگان' : formatPrice(order.shipping_price)}
        />
        <div className="flex items-baseline justify-between border-t border-slate-100 pt-2.5 dark:border-emerald-900">
          <dt className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">مبلغ کل</dt>
          <dd className="text-fluid-base font-extrabold text-emerald-700 dark:text-lime-300">
            {formatPrice(order.total_price)}
          </dd>
        </div>
      </dl>

      {order.shipments?.map((shipment) => (
        <section key={shipment.id} className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-3.5 dark:border-sky-900 dark:bg-sky-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-fluid-2xs text-slate-500 dark:text-sky-200">{shipment.service_name || shipment.provider_label}</p>
              <p className="text-fluid-sm font-extrabold text-sky-800 dark:text-sky-100">{shipment.status_label}</p>
            </div>
            {shipment.tracking_url && (
              <a href={shipment.tracking_url} target="_blank" rel="noreferrer" className="rounded-lg bg-sky-700 px-3 py-2 text-fluid-2xs font-bold text-white">
                رهگیری در سایت حامل
              </a>
            )}
          </div>
          {shipment.tracking_code && <p className="mt-2 text-fluid-xs text-slate-600 dark:text-sky-100">کد مرسوله: <b dir="ltr">{shipment.tracking_code}</b></p>}
          {shipment.events?.length > 0 && (
            <ol className="mt-3 space-y-2 border-s border-sky-200 ps-3 dark:border-sky-800">
              {shipment.events.slice(0, 3).map((event) => (
                <li key={event.id} className="text-fluid-2xs text-slate-600 dark:text-sky-100">
                  <b>{event.status_label}</b> — {event.description}
                  {event.location && <span>، {event.location}</span>}
                  <time className="ms-2 text-slate-400">{new Date(event.occurred_at).toLocaleString('fa-IR')}</time>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-fluid-2xs text-slate-500 dark:text-emerald-200">
          <Truck size={13} aria-hidden="true" />
          {order.province}، {order.city}
        </span>
        {canPay && onRestartPayment && (
          <Button
            size="sm"
            className="ms-auto"
            loading={restarting}
            onClick={() => onRestartPayment(order)}
          >
            پرداخت با زرین‌پال
          </Button>
        )}
        {cancellable && onCancel && (
          <Button
            variant="danger"
            size="sm"
            className="ms-auto"
            onClick={() => onCancel(order)}
          >
            لغو سفارش
          </Button>
        )}
      </div>
    </article>
  );
}

function Row({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-fluid-xs text-slate-500 dark:text-emerald-200">{label}</dt>
      <dd className={`text-fluid-xs font-bold text-slate-700 dark:text-emerald-100 ${tone}`}>{value}</dd>
    </div>
  );
}
