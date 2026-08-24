import { FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, MessageSquareHeart, Send, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

import { trustApi } from "../api/services";
import { useAuthStore } from "../store/authStore";

export default function Support() {
  const { isAuthenticated, user } = useAuthStore();
  const [params] = useSearchParams();
  const storefrontId = useMemo(() => Number(params.get("storefront") || 0), [params]);
  const listingId = useMemo(() => Number(params.get("listing") || 0), [params]);
  const [feedback, setFeedback] = useState({ kind: "suggestion" as "suggestion" | "criticism" | "consultation" | "other", subject: "", message: "", name: user?.first_name || "", email: user?.email || "" });
  const [complaint, setComplaint] = useState({ subject: "", description: "" });
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [sendingComplaint, setSendingComplaint] = useState(false);

  async function sendFeedback(event: FormEvent) {
    event.preventDefault();
    setSendingFeedback(true);
    try {
      await trustApi.feedback(feedback);
      setFeedback({ ...feedback, subject: "", message: "" });
      toast.success("بازخورد شما ثبت شد. سپاس از کمک به بهترشدن گرین کود.");
    } catch {
      // API client displays the error.
    } finally { setSendingFeedback(false); }
  }

  async function sendComplaint(event: FormEvent) {
    event.preventDefault();
    if (!isAuthenticated) {
      toast.error("برای ثبت شکایت از غرفه، ابتدا وارد حساب کاربری شوید.");
      return;
    }
    if (!storefrontId) {
      toast.error("لطفاً شکایت را از صفحه آگهی یا غرفه مربوطه آغاز کنید.");
      return;
    }
    setSendingComplaint(true);
    try {
      await trustApi.complaint({ storefront: storefrontId, listing: listingId || undefined, ...complaint });
      setComplaint({ subject: "", description: "" });
      toast.success("شکایت ثبت شد و در صف رسیدگی قرار گرفت.");
    } catch {
      // API client displays the error.
    } finally { setSendingComplaint(false); }
  }

  return <main className="mx-auto max-w-5xl px-4 py-9"><div className="rounded-3xl bg-gradient-to-l from-emerald-800 to-emerald-600 p-7 text-white"><p className="text-sm font-bold text-lime-200">صدای شما برای ما مهم است</p><h1 className="mt-2 text-3xl font-extrabold">پیشنهاد، انتقاد و رسیدگی منصفانه</h1><p className="mt-3 max-w-2xl leading-7 text-emerald-50">بازخورد عمومی و شکایت از غرفه از هم جدا نگه‌داری می‌شوند تا هر مورد به تیم درست ارجاع و قابل پیگیری باشد.</p></div><div className="mt-7 grid gap-6 lg:grid-cols-2"><section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300"><MessageSquareHeart size={22} /></span><div><h2 className="font-extrabold text-slate-800 dark:text-white">بازخورد پلتفرم</h2><p className="text-xs text-slate-500 dark:text-emerald-200">پیشنهاد، انتقاد یا نیاز به راهنمایی</p></div></div><form onSubmit={sendFeedback} className="mt-5 space-y-4"><label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">نوع بازخورد<select value={feedback.kind} onChange={(event) => setFeedback({ ...feedback, kind: event.target.value as typeof feedback.kind })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal dark:border-emerald-700 dark:bg-emerald-900"><option value="suggestion">پیشنهاد</option><option value="criticism">انتقاد</option><option value="consultation">نیاز به راهنمایی</option><option value="other">سایر</option></select></label><label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">موضوع<input required value={feedback.subject} onChange={(event) => setFeedback({ ...feedback, subject: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal dark:border-emerald-700 dark:bg-emerald-900" /></label><label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">پیام<textarea required value={feedback.message} onChange={(event) => setFeedback({ ...feedback, message: event.target.value })} rows={5} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal dark:border-emerald-700 dark:bg-emerald-900" /></label><button disabled={sendingFeedback} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Send size={16} />{sendingFeedback ? "در حال ارسال..." : "ارسال بازخورد"}</button></form></section><section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm dark:border-amber-900 dark:bg-amber-950/30"><div className="flex items-center gap-3"><span className="rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-900 dark:text-amber-200"><AlertTriangle size={22} /></span><div><h2 className="font-extrabold text-amber-900 dark:text-amber-100">شکایت از غرفه</h2><p className="text-xs text-amber-800 dark:text-amber-200">برای رسیدگی منصفانه به معامله و فروشنده</p></div></div>{storefrontId ? <form onSubmit={sendComplaint} className="mt-5 space-y-4"><p className="rounded-xl bg-white/80 p-3 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-100"><ShieldCheck size={15} className="me-1 inline" />شکایت شما با شناسه غرفه {storefrontId} ثبت و فقط برای تیم رسیدگی قابل مشاهده است.</p><label className="block text-sm font-bold text-amber-900 dark:text-amber-100">موضوع<input required value={complaint.subject} onChange={(event) => setComplaint({ ...complaint, subject: event.target.value })} className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 font-normal dark:border-amber-800 dark:bg-emerald-950" /></label><label className="block text-sm font-bold text-amber-900 dark:text-amber-100">شرح موضوع<textarea required value={complaint.description} onChange={(event) => setComplaint({ ...complaint, description: event.target.value })} rows={5} className="mt-2 w-full rounded-xl border border-amber-200 bg-white p-3 font-normal dark:border-amber-800 dark:bg-emerald-950" /></label><button disabled={sendingComplaint} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{sendingComplaint ? "در حال ثبت..." : "ثبت شکایت"}</button></form> : <div className="mt-5 rounded-2xl bg-white/80 p-5 text-sm leading-7 text-amber-800 dark:bg-amber-950/50 dark:text-amber-100">برای جلوگیری از شکایت‌های مبهم، ثبت شکایت باید از آگهی یا غرفهٔ مشخص آغاز شود. <Link to="/marketplace" className="font-bold underline">مشاهده بازار کشاورزان</Link></div>}</section></div></main>;
}
