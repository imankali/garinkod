// frontend/src/pages/Checkout.tsx

import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';

import { locationsApi, ordersApi, paymentsApi, rewardsApi, shippingApi } from '../api/services';
import type { CheckoutPayload, PaymentProviderOption } from '@/types/commerce';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { parseApiError } from '../api/errors';
import { money } from '../lib/price';
import { cn } from '../lib/cn';
import { readReferral } from '../lib/referral';
import { SelectField, TextArea, TextField } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHead from '../components/shop/PageHead';
import { pointsValue, POINTS_PER_UNIT } from '../components/shop/RewardsPanel';

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

  // Checkout answers with `payment` (a live gateway attempt) and `payment_error`
  // (the order exists, the gateway link does not). Both were discarded: a buyer
  // who chose زرین‌پال was sent to a tracking page that says «پرداخت نشده» and
  // offers no way to pay. An order that skipped payment is useless.
  const [paymentIssue, setPaymentIssue] = useState<string | null>(null);
  const [placedCode, setPlacedCode] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
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
  // The cost of delivery, before the buyer commits. The endpoint computes from
  // the *cart*, so it answers honestly for a whole basket, and it says plainly
  // whether the number is final (`authoritative_at_checkout: false` here means
  // it will be recomputed at submit).
  const shipping = useQuery({
    queryKey: ['shipping-quote', province, city],
    queryFn: async () => (await shippingApi.quote(province, city)).data,
    enabled: Boolean(province && city),
    staleTime: 5 * 60 * 1000,
  });
  const standard = (shipping.data?.quotes ?? [])[0];
  const shippingKnown = typeof standard?.amount === 'number';

  const [address, setAddress] = useState(account?.address ?? '');
  const [postal, setPostal] = useState('');
  const [notes, setNotes] = useState('');
  const [coupon, setCoupon] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<CheckoutPayload['payment_method']>('coordination');
  const [usePoints, setUsePoints] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The server decides which gateways exist; a provider is offered when it is
  // both enabled and configured, and the others are listed with their reason so
  // the buyer is not left guessing why «زرین‌پال» is missing.
  const options = useQuery({
    queryKey: ['payment-options'],
    queryFn: async () => (await paymentsApi.options()).data,
    staleTime: 5 * 60 * 1000,
  });

  const items = cart?.items ?? [];
  const total = cart?.total_price ?? 0;

  // Loyalty points are spendable only if the flag is sent: the checkout view
  // read it from the first commit, but no screen ever offered it, so a buyer
  // with a points balance could not use a single point.
  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => (await rewardsApi.wallet()).data,
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  });
  const points = wallet.data?.loyalty_points ?? 0;
  // What the points are worth against this order: whole units only, never more
  // than what is payable (the server applies the same two limits).
  const pointsDiscount = Math.min(pointsValue(points), total);

  const declared: PaymentProviderOption[] = options.data?.providers ?? [];
  const providers = declared.filter((provider) => provider.enabled && provider.configured);

  // A choice that is no longer offered (the operator disabled it while the page
  // was open) must not be what gets submitted.
  const effectiveMethod = providers.some((provider) => provider.code === method)
    ? method
    : providers[0]?.code ?? 'coordination';

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
    setPaymentIssue(null);
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
        payment_method: effectiveMethod,
        affiliate_code: readReferral(),
        // The submit button cannot be pressed until the terms checkbox is
        // ticked, so this is the visitor's own agreement rather than a
        // constant that happens to be true.
        terms_accepted: terms,
        use_loyalty_points: Boolean(usePoints) && pointsDiscount > 0,
      });
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      const gateway = result.data.payment?.checkout_url;
      if (gateway) {
        window.location.assign(gateway);
        return;
      }
      if (result.data.payment_error) {
        // The order is booked and stock is reserved — the server says so —
        // so do not pretend the checkout failed. Say the link did not get
        // built and keep the buyer here to try again.
        setPaymentIssue(result.data.payment_error);
        setPlacedCode(result.data.order.code);
        return;
      }
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
            {/* The list is the server's, not this file's. It used to be one
                hardcoded radio — «هماهنگی تلفنی» — so a gateway the operator
                switched on could never be chosen at checkout, and one they
                switched off was still advertised. `/payments/options/` already
                reports each provider with `enabled`, `configured` and the
                operator's own `reason`; that is what is rendered, and the
                reason is printed where a provider is unavailable instead of
                the option silently disappearing. */}
            {providers.length === 0 && (
              <p className="mt-3 rounded-md border border-line p-3 text-2xs leading-6 text-ink-mute dark:border-night-line dark:text-white/55">
                {options.isLoading
                  ? 'در حال دریافت روش‌های پرداخت…'
                  : 'روش پرداخت در دسترس نیست؛ سفارش شما ثبت می‌شود و پرداخت تلفنی هماهنگ خواهد شد.'}
              </p>
            )}
            <div className="mt-3 flex flex-col gap-2">
              {providers.map((provider) => {
                const selected = effectiveMethod === provider.code;
                return (
                  <label
                    key={provider.code}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-md border p-3',
                      selected
                        ? 'border-brand-300 bg-brand-50/60 dark:border-brand-800 dark:bg-night'
                        : 'border-line hover:border-brand-200 dark:border-night-line',
                    )}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={provider.code}
                      checked={selected}
                      onChange={() => setMethod(provider.code)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-xs font-extrabold text-ink dark:text-white">
                        {provider.label}
                      </span>
                      <span className="mt-0.5 block text-2xs leading-6 text-ink-mute dark:text-white/55">
                        {provider.reason ||
                          (provider.code === 'coordination'
                            ? 'موجودی و هزینهٔ ارسال تأیید می‌شود، بعد پرداخت انجام می‌گیرد.'
                            : 'پرداخت آنلاین در درگاه امن.')}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
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
            {shippingKnown ? (
              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2 dark:border-night-line">
                <span className="text-2xs font-bold text-ink-soft dark:text-white/70">
                  {standard.label}
                  {standard.estimated_days_min != null && standard.estimated_days_max != null && (
                    <span className="dateline ms-1 text-ink-mute dark:text-white/40">
                      ({standard.estimated_days_min.toLocaleString('fa-IR')} تا{' '}
                      {standard.estimated_days_max.toLocaleString('fa-IR')} روز)
                    </span>
                  )}
                </span>
                <span className="dateline text-xs font-bold text-ink dark:text-white">
                  {money(standard.amount)}
                </span>
              </div>
            ) : (
              <p className="mt-1 text-2xs text-ink-mute dark:text-white/50">
                {shipping.isLoading
                  ? 'در حال محاسبهٔ هزینهٔ ارسال…'
                  : 'هزینهٔ ارسال با انتخاب استان و شهر، پیش از تأیید نهایی محاسبه می‌شود.'}
              </p>
            )}

            {shippingKnown && (
              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2 dark:border-night-line">
                <span className="text-xs font-bold text-ink dark:text-white">جمع با ارسال</span>
                <span className="dateline text-base font-extrabold text-ink dark:text-white">
                  {money(total + (standard?.amount ?? 0) - (usePoints ? pointsDiscount : 0))}
                </span>
              </div>
            )}

            {shippingKnown && shipping.data?.authoritative_at_checkout === false && (
              <p className="mt-1 text-[11px] leading-5 text-ink-mute dark:text-white/45">
                {shipping.data.note || 'مبلغ نهایی در لحظهٔ ثبت سفارش دوباره محاسبه می‌شود.'}
              </p>
            )}

            {/* The points were always redeemable — the server has handled
                `use_loyalty_points` from the first commit — but no screen ever
                offered the flag, so a balance could only be spent by a client
                that knew to invent it. Below one whole unit the switch is not
                shown at all, because it would discount nothing. */}
            {points >= POINTS_PER_UNIT && (
              <div className="mt-3 rounded-md border border-line p-3 dark:border-night-line">
                <label className="flex items-start gap-2 text-2xs leading-6 text-ink-soft dark:text-white/65">
                  <input
                    type="checkbox"
                    checked={usePoints}
                    onChange={(event) => setUsePoints(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-brand-700"
                  />
                  <span>
                    <span className="block font-extrabold text-ink dark:text-white">
                      استفاده از امتیازهای وفاداری
                    </span>
                    <span className="dateline block text-ink-mute dark:text-white/50">
                      {points.toLocaleString('fa-IR')} امتیاز دارید؛ با این تخفیف تا{' '}
                      {money(pointsDiscount)} از مبلغ کسر می‌شود (هر {POINTS_PER_UNIT.toLocaleString('fa-IR')} امتیاز ={' '}
                      {money(10_000)}).
                    </span>
                  </span>
                </label>
                {usePoints && (
                  <p className="dateline mt-1.5 border-t border-line pt-1.5 text-2xs text-brand-800 dark:border-night-line dark:text-brand-300">
                    قابل پرداخت پس از تخفیف امتیاز: {money(Math.max(0, total - pointsDiscount))}
                    <span className="block text-ink-mute dark:text-white/45">
                      مبلغ نهایی با هزینهٔ ارسال، پس از تأیید موجودی، در سرور محاسبه می‌شود.
                    </span>
                  </p>
                )}
              </div>
            )}

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

            {paymentIssue && placedCode && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-gold-300 bg-gold-50 p-3 text-2xs dark:border-gold-700 dark:bg-gold-900/20"
        >
          <p className="font-extrabold text-ink dark:text-white">
            سفارش {placedCode} ثبت شد، اما لینک پرداخت ساخته نشد.
          </p>
          <p className="mt-1 text-ink-soft dark:text-white/70">
            موجودی رزرو شده و سفارش از بین نرفته است. یک بار دیگر تلاش کنید؛ اگر باز هم نشد، از
            پیگیری سفارش با کد و شمارهٔ همراه وضعیت را ببینید.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              loading={retrying}
              onClick={async () => {
                setRetrying(true);
                try {
                  const answer = await paymentsApi.restartZarinpal(placedCode, phone.trim());
                  const gateway = answer.data.payment.checkout_url;
                  if (gateway) {
                    window.location.assign(gateway);
                    return;
                  }
                  setPaymentIssue('درگاه نشانی پرداخت برنگرداند. لطفاً بعداً تلاش کنید.');
                } catch (caught) {
                  setPaymentIssue(parseApiError(caught).message);
                } finally {
                  setRetrying(false);
                }
              }}
            >
              تلاش دوباره برای پرداخت
            </Button>
            <Link
              to={`/track?code=${encodeURIComponent(placedCode)}`}
              className="text-2xs font-bold text-brand-800 underline underline-offset-2 dark:text-brand-300"
            >
              پیگیری سفارش
            </Link>
          </div>
        </div>
      )}

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
