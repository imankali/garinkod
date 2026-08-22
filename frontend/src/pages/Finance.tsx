import { useEffect, useState } from "react";
import { Landmark, ShieldCheck, Store, WalletCards } from "lucide-react";

import { financeApi } from "../api/services";
import { useAuthStore } from "../store/authStore";
import type { FinancialLedgerEntry, Storefront } from "../types";
import { formatPrice } from "../utils/formatPrice";

export default function Finance() {
  const { isAuthenticated } = useAuthStore();
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [entries, setEntries] = useState<FinancialLedgerEntry[]>([]);
  const [notice, setNotice] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "no-store">("loading");

  useEffect(() => {
    if (!isAuthenticated) { setState("no-store"); return; }
    financeApi.storefront().then((response) => {
      setStorefront(response.data.storefront);
      setBalances(response.data.balances);
      setEntries(response.data.entries);
      setNotice(response.data.notice);
      setState("ready");
    }).catch(() => setState("no-store"));
  }, [isAuthenticated]);

  return <main className="mx-auto max-w-6xl px-4 py-9"><section className="rounded-3xl bg-gradient-to-l from-slate-900 via-emerald-900 to-emerald-600 p-8 text-white"><p className="text-sm font-bold text-lime-200">دفتر مالی فروشنده</p><h1 className="mt-2 text-3xl font-extrabold">موجودی، کمیسیون و تسویه شفاف</h1><p className="mt-3 max-w-3xl leading-7 text-emerald-50">هیچ مبلغی بدون رویداد مالی، وضعیت و تاریخ در دفتر ثبت نمی‌شود. این صفحه جایگزین گزارش دستی و مبهم نیست.</p></section>{state === "loading" ? <p className="mt-7 text-slate-500">در حال دریافت دفتر مالی...</p> : state === "no-store" ? <section className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><Store size={28} /><h2 className="mt-3 text-xl font-extrabold">برای مشاهده دفتر مالی ابتدا غرفه بسازید</h2><p className="mt-2 text-sm leading-7">دفتر مالی فقط به غرفه فروشنده متصل است و تسویهٔ خودکار پس از فعال‌سازی سفارش امن marketplace قابل استفاده خواهد بود.</p></section> : <><section className="mt-7 grid gap-4 md:grid-cols-3"><Balance icon={WalletCards} label="در انتظار تأیید" value={balances.pending || 0} /><Balance icon={Landmark} label="قابل تسویه" value={balances.available || 0} /><Balance icon={ShieldCheck} label="مسدود برای رسیدگی" value={balances.held || 0} /></section><section className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{storefront?.name}</h2><p className="mt-1 text-sm text-slate-500 dark:text-emerald-200">{notice}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">کمیسیون فعلی: {storefront?.commission_rate}٪</span></div>{entries.length ? <div className="mt-5 space-y-3">{entries.map((entry) => <article key={entry.id} className="flex flex-wrap justify-between gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-emerald-900/40"><div><strong>{entry.entry_type_label}</strong><p className="mt-1 text-xs text-slate-500">{entry.description}</p></div><span>{entry.status_label}</span><strong className={entry.amount >= 0 ? "text-emerald-700 dark:text-lime-300" : "text-rose-600"}>{formatPrice(Math.abs(entry.amount))}</strong></article>)}</div> : <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">هنوز رویداد مالی ثبت نشده است. با راه‌اندازی سفارش امن marketplace و تأیید پرداخت، رکوردها به‌صورت خودکار ایجاد می‌شوند.</p>}</section></>}</main>;
}
function Balance({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: number }) { return <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><Icon className="text-emerald-600 dark:text-lime-300" /><p className="mt-4 text-xl font-extrabold text-slate-800 dark:text-white">{formatPrice(value)}</p><p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">{label}</p></article>; }
