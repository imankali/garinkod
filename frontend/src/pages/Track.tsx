// frontend/src/pages/Track.tsx

import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Search } from 'lucide-react';

import { ordersApi } from '../api/services';
import type { Order } from '@/types/commerce';
import { parseApiError } from '../api/errors';
import { money, nums } from '../lib/price';
import PageHead from '../components/shop/PageHead';
import { TextField } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

/**
 * Order tracking by code + phone.
 *
 * Both are required on purpose: a code alone would let anyone who guesses a
 * four-digit number read someone else's address. The server enforces the same
 * pair, so the form says why instead of showing a generic failure.
 *
 * The status is presented as a plain sequence of steps with the completed ones
 * marked — no animated truck driving across the screen, no progress ring.
 */
const STEPS = ['ثبت شد', 'در حال آماده‌سازی', 'ارسال شد', 'تحویل شد'] as const;

function stepIndex(status: string): number {
  const value = status.toLowerCase();
  if (['delivered', 'completed'].includes(value)) return 3;
  if (['shipped', 'in_transit', 'sent'].includes(value)) return 2;
  if (['confirmed', 'processing', 'paid', 'preparing'].includes(value)) return 1;
  return 0;
}

export default function Track() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const order = useQuery({
    queryKey: ['order-lookup', code, phone],
    queryFn: async () => (await ordersApi.lookup(code, phone)).data,
    enabled: submitted && code.trim().length > 0 && phone.trim().length > 0,
    retry: false,
  });

  const record: Order | undefined = order.data;

  return (
    <div className="shell flex flex-col gap-5 py-8">
      <PageHead
        title="پیگیری سفارش"
        lead="کد سفارش و شمارهٔ همراهی که با آن خرید کرده‌اید را وارد کنید. هر دو برای محافظت از اطلاعات تحویل لازم است."
      />

      <form
        className="flex max-w-lg flex-col gap-3 rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <TextField
          label="کد سفارش"
          dir="ltr"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          hint="در پیام تأیید سفارش آمده است."
          required
        />
        <TextField
          label="شمارهٔ همراه"
          dir="ltr"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="09xxxxxxxxx"
          required
        />
        <Button type="submit" icon={Search} disabled={!code.trim() || !phone.trim()}>
          پیدا کردن سفارش
        </Button>
      </form>

      {submitted && order.isLoading && (
        <div className="max-w-2xl">
          <Skeleton className="h-40 rounded-lg" />
        </div>
      )}

      {submitted && order.isError && (
        <EmptyState
          title="سفارشی با این کد و شماره پیدا نشد"
          description={parseApiError(order.error).message || 'کد سفارش و شمارهٔ همراه را بررسی کنید؛ هر دو باید مربوط به همان خرید باشند.'}
        />
      )}

      {record && (
        <section aria-label="وضعیت سفارش" className="max-w-2xl rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="dateline text-sm font-extrabold text-ink dark:text-white">سفارش {record.code}</h2>
            <p className="dateline text-sm font-extrabold text-ink dark:text-white">{money(record.total_price)}</p>
          </div>
          <p className="mt-1 text-2xs text-ink-mute dark:text-white/45">
            {record.payment_status_label} · {record.total_items.toLocaleString('fa-IR')} قلم کالا
          </p>

          <ol className="mt-5 flex flex-col gap-0">
            {STEPS.map((label, index) => {
              const done = index <= stepIndex(record.status);
              return (
                <li key={label} className="flex gap-3">
                  <span className="flex flex-col items-center">
                    {done ? (
                      <CheckCircle2 size={17} aria-hidden="true" className="text-brand-700 dark:text-brand-300" />
                    ) : (
                      <Circle size={17} aria-hidden="true" className="text-line dark:text-night-line" />
                    )}
                    {index < STEPS.length - 1 && (
                      <span
                        aria-hidden="true"
                        className={`my-1 w-px flex-1 ${done ? 'bg-brand-300 dark:bg-brand-800' : 'bg-line dark:bg-night-line'}`}
                        style={{ minHeight: 20 }}
                      />
                    )}
                  </span>
                  <span className={`pb-3 text-xs ${done ? 'font-bold text-ink dark:text-white' : 'text-ink-mute dark:text-white/40'}`}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mt-2 border-t border-line pt-3 dark:border-night-line">
            <h3 className="text-2xs font-extrabold text-ink dark:text-white">اقلام</h3>
            <ul className="mt-1 divide-y divide-line text-2xs dark:divide-night-line">
              {record.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-2 py-1.5">
                  <span className="min-w-0 truncate text-ink-soft dark:text-white/70">
                    {item.product_title} × {nums(item.quantity)}
                  </span>
                  <span className="dateline shrink-0 font-bold text-ink dark:text-white">{money(item.total_price)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-2xs text-ink-mute dark:text-white/45">
              تحویل به: {record.city}، {record.address}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
