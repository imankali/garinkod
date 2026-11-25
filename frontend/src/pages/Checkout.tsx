// frontend/src/pages/Checkout.tsx

import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';

import { locationsApi, ordersApi } from '../api/services';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { parseApiError } from '../api/errors';
import { money } from '../lib/price';
import { readReferral } from '../lib/referral';
import { SelectField, TextArea, TextField } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHead from '../components/shop/PageHead';

/**
 * Checkout: the address, the payment choice, the total, one button.
 *
 * The order is the order of the decisions the buyer has to make. Fields are
 * prefilled from the account where the server already knows them, and the
 * phone is required because it is what the shop calls to confirm stock —
 * saying so under the field is better than failing at submit.
 *
 * Payment is a radio group of what the server actually enabled. Nothing here
 * pretends a gateway exists: if only "هماهنگی تلفنی" is offered, that is the
 * only option shown.
 */
export default function Checkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = useCartStore((state) => state.cart);
  const user = useAuthStore((state) => state.user);
  const account = useAuthStore((state) => state.account);

  const [name, setName] = useState(user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : '');
  const [phone, setPhone] = useState(account?.phone ?? '');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');

  /**
   * The address is picked, not typed. The country's divisions are a closed set
   * the API already publishes (`/locations/`), and a free-text province means
   * «تهران», «تهران.» and «استان تهران» are three different answers to the
   * same question — which is what a shipping quote is built from.
   *
   * The city list follows the province; changing the province clears a city
   * that no longer belongs to it.
   */
  const provinces = useQuery({
    queryKey: ['locations', 'provinces'],
    queryFn: async () => (await locationsApi.provinces()).data.results ?? [],
    staleTime: 24 * 60 * 60 * 1000,
  });
  const cities = useQuery({
    queryKey: ['locations', 'cities', province],
    queryFn: async () => (await locationsApi.cities(province)).data.results ?? [],
    enabled: Boolean(province),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const [address, setAddress] = useState(account?.address ?? '');
  const [postal, setPostal] = useState('');
  const [notes, setNotes] = useState('');
  const [coupon, setCoupon] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = cart?.items ?? [];
  const total = cart?.total_price ?? 0;

  if (items.length === 0) {
    return (
      <div className="shell py-16">
        <EmptyState
          title="سبد خرید خالی است"
          description="پیش از پرداخت باید کالایی در سبد باشد. از فروشگاه یا غرفه‌های کشاورزان شروع کنید."
          action={<Button to="/products" size="sm">رفتن به فروشگاه</Button>}
        />
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!terms || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ordersApi.checkout({
        customer_name: name,
        phone,
        province,
        city,
        address,
        postal_code: postal,
        notes,
        coupon_code: coupon || undefined,
        payment_method: 'coordination',
        affiliate_code: readReferral(),
        // The submit button cannot be pressed until the terms checkbox is
        // ticked, so this is the visitor's own agreement rather than a
        // constant that happens to be true.
        terms_accepted: terms,
      });
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      navigate(`/track?code=${result.data.order.code}`, { replace: true });
    } catch (caught) {
      setError(parseApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell flex flex-col gap-5 py-8">
      <PageHead
        title="تسویه حساب"
        lead="نشانی تحویل را بررسی کنید. موجودی و هزینهٔ ارسال پیش از تأیید سفارش بررسی می‌شود و برای هماهنگی با شما تماس می‌گیریم."
      />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex flex-col gap-5">
          <section className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
            <h2 className="text-sm font-extrabold text-ink dark:text-white">نشانی تحویل</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TextField label="نام و نام خانوادگی" required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              <TextField
                label="شمارهٔ همراه"
                required
                dir="ltr"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                hint="برای هماهنگی موجودی و ارسال، با همین شماره تماس می‌گیریم."
              />
              <SelectField
                label="استان"
                required
                value={province}
                autoComplete="address-level1"
                onChange={(event) => {
                  setProvince(event.target.value);
                  setCity('');
                }}
              >
                <option value="">انتخاب کنید…</option>
                {(provinces.data ?? []).map((entry) => (
                  <option key={entry.id} value={entry.name}>
                    {entry.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="شهر"
                required
                value={city}
                autoComplete="address-level2"
                disabled={!province}
                hint={province && cities.isSuccess && cities.data.length === 0 ? 'برای این استان شهری ثبت نشده است.' : undefined}
                onChange={(event) => setCity(event.target.value)}
              >
                <option value="">{province ? 'انتخاب کنید…' : 'اول استان را انتخاب کنید'}</option>
                {(cities.data ?? []).map((entry) => (
                  <option key={entry.id} value={entry.name}>
                    {entry.name}
                  </option>
                ))}
              </SelectField>
              <TextField label="کد پستی" dir="ltr" inputMode="numeric" value={postal} onChange={(event) => setPostal(event.target.value)} autoComplete="postal-code" />
              <TextField label="کد تخفیف" value={coupon} onChange={(event) => setCoupon(event.target.value)} hint="اختیاری؛ در مجموع اعمال می‌شود." />
            </div>
            <div className="mt-3">
              <TextArea
                label="نشانی کامل"
                required
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                autoComplete="street-address"
                placeholder="خیابان، کوچه، پلاک، واحد"
              />
            </div>
            <div className="mt-3">
              <TextArea
                label="یادداشت برای فروشنده"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="مثلاً: تحویل در ساعات صبح، یا تماس پیش از ارسال"
              />
            </div>
          </section>

          <section className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
            <h2 className="text-sm font-extrabold text-ink dark:text-white">روش پرداخت</h2>
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-md border border-brand-300 bg-brand-50/60 p-3 dark:border-brand-800 dark:bg-night">
              <input type="radio" name="payment" value="coordination" checked readOnly className="mt-1" />
              <span>
                <span className="block text-xs font-extrabold text-ink dark:text-white">هماهنگی تلفنی</span>
                <span className="mt-0.5 block text-2xs leading-6 text-ink-mute dark:text-white/55">
                  موجودی و هزینهٔ ارسال تأیید می‌شود، بعد پرداخت انجام می‌گیرد. برای سفارش‌های عمده و ارسال به شهرستان، این روش پیشنهادی است.
                </span>
              </span>
            </label>
          </section>
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <div className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
            <h2 className="text-sm font-extrabold text-ink dark:text-white">خلاصهٔ سفارش</h2>
            <ul className="mt-3 divide-y divide-line text-2xs dark:divide-night-line">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-2 py-2">
                  <span className="min-w-0 truncate text-ink-soft dark:text-white/70">
                    {item.title} × {item.quantity.toLocaleString('fa-IR')}
                  </span>
                  <span className="dateline shrink-0 font-bold text-ink dark:text-white">{money(item.total_price)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3 dark:border-night-line">
              <span className="text-xs font-bold text-ink-soft dark:text-white/70">جمع کالاها</span>
              <span className="dateline text-base font-extrabold text-ink dark:text-white">{money(total)}</span>
            </div>
            <p className="mt-1 text-2xs text-ink-mute dark:text-white/50">هزینهٔ ارسال پس از تأیید موجودی اضافه می‌شود.</p>

            <label className="mt-3 flex items-start gap-2 text-2xs leading-6 text-ink-soft dark:text-white/65">
              <input
                type="checkbox"
                checked={terms}
                onChange={(event) => setTerms(event.target.checked)}
                className="mt-1 h-4 w-4 accent-brand-700"
                required
              />
              <span>
                <Link to="/legal/terms" className="font-bold text-brand-700 hover:underline dark:text-brand-300">قوانین</Link> و{' '}
                <Link to="/legal/returns" className="font-bold text-brand-700 hover:underline dark:text-brand-300">شرایط بازگشت کالا</Link>{' '}
                را خواندم و می‌پذیرم.
              </span>
            </label>

            {error && (
              <p role="alert" className="mt-3 rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-2xs font-medium text-danger-700 dark:bg-danger-700/15">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" full className="mt-4" loading={busy} disabled={!terms}>
              ثبت سفارش
            </Button>

            <p className="mt-2 flex items-center justify-center gap-1.5 text-2xs text-ink-mute dark:text-white/45">
              <ShieldCheck size={13} aria-hidden="true" />
              تأیید موجودی پیش از پرداخت
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}
