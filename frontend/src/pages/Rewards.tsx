import { useEffect, useState } from "react";
import { Copy, Gift, WalletCards } from "lucide-react";
import toast from "react-hot-toast";

import { rewardsApi } from "../api/services";
import { useAuthStore } from "../store/authStore";
import type { Coupon, Wallet } from "../types";
import { formatPrice } from "../utils/formatPrice";
import { copyText } from "../utils/copyText";

export default function Rewards() {
  const { isAuthenticated } = useAuthStore();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    Promise.all([rewardsApi.myCoupons(), rewardsApi.wallet()]).then(([couponsResponse, walletResponse]) => {
      setCoupons(couponsResponse.data);
      setWallet(walletResponse.data);
    }).catch(() => toast.error('دریافت پاداش‌ها با خطا روبه‌رو شد.')).finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function copyCoupon(code: string) {
    try { await copyText(code); toast.success('کد تخفیف کپی شد.'); }
    catch { toast.error('کپی کد در این مرورگر ممکن نشد.'); }
  }

  if (!isAuthenticated) return <main className="mx-auto max-w-4xl px-4 py-10"><div className="rounded-3xl bg-amber-50 p-7 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">برای مشاهده کیف پول و کدهای تخفیف، ابتدا وارد حساب کاربری شوید.</div></main>;
  if (loading) return <main className="mx-auto max-w-4xl px-4 py-10 text-slate-500">در حال دریافت پاداش‌ها...</main>;
  return <main className="mx-auto max-w-5xl px-4 py-9"><section className="rounded-3xl bg-gradient-to-l from-amber-500 to-rose-500 p-8 text-white"><p className="text-sm font-bold text-amber-100">باشگاه خرید گرین کود</p><h1 className="mt-2 text-3xl font-extrabold">پاداش خرید، کیف پول و کدهای تخفیف</h1><p className="mt-3 max-w-3xl leading-7 text-white/90">پاداش‌ها فقط پس از تأیید پرداخت ثبت می‌شوند و تمام اعتبارها در دفتر قابل پیگیری باقی می‌مانند.</p></section><section className="mt-7 grid gap-5 md:grid-cols-[320px_1fr]"><article className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm dark:border-amber-900 dark:bg-emerald-950"><WalletCards className="text-amber-600" size={28} /><p className="mt-4 text-sm text-slate-500 dark:text-emerald-200">اعتبار قابل استفاده کیف پول</p><h2 className="mt-2 text-3xl font-extrabold text-slate-800 dark:text-white">{formatPrice(wallet?.balance || 0)}</h2><p className="mt-4 text-xs leading-6 text-slate-500 dark:text-emerald-200">این اعتبار مالی ثبت‌شده است و جایگزین فاکتور، پرداخت یا گزارش مالیاتی نمی‌شود.</p></article><section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><div className="flex items-center gap-2"><Gift className="text-rose-500" /><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">کدهای قابل استفاده</h2></div>{coupons.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{coupons.map((coupon) => <article key={coupon.id} className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/30"><div className="flex items-center justify-between gap-2"><strong dir="ltr" className="text-amber-800 dark:text-amber-100">{coupon.code}</strong><button onClick={() => copyCoupon(coupon.code)} aria-label="کپی کد"><Copy size={16} /></button></div><p className="mt-3 text-sm font-bold text-slate-800 dark:text-white">{coupon.description}</p><p className="mt-2 text-xs text-slate-500 dark:text-emerald-200">{coupon.discount_type === 'percentage' ? `${coupon.discount_value}٪ تخفیف` : formatPrice(coupon.discount_value)} · استفاده {coupon.usage_count} از {coupon.usage_limit || 'نامحدود'}</p>{coupon.valid_until && <p className="mt-1 text-xs text-slate-400">اعتبار تا {new Date(coupon.valid_until).toLocaleDateString('fa-IR')}</p>}</article>)}</div> : <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">پس از تأیید پرداخت سفارش، پاداش و کد تخفیف خرید بعدی اینجا نمایش داده می‌شود.</p>}</section></section></main>;
}
