import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, PackageCheck, Phone, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

import { ordersApi } from "../api/services";
import { useAuthStore } from "../store/authStore";
import { useCartStore } from "../store/cartStore";
import type { CheckoutPayload, Order } from "../types";
import { formatPrice } from "../utils/formatPrice";

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
  terms_accepted: false,
};

export default function Checkout() {
  const { cart, fetchCart, isLoading } = useCartStore();
  const { user, account } = useAuthStore();
  const [form, setForm] = useState<CheckoutPayload>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchCart();
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

  const subtotal = cart?.total_price || 0;
  const shippingPrice = subtotal === 0 || subtotal >= 3_000_000 ? 0 : 45_000;
  const total = subtotal + shippingPrice;

  function updateField<Key extends keyof CheckoutPayload>(key: Key, value: CheckoutPayload[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!cart?.items.length) {
      toast.error("سبد خرید شما خالی است.");
      return;
    }
    if (!form.terms_accepted) {
      toast.error("برای ثبت سفارش باید شرایط را بپذیرید.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await ordersApi.checkout(form);
      setOrder(response.data.order);
      localStorage.setItem("last_order_code", response.data.order.code);
      localStorage.setItem("last_order_phone", form.phone);
      await fetchCart();
      toast.success("سفارش شما ثبت شد.");
    } catch {
      // The API client's Persian error toast explains server-side validation.
    } finally {
      setSubmitting(false);
    }
  }

  if (order) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-emerald-100 bg-white p-7 text-center shadow-xl shadow-emerald-100/60 dark:border-emerald-800 dark:bg-emerald-950 dark:shadow-none">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-lime-300">
            <CheckCircle2 size={36} />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold text-slate-800 dark:text-white">سفارش شما ثبت شد</h1>
          <p className="mt-3 leading-7 text-slate-500 dark:text-emerald-200">
            سفارش فعلاً در وضعیت «در انتظار بررسی» است. کارشناس گرین کود موجودی نهایی، هزینه ارسال و روش پرداخت را با شما هماهنگ می‌کند.
          </p>
          <div className="mt-6 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-900/40">
            <p className="text-xs text-slate-500 dark:text-emerald-300">کد پیگیری سفارش</p>
            <p className="mt-1 text-xl font-extrabold tracking-wider text-emerald-700 dark:text-lime-300" dir="ltr">{order.code}</p>
            <p className="mt-3 text-sm font-bold text-slate-700 dark:text-white">مبلغ ثبت‌شده: {formatPrice(order.total_price)}</p>
          </div>
          <p className="mt-4 text-xs text-slate-400">تا زمان اتصال زرین‌پال، هیچ پرداخت آنلاین در این مرحله دریافت نمی‌شود.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/orders" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">پیگیری سفارش</Link>
            <Link to="/" className="rounded-xl border border-emerald-200 px-5 py-3 text-sm font-bold text-emerald-700 dark:border-emerald-700 dark:text-lime-300">بازگشت به فروشگاه</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!isLoading && !cart?.items.length) {
    return (
      <main className="mx-auto flex min-h-[55vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
        <ClipboardCheck size={50} className="text-emerald-500" />
        <h1 className="mt-4 text-2xl font-extrabold text-slate-800 dark:text-white">سبد خرید شما خالی است</h1>
        <p className="mt-2 text-slate-500 dark:text-emerald-200">ابتدا محصولات مورد نیاز مزرعه یا باغ خود را انتخاب کنید.</p>
        <Link to="/products" className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">مشاهده محصولات</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 md:py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-lime-300">بازگشت به فروشگاه</Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-7 dark:border-emerald-900 dark:bg-emerald-950">
          <div>
            <p className="text-xs font-bold text-emerald-700 dark:text-lime-300">ثبت سفارش بدون پرداخت آنلاین</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-800 dark:text-white">اطلاعات تحویل سفارش</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-emerald-200">پس از بررسی سفارش، کارشناس برای تأیید و هماهنگی پرداخت با شما تماس می‌گیرد.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نام و نام خانوادگی" required value={form.customer_name} onChange={(value) => updateField("customer_name", value)} />
            <Field label="شماره تماس" required inputMode="tel" value={form.phone} onChange={(value) => updateField("phone", value)} />
            <Field label="ایمیل (اختیاری)" type="email" value={form.email || ""} onChange={(value) => updateField("email", value)} />
            <Field label="کد پستی (اختیاری)" inputMode="numeric" value={form.postal_code || ""} onChange={(value) => updateField("postal_code", value)} />
            <Field label="استان" required value={form.province} onChange={(value) => updateField("province", value)} />
            <Field label="شهر / شهرستان" required value={form.city} onChange={(value) => updateField("city", value)} />
          </div>

          <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
            نشانی کامل تحویل <span className="text-rose-500">*</span>
            <textarea required value={form.address} onChange={(event) => updateField("address", event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" />
          </label>
          <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
            توضیحات برای کارشناس یا ارسال (اختیاری)
            <textarea value={form.notes || ""} onChange={(event) => updateField("notes", event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" placeholder="زمان مناسب تماس، نیاز به مشاوره مصرف، مشخصات دسترسی و..." />
          </label>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="flex items-center gap-2 font-extrabold"><Phone size={17} /> پرداخت در این مرحله با هماهنگی کارشناس</div>
            <p className="mt-1">زرین‌پال هنوز متصل نشده است؛ برای جلوگیری از پرداخت ناموفق، سفارش ابتدا بررسی می‌شود و هیچ درگاه پرداختی باز نمی‌شود.</p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:bg-emerald-900/40 dark:text-emerald-100">
            <input type="checkbox" checked={form.terms_accepted} onChange={(event) => updateField("terms_accepted", event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-600" />
            <span>صحت اطلاعات تحویل را تأیید می‌کنم و می‌پذیرم سفارش پیش از هماهنگی کارشناس، پرداخت‌شده یا قطعی تلقی نمی‌شود.</span>
          </label>

          <button disabled={submitting || !cart?.items.length} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-600 to-lime-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50">
            <PackageCheck size={18} /> {submitting ? "در حال ثبت سفارش..." : "ثبت سفارش و درخواست هماهنگی"}
          </button>
        </form>

        <aside className="h-fit rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-900/30 lg:sticky lg:top-5">
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">خلاصه سفارش</h2>
          <ul className="mt-4 space-y-3 border-b border-emerald-100 pb-4 dark:border-emerald-800">
            {cart?.items.map((item) => <li key={item.id} className="flex items-start justify-between gap-3 text-sm"><span className="line-clamp-2 text-slate-600 dark:text-emerald-100">{item.quantity} × {item.product.title}</span><strong className="whitespace-nowrap text-slate-800 dark:text-white">{formatPrice(item.total_price)}</strong></li>)}
          </ul>
          <SummaryRow label="جمع کالاها" value={formatPrice(subtotal)} />
          <SummaryRow label="هزینه ارسال" value={shippingPrice === 0 ? "رایگان" : formatPrice(shippingPrice)} />
          <div className="mt-3 flex items-center justify-between border-t border-emerald-200 pt-4 text-base font-extrabold text-slate-800 dark:border-emerald-700 dark:text-white"><span>مبلغ قابل پرداخت</span><span className="text-emerald-700 dark:text-lime-300">{formatPrice(total)}</span></div>
          <div className="mt-5 flex gap-2 rounded-xl bg-white/70 p-3 text-[11px] leading-5 text-slate-500 dark:bg-emerald-950/50 dark:text-emerald-200"><ShieldCheck size={18} className="shrink-0 text-emerald-600" />مبلغ نهایی توسط سرور با قیمت و موجودی لحظه‌ای محاسبه می‌شود.</div>
        </aside>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", inputMode, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; inputMode?: "tel" | "numeric"; required?: boolean }) {
  return <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">{label} {required && <span className="text-rose-500">*</span>}<input required={required} type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" /></label>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="mt-3 flex justify-between text-sm text-slate-600 dark:text-emerald-100"><span>{label}</span><span className="font-bold">{value}</span></div>;
}
