import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, PackageSearch, RefreshCw, Truck } from "lucide-react";
import toast from "react-hot-toast";

import { ordersApi } from "../api/services";
import { useAuthStore } from "../store/authStore";
import type { Order } from "../types";
import { formatPrice } from "../utils/formatPrice";

export default function Orders() {
  const { isAuthenticated } = useAuthStore();
  const [code, setCode] = useState(() => localStorage.getItem("last_order_code") || "");
  const [phone, setPhone] = useState(() => localStorage.getItem("last_order_phone") || "");
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    ordersApi.mine().then((response) => setMyOrders(response.data)).catch(() => undefined);
  }, [isAuthenticated]);

  async function cancel(order: Order) {
    if (!window.confirm('آیا از لغو این سفارش مطمئن هستید؟ موجودی رزروشده آزاد می‌شود.')) return;
    try {
      const response = await ordersApi.cancel(order.code, order.phone);
      setFoundOrder((current) => current?.id === order.id ? response.data.order : current);
      setMyOrders((current) => current.map((item) => item.id === order.id ? response.data.order : item));
      toast.success(response.data.message);
    } catch {
      // API client reports why this order cannot be cancelled.
    }
  }

  async function lookup(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await ordersApi.lookup(code, phone);
      setFoundOrder(response.data);
      localStorage.setItem("last_order_code", code.toUpperCase());
      localStorage.setItem("last_order_phone", phone);
    } catch {
      setFoundOrder(null);
      toast.error("سفارشی با این کد و شماره تماس پیدا نشد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-9">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-bold text-emerald-700 dark:text-lime-300">پیگیری شفاف سفارش</p><h1 className="mt-1 text-3xl font-extrabold text-slate-800 dark:text-white">سفارش‌های من</h1></div>
        <Link to="/products" className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:border-emerald-700 dark:text-lime-300">بازگشت به محصولات</Link>
      </div>

      <section className="mt-7 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300"><PackageSearch size={22} /></span><div><h2 className="font-extrabold text-slate-800 dark:text-white">پیگیری سفارش مهمان</h2><p className="text-xs text-slate-500 dark:text-emerald-200">کد سفارش و همان شماره‌ای که هنگام ثبت وارد کردید را بنویسید.</p></div></div>
        <form onSubmit={lookup} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input required value={code} onChange={(event) => setCode(event.target.value)} placeholder="کد سفارش، مانند GK-..." className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" dir="ltr" />
          <input required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="شماره تماس" className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" />
          <button disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />پیگیری</button>
        </form>
      </section>

      {foundOrder && <OrderCard order={foundOrder} className="mt-6" onCancel={cancel} />}

      {isAuthenticated && <section className="mt-8"><div className="mb-4 flex items-center gap-2"><ClipboardList className="text-emerald-600" /><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">سفارش‌های حساب کاربری</h2></div>{myOrders.length ? <div className="space-y-4">{myOrders.map((order) => <OrderCard key={order.id} order={order} onCancel={cancel} />)}</div> : <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">هنوز سفارشی با این حساب ثبت نشده است.</p>}</section>}
    </main>
  );
}

function OrderCard({ order, className = "", onCancel }: { order: Order; className?: string; onCancel?: (order: Order) => void }) {
  const cancellable = order.status === 'awaiting_review' && order.payment_status === 'unpaid';
  return <article className={`rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 ${className}`}><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="text-xs text-slate-400">کد سفارش</p><h2 className="mt-1 font-extrabold text-emerald-700 dark:text-lime-300" dir="ltr">{order.code}</h2></div><div className="flex gap-2"><span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">{order.status_label}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-emerald-900 dark:text-emerald-100">{order.payment_status_label}</span></div></div><div className="mt-4 grid gap-3 border-y border-slate-100 py-4 text-sm sm:grid-cols-3 dark:border-emerald-900"><span><strong>گیرنده: </strong>{order.customer_name}</span><span><strong>تاریخ: </strong>{new Date(order.created_at).toLocaleDateString("fa-IR")}</span><span><strong>مبلغ: </strong>{formatPrice(order.total_price)}</span></div><ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-emerald-100">{order.items.map((item) => <li key={item.id} className="flex justify-between gap-4"><span>{item.quantity} × {item.product_title}</span><span>{formatPrice(item.total_price)}</span></li>)}</ul><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-slate-400"><Truck size={15} />آدرس تحویل: {order.province}، {order.city}</p>{cancellable && onCancel && <button onClick={() => onCancel(order)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30">لغو سفارش و آزادسازی موجودی</button>}</div></article>;
}
