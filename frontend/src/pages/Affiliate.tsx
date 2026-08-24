import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Gift, Link2, Megaphone, WalletCards } from "lucide-react";
import toast from "react-hot-toast";

import { affiliateApi } from "../api/services";
import { useAuthStore } from "../store/authStore";
import type { AffiliateConversion, AffiliateProfile, FinancialLedgerEntry } from "../types";
import { formatPrice } from "../utils/formatPrice";
import { copyText } from "../utils/copyText";

export default function Affiliate() {
  const { isAuthenticated } = useAuthStore();
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [conversions, setConversions] = useState<AffiliateConversion[]>([]);
  const [ledger, setLedger] = useState<FinancialLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await affiliateApi.me();
      setProfile(response.data.profile);
      setConversions(response.data.conversions);
      setLedger(response.data.ledger);
    } finally { setLoading(false); }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  async function join() {
    if (!isAuthenticated) { toast.error("برای همکاری در فروش ابتدا وارد حساب کاربری شوید."); return; }
    setJoining(true);
    try {
      const response = await affiliateApi.join();
      setProfile(response.data.profile);
      toast.success(response.data.message);
    } catch {
      // API client handles the message.
    } finally { setJoining(false); }
  }

  const referralUrl = useMemo(() => profile ? `${window.location.origin}/?ref=${profile.code}` : "", [profile]);
  async function copyReferral() {
    try { await copyText(referralUrl); toast.success("لینک کپی شد."); }
    catch { toast.error("کپی لینک در این مرورگر ممکن نشد."); }
  }
  const pending = ledger.filter((entry) => entry.status === "pending").reduce((sum, entry) => sum + entry.amount, 0);
  const available = ledger.filter((entry) => entry.status === "available").reduce((sum, entry) => sum + entry.amount, 0);

  return <main className="mx-auto max-w-6xl px-[var(--page-gutter)] py-9"><section className="rounded-3xl bg-gradient-to-l from-violet-800 via-indigo-700 to-emerald-600 p-8 text-white"><p className="text-sm font-bold text-lime-200">همکاری در فروش شفاف</p><h1 className="mt-2 text-3xl font-extrabold">لینک معرفی، تبدیل تأییدشده و کمیسیون قابل پیگیری</h1><p className="mt-3 max-w-3xl leading-7 text-indigo-50">کمیسیون فقط پس از پرداخت تأییدشده و طبق سیاست مصوب قابل تسویه می‌شود. کلیک یا سفارش لغوشده سود قطعی ایجاد نمی‌کند.</p></section>{!isAuthenticated ? <section className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">برای ساخت لینک همکاری در فروش وارد حساب کاربری شوید.</section> : loading ? <p className="mt-7 text-slate-500">در حال دریافت داشبورد همکاری...</p> : !profile ? <section className="mt-7 rounded-3xl border border-slate-100 bg-white p-7 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><Gift className="text-violet-600" size={30} /><h2 className="mt-4 text-xl font-extrabold text-slate-800 dark:text-white">شروع همکاری در فروش</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500 dark:text-emerald-200">پس از درخواست، حساب همکاری توسط تیم عملیات بررسی می‌شود. نرخ کمیسیون و شرایط تسویه در پنل و قرارداد مشخص خواهد بود.</p><button onClick={join} disabled={joining} className="mt-5 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{joining ? "در حال ثبت..." : "ثبت درخواست همکاری"}</button></section> : <><section className="mt-7 grid gap-4 md:grid-cols-3"><Stat icon={Link2} label="کد معرفی" value={profile.code} /><Stat icon={WalletCards} label="در انتظار تأیید" value={formatPrice(pending)} /><Stat icon={Gift} label="قابل تسویه" value={formatPrice(available)} /></section><section className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">لینک همکاری شما</h2><p className="mt-1 text-sm text-slate-500 dark:text-emerald-200">وضعیت حساب: {profile.status_label} · نرخ فعلی: {profile.commission_rate}٪</p></div><button onClick={copyReferral} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-bold text-violet-700 dark:border-violet-800 dark:text-violet-200"><Copy size={16} />کپی لینک</button></div><code className="mt-4 block overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-emerald-900/40 dark:text-emerald-100" dir="ltr">{referralUrl}</code>{profile.status !== "active" && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800 dark:bg-amber-950/40 dark:text-amber-100">کد ایجاد شده است اما تا تأیید تیم عملیات، تبدیل جدید برای پرداخت کمیسیون پذیرفته نمی‌شود.</p>}</section><section className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><div className="flex items-center gap-2"><Megaphone className="text-violet-600" /><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">تبدیل‌ها و کمیسیون</h2></div>{conversions.length ? <div className="mt-4 space-y-3">{conversions.map((conversion) => <div key={conversion.id} className="flex flex-wrap justify-between gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-emerald-900/40"><span dir="ltr" className="font-bold">{conversion.order_code}</span><span>{conversion.status_label}</span><strong className="text-emerald-700 dark:text-lime-300">{formatPrice(conversion.commission_amount)}</strong></div>)}</div> : <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">هنوز تبدیل تأییدشده‌ای وجود ندارد.</p>}</section></>}</main>;
}
function Stat({ icon: Icon, label, value }: { icon: typeof Gift; label: string; value: string }) { return <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><Icon size={21} className="text-violet-600" /><p className="mt-4 text-lg font-extrabold text-slate-800 dark:text-white" dir={label === "کد معرفی" ? "ltr" : undefined}>{value}</p><p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">{label}</p></article>; }
