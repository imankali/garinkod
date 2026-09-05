import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, LocateFixed, PackageCheck, Phone, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

import { LEGAL_CORE_LINKS } from "../config/legal";
import { ordersApi, paymentsApi, shippingApi } from "../api/services";
import { parseApiError, type FieldErrors } from "../api/errors";
import LocationPicker from "../components/LocationPicker";
import PurchaseSteps from "../components/PurchaseSteps";
import { useAuthStore } from "../store/authStore";
import { useCartStore } from "../store/cartStore";
import type { CheckoutPayload, Order, PaymentProviderOption } from "../types";
import { formatPrice } from "../utils/formatPrice";
import { toEnglishDigits, normalizePhoneNumber, normalizeNumericInput } from "../utils/normalizeDigits";

const EMPTY_FORM: CheckoutPayload = {
  customer_name: "",
  phone: "",
  email: "",
  province: "",
  city: "",
  address: "",
  postal_code: "",
  notes: "",
  payment_method: "coordination",
  coupon_code: "",
  terms_accepted: false,
};

export default function Checkout() {
  const { cart, fetchCart, isLoading } = useCartStore();
  const { user, account } = useAuthStore();
  const [form, setForm] = useState<CheckoutPayload>(() => ({
    ...EMPTY_FORM,
    affiliate_code: localStorage.getItem('affiliate_referral_code') || '',
  }));
  const [providers, setProviders] = useState<PaymentProviderOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [restartingPayment, setRestartingPayment] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const [quotedShipping, setQuotedShipping] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  // Server-side validation is mapped back onto the individual inputs so the
  // buyer sees which field is wrong instead of a single generic toast.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchCart();
    paymentsApi.options().then((response) => setProviders(response.data.providers)).catch(() => undefined);
  }, [fetchCart]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      customer_name: current.customer_name || [user?.first_name, user?.last_name].filter(Boolean).join(" "),
      phone: current.phone || account?.phone || "",
      email: current.email || user?.email || "",
      address: current.address || account?.address || "",
    }));
  }, [user, account]);

  useEffect(() => {
    if (!form.province || !form.city || !cart?.items.length) {
      setQuotedShipping(null);
      return;
    }
    let cancelled = false;
    shippingApi.quote(form.province, form.city)
      .then((response) => {
        if (!cancelled) setQuotedShipping(response.data.quotes[0]?.amount ?? null);
      })
      .catch(() => {
        if (!cancelled) setQuotedShipping(null);
      });
    return () => { cancelled = true; };
  }, [form.province, form.city, cart?.items.length, cart?.total_price]);

  const subtotal = cart?.total_price || 0;
  const shippingPrice = subtotal === 0 ? 0 : quotedShipping;
  const total = shippingPrice === null ? subtotal : subtotal + shippingPrice;

  function updateField<Key extends keyof CheckoutPayload>(key: Key, value: CheckoutPayload[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    // Clear a field's error as soon as the buyer edits it.
    setFieldErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  function captureCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error('مکان‌یابی در این مرورگر پشتیبانی نمی‌شود.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateField('latitude', Number(coords.latitude.toFixed(6)));
        updateField('longitude', Number(coords.longitude.toFixed(6)));
        setLocating(false);
        toast.success('موقعیت تحویل ثبت شد.');
      },
      () => {
        setLocating(false);
        toast.error('دسترسی به موقعیت داده نشد؛ نشانی متنی کافی است.');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function retryPayment() {
    if (!order) return;
    setRestartingPayment(true);
    try {
      const response = await paymentsApi.restartZarinpal(order.code, form.phone);
      window.location.assign(response.data.payment.checkout_url);
    } catch (error) {
      toast.error(parseApiError(error).message);
      setRestartingPayment(false);
    }
  }

  /** Client-side checks mirroring the serializer, run before any request. */
  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!form.customer_name.trim()) errors.customer_name = 'نام و نام خانوادگی را وارد کنید.';
    const digits = form.phone.replace(/\D/g, '');
    if (!form.phone.trim()) errors.phone = 'شماره تماس را وارد کنید.';
    else if (digits.length < 10 || digits.length > 15) errors.phone = 'شماره تماس معتبر نیست.';
    if (!form.province) errors.province = 'استان را انتخاب کنید.';
    if (!form.city) errors.city = 'شهر را انتخاب کنید.';
    if (!form.address.trim()) errors.address = 'نشانی کامل تحویل الزامی است.';
    if (!form.terms_accepted) errors.terms_accepted = 'برای ثبت سفارش باید شرایط را بپذیرید.';
    return errors;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!cart?.items.length) {
      setFormError('سبد خرید شما خالی است.');
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setFormError('لطفاً موارد مشخص‌شده را اصلاح کنید.');
      // Move focus to the first offending input for keyboard and screen-reader
      // users rather than leaving them to hunt for it.
      const firstKey = Object.keys(validationErrors)[0];
      document.getElementById(`checkout-${firstKey}`)?.focus();
      return;
    }

    setFieldErrors({});
    setFormError('');
    setSubmitting(true);
    try {
      const response = await ordersApi.checkout(form);
      localStorage.setItem("last_order_code", response.data.order.code);
      localStorage.setItem("last_order_phone", form.phone);
      setPaymentError(response.data.payment_error || '');
      if (response.data.payment?.checkout_url) {
        window.location.assign(response.data.payment.checkout_url);
        return;
      }
      setOrder(response.data.order);
      await fetchCart();
      toast.success("سفارش شما ثبت شد.");
    } catch (error) {
      const parsed = parseApiError(error);
      setFieldErrors(parsed.fields);
      setFormError(parsed.message);
      if (!parsed.handled && Object.keys(parsed.fields).length === 0) toast.error(parsed.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (order) {
    return (
      <main className="mx-auto max-w-3xl px-[var(--page-gutter)] py-8 md:py-12">
        <PurchaseSteps currentStep="complete" completed />
        <section className="mt-5 rounded-3xl border border-emerald-100 bg-white p-7 text-center shadow-xl shadow-emerald-100/60 dark:border-emerald-800 dark:bg-emerald-950 dark:shadow-none">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-lime-300">
            <CheckCircle2 size={36} />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold text-slate-800 dark:text-white">سفارش شما ثبت شد</h1>
          <p className="mt-3 leading-7 text-slate-500 dark:text-emerald-200">
            {paymentError
              ? 'سفارش با موفقیت ذخیره شد، اما ساخت لینک پرداخت موقتاً انجام نشد. می‌توانید همین حالا دوباره تلاش کنید.'
              : 'سفارش در وضعیت «در انتظار بررسی» است و کارشناس گرین کود روند ارسال را پیگیری می‌کند.'}
          </p>
          <div className="mt-6 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-900/40">
            <p className="text-xs text-slate-500 dark:text-emerald-300">کد پیگیری سفارش</p>
            <p className="mt-1 text-xl font-extrabold tracking-wider text-emerald-700 dark:text-lime-300" dir="ltr">{order.code}</p>
            {order.discount_amount > 0 && <p className="mt-3 text-sm font-bold text-emerald-700 dark:text-lime-300">تخفیف اعمال‌شده: {formatPrice(order.discount_amount)}</p>}
            <p className="mt-3 text-sm font-bold text-slate-700 dark:text-white">مبلغ ثبت‌شده: {formatPrice(order.total_price)}</p>
            {/*
              The acceptance is written on the order, so the receipt says what it
              says: the moment the box was ticked and the version of the text the
              buyer agreed to. If a term is ever disputed, this is the answer.
            */}
            {order.terms_accepted_at && (
              <p className="mt-3 text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-300">
                شرایط خرید در {new Date(order.terms_accepted_at).toLocaleString("fa-IR")} پذیرفته شد
                {order.legal_version && (
                  <>
                    {' '}· نسخه متن <span dir="ltr" className="font-bold">{order.legal_version}</span>
                  </>
                )}{' '}
                <Link to="/legal" className="font-bold text-emerald-700 hover:underline dark:text-lime-300">
                  دیدن اسناد
                </Link>
              </p>
            )}
          </div>
          <p className="mt-4 text-xs text-slate-400">پرداخت فقط از طریق روش فعال‌شده و تأییدشدهٔ سرور انجام می‌شود؛ هیچ درگاه غیرفعالی مبلغ دریافت نمی‌کند.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            {paymentError && order.payment_method === 'zarinpal' && (
              <button type="button" onClick={retryPayment} disabled={restartingPayment} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
                {restartingPayment ? 'در حال ساخت لینک…' : 'تلاش دوباره برای پرداخت'}
              </button>
            )}
            <Link to="/orders" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">پیگیری سفارش</Link>
            <Link to="/" className="rounded-xl border border-emerald-200 px-5 py-3 text-sm font-bold text-emerald-700 dark:border-emerald-700 dark:text-lime-300">بازگشت به فروشگاه</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!isLoading && !cart?.items.length) {
    return (
      <main className="mx-auto min-h-[55vh] max-w-3xl px-[var(--page-gutter)] py-8 md:py-12">
        <PurchaseSteps currentStep="cart" />
        <section className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardCheck size={50} className="text-emerald-500" />
          <h1 className="mt-4 text-2xl font-extrabold text-slate-800 dark:text-white">سبد خرید شما خالی است</h1>
          <p className="mt-2 text-slate-500 dark:text-emerald-200">ابتدا محصولات مورد نیاز مزرعه یا باغ خود را انتخاب کنید.</p>
          <Link to="/products" className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">مشاهده محصولات</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-[var(--page-gutter)] py-7 md:py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-lime-300">بازگشت به فروشگاه</Link>
      <PurchaseSteps currentStep="details" className="mt-5" />
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-7 dark:border-emerald-900 dark:bg-emerald-950">
          <div>
            <p className="text-xs font-bold text-emerald-700 dark:text-lime-300">ثبت امن سفارش و تحویل</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-800 dark:text-white">اطلاعات تحویل سفارش</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-emerald-200">روش پرداخت فعال را انتخاب کنید؛ مبلغ درگاه همیشه از جمع نهایی سرور ساخته و تأیید می‌شود.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="checkout-customer_name" autoComplete="name" label="نام و نام خانوادگی" required value={form.customer_name} error={fieldErrors.customer_name} onChange={(value) => updateField("customer_name", value)} />
            <Field id="checkout-phone" autoComplete="tel" label="شماره تماس" required inputMode="tel" value={form.phone} error={fieldErrors.phone} onChange={(value) => updateField("phone", normalizePhoneNumber(value))} />
            <Field id="checkout-email" autoComplete="email" label="ایمیل (اختیاری)" type="email" value={form.email || ""} error={fieldErrors.email} onChange={(value) => updateField("email", value.trim())} />
            <Field id="checkout-postal_code" autoComplete="postal-code" label="کد پستی (اختیاری)" inputMode="numeric" value={form.postal_code || ""} error={fieldErrors.postal_code} onChange={(value) => updateField("postal_code", normalizeNumericInput(value))} />
            <LocationPicker
              idPrefix="checkout"
              required
              province={form.province}
              city={form.city}
              onProvinceChange={(value) => { updateField("province", value); updateField("city", ""); }}
              onCityChange={(value) => updateField("city", value)}
              provinceError={fieldErrors.province}
              cityError={fieldErrors.city}
            />
          </div>

          <div>
            <label htmlFor="checkout-address" className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
              نشانی کامل تحویل <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="checkout-address"
              autoComplete="street-address"
              required
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
              rows={3}
              aria-invalid={Boolean(fieldErrors.address)}
              aria-describedby={fieldErrors.address ? "checkout-address-error" : undefined}
              className={`mt-2 w-full rounded-xl border bg-white px-3 py-2.5 font-normal outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-900 ${fieldErrors.address ? "border-rose-400" : "border-slate-200 dark:border-emerald-700"}`}
            />
            {fieldErrors.address && <p id="checkout-address-error" role="alert" className="mt-1 text-fluid-xs font-semibold text-rose-600">{fieldErrors.address}</p>}
            <button type="button" onClick={captureCurrentLocation} disabled={locating} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900">
              <LocateFixed size={15} />
              {locating ? 'در حال دریافت موقعیت…' : form.latitude && form.longitude ? 'موقعیت تحویل ثبت شد' : 'افزودن موقعیت فعلی (اختیاری)'}
            </button>
            <p className="mt-1 text-fluid-2xs text-slate-400">موقعیت فقط همراه سفارش ذخیره می‌شود و جای نشانی کامل را نمی‌گیرد.</p>
          </div>
          <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
            توضیحات برای کارشناس یا ارسال (اختیاری)
            <textarea value={form.notes || ""} onChange={(event) => updateField("notes", event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" placeholder="زمان مناسب تماس، نیاز به مشاوره مصرف، مشخصات دسترسی و..." />
          </label>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="flex items-center gap-2 font-extrabold"><Phone size={17} /> روش پرداخت</div>
            <p className="mt-1">فقط روش‌هایی که سرور با credential، callback verify و تست کامل فعال کرده باشد قابل انتخاب‌اند. روش‌های دیگر صرفاً برای شفافیت نمایش داده می‌شوند.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {providers.map((provider) => (
                <button key={provider.code} type="button" disabled={!provider.enabled} onClick={() => updateField('payment_method', provider.code)} className={`rounded-xl border p-3 text-start text-xs transition ${form.payment_method === provider.code ? 'border-emerald-600 bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-lime-100' : 'border-amber-200 bg-white/80 dark:border-amber-800 dark:bg-emerald-950'} ${!provider.enabled ? 'cursor-not-allowed opacity-60' : ''}`}>
                  <span className="block font-extrabold">{provider.label}</span>
                  <span className="mt-1 block text-fluid-2xs">{provider.enabled ? 'فعال' : provider.reason}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
            کد تخفیف خرید بعدی (اختیاری)
            <input value={form.coupon_code || ''} onChange={(event) => updateField('coupon_code', toEnglishDigits(event.target.value).toUpperCase().trim())} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" placeholder="مثال: NEXT-..." dir="ltr" />
          </label>

          <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
            کد همکاری در فروش (اختیاری)
            <input value={form.affiliate_code || ''} onChange={(event) => updateField('affiliate_code', toEnglishDigits(event.target.value).toUpperCase().trim())} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" placeholder="مثال: GKAF-..." dir="ltr" />
          </label>

          <div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:bg-emerald-900/40 dark:text-emerald-100">
              <input id="checkout-terms_accepted" type="checkbox" checked={form.terms_accepted} onChange={(event) => updateField("terms_accepted", event.target.checked)} aria-invalid={Boolean(fieldErrors.terms_accepted)} className="mt-1 h-4 w-4 accent-emerald-600" />
              <span>
                صحت اطلاعات تحویل و مبلغ را تأیید می‌کنم و می‌پذیرم سفارش فقط پس از تأیید سمت سرور و، برای پرداخت
                آنلاین، تأیید درگاه پرداخت‌شده تلقی شود.
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-fluid-2xs">
                  <span className="text-slate-400">متن کامل:</span>
                  {LEGAL_CORE_LINKS.map((item) => (
                    <Link key={item.to} to={item.to} className="font-bold text-emerald-700 hover:underline dark:text-lime-300">
                      {item.label}
                    </Link>
                  ))}
                  {/* The number is stamped server-side on the order, so this line
                      is a receipt, not a promise the frontend has to keep. */}
                  <span className="text-slate-400">· شماره نسخه متن روی سفارش شما ثبت می‌شود.</span>
                </span>
              </span>
            </label>
            {fieldErrors.terms_accepted && <p role="alert" className="mt-1 text-fluid-xs font-semibold text-rose-600">{fieldErrors.terms_accepted}</p>}
          </div>

          {formError && (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
              {formError}
            </p>
          )}

          <button disabled={submitting || !cart?.items.length} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-600 to-lime-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50">
            <PackageCheck size={18} /> {submitting ? "در حال ثبت سفارش..." : form.payment_method === 'zarinpal' ? 'ثبت سفارش و رفتن به درگاه' : 'ثبت سفارش و درخواست هماهنگی'}
          </button>
        </form>

        <aside className="h-fit rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-900/30 lg:sticky lg:top-5">
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">خلاصه سفارش</h2>
          <ul className="mt-4 space-y-3 border-b border-emerald-100 pb-4 dark:border-emerald-800">
            {cart?.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="line-clamp-2 text-slate-600 dark:text-emerald-100">
                  {item.quantity} × {item.title}
                  {/* Marketplace lines name their storefront so the buyer knows
                      who is actually shipping each part of the order. */}
                  {item.kind === 'listing' && item.listing?.storefront_name && (
                    <span className="mt-0.5 block text-fluid-xs text-emerald-600 dark:text-lime-300">
                      غرفه {item.listing.storefront_name}
                    </span>
                  )}
                </span>
                <strong className="whitespace-nowrap text-slate-800 dark:text-white">
                  {formatPrice(item.total_price)}
                </strong>
              </li>
            ))}
          </ul>
          <SummaryRow label="جمع کالاها" value={formatPrice(subtotal)} />
          <SummaryRow label="هزینه ارسال" value={shippingPrice === null ? "پس از انتخاب شهر" : shippingPrice === 0 ? "رایگان" : formatPrice(shippingPrice)} />
          <div className="mt-3 flex items-center justify-between border-t border-emerald-200 pt-4 text-base font-extrabold text-slate-800 dark:border-emerald-700 dark:text-white"><span>مبلغ قابل پرداخت</span><span className="text-emerald-700 dark:text-lime-300">{formatPrice(total)}</span></div>
          <div className="mt-5 flex gap-2 rounded-xl bg-white/70 p-3 text-fluid-xs leading-5 text-slate-500 dark:bg-emerald-950/50 dark:text-emerald-200"><ShieldCheck size={18} className="shrink-0 text-emerald-600" />مبلغ نهایی توسط سرور با قیمت و موجودی لحظه‌ای محاسبه می‌شود.</div>
        </aside>
      </div>
    </main>
  );
}

function Field({ id, label, value, onChange, type = "text", inputMode, required = false, error, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; inputMode?: "tel" | "numeric"; required?: boolean; error?: string; autoComplete?: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        id={id}
        required={required}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-2 w-full rounded-xl border bg-white px-3 py-2.5 font-normal outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-900 ${error ? "border-rose-400" : "border-slate-200 dark:border-emerald-700"}`}
      />
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-fluid-xs font-semibold text-rose-600">{error}</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="mt-3 flex justify-between text-sm text-slate-600 dark:text-emerald-100"><span>{label}</span><span className="font-bold">{value}</span></div>;
}
