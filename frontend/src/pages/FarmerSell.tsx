import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from 'react-router';
import { BadgeDollarSign, BarChart3, Handshake, MessageCircle, Wheat } from "lucide-react";
import toast from "react-hot-toast";

import { agricultureApi } from "../api/services";
import type { ProcurementRequestPayload } from '@/types/commerce';
import { normalizePhoneNumber, normalizeNumericInput } from "../utils/normalizeDigits";
import { useAuthStore } from "../store/authStore";

const INITIAL: ProcurementRequestPayload = { farmer_name: '', phone: '', crop_name: '', variety: '', quantity: 0, unit: 'کیلوگرم', province: '', city: '', description: '' };

export default function FarmerSell() {
  const navigate = useNavigate();
  const { isAuthenticated, account, user } = useAuthStore();
  const [form, setForm] = useState<ProcurementRequestPayload>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState('');
  // After a signed-in submit: the procurement thread the offer was posted to —
  // «گفتگو را باز کنید» jumps into it for follow-up with the buying team.
  const [threadId, setThreadId] = useState<number | null>(null);

  const hasAccountPhone = Boolean((account?.phone || '').trim());
  const fullName = useMemo(() => {
    const first = user?.first_name || '';
    const last = user?.last_name || '';
    return `${first} ${last}`.trim() || account?.full_name || user?.username || '';
  }, [user, account]);

  // Same prefill contract as /services: a signed-in seller starts from the
  // account, and the phone is only captured here when the account lacks one.
  useEffect(() => {
    if (!isAuthenticated) return;
    setForm((current) => ({
      ...current,
      farmer_name: current.farmer_name || fullName,
      phone: current.phone || (account?.phone || ''),
    }));
  }, [isAuthenticated, fullName, account?.phone]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await agricultureApi.requestProcurement(form);
      setReference(response.data.request.code);
      setThreadId(response.data.conversation_id ?? null);
      toast.success(
        isAuthenticated
          ? 'درخواست ثبت شد و در گفتگوی «خرید محصولات کشاورزان» برای تیم خرید ارسال شد.'
          : 'درخواست فروش محصول ثبت شد.',
      );
    } catch {
      // API client reports the failure.
    } finally { setSubmitting(false); }
  }

  const update = <Key extends keyof ProcurementRequestPayload>(key: Key, value: ProcurementRequestPayload[Key]) => setForm((current) => ({ ...current, [key]: value }));
  return <main className="mx-auto max-w-6xl px-[var(--page-gutter)] py-9"><section className="grid overflow-hidden rounded-3xl bg-slate-900 text-white md:grid-cols-2"><div className="p-8 md:p-10"><p className="text-sm font-bold text-lime-300">تأمین و تجارت محصول کشاورز</p><h1 className="mt-2 text-3xl font-extrabold">محصولتان را برای خرید عمده معرفی کنید</h1><p className="mt-4 leading-7 text-slate-200">غلات، حبوبات، میوه، سبزی، خشکبار و دیگر محصولات کشاورزی را ثبت کنید. تیم خرید کیفیت، حجم، محل تحویل و شرایط بازار را ارزیابی می‌کند و در صورت تطابق پیشنهاد می‌دهد.</p><div className="mt-7 grid grid-cols-1 gap-2 text-center text-xs sm:grid-cols-3 sm:gap-3"><Feature icon={Wheat} text="محصولات متنوع" /><Feature icon={Handshake} text="مذاکره شفاف" /><Feature icon={BarChart3} text="ارزیابی بازار" /></div></div><div className="min-h-56 bg-[url('/images/hero-farm.jpg')] bg-cover bg-center" /></section><section className="mt-8 grid gap-6 lg:grid-cols-[1fr_330px]"><form onSubmit={submit} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">اطلاعات محصول قابل عرضه</h2>{isAuthenticated ? <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-fluid-2xs leading-6 text-emerald-700 dark:bg-emerald-900/50 dark:text-lime-200">درخواست شما مستقیم در گفتگوی «خرید محصولات کشاورزان» پیام‌رسان ثبت می‌شود و تیم خرید همان‌جا پاسخ می‌دهد.</p> : null}<div className="mt-5 grid gap-4 sm:grid-cols-2"><Input label="نام کشاورز / مجموعه" value={form.farmer_name} onChange={(value) => update('farmer_name', value)} /><Input label={hasAccountPhone ? 'شماره تماس' : 'شماره تماس (برای پیگیری ثبت می‌شود)'} value={form.phone} onChange={(value) => update('phone', normalizePhoneNumber(value))} /><Input label="نام محصول" value={form.crop_name} onChange={(value) => update('crop_name', value)} /><Input label="رقم یا گرید (اختیاری)" required={false} value={form.variety || ''} onChange={(value) => update('variety', value)} /><Input label="مقدار قابل عرضه" type="text" value={form.quantity ? String(form.quantity) : ''} onChange={(value) => update('quantity', Number(normalizeNumericInput(value, true)) || 0)} /><Input label="واحد" value={form.unit || ''} onChange={(value) => update('unit', value)} /><Input label="استان" value={form.province} onChange={(value) => update('province', value)} /><Input label="شهر / محل بارگیری" value={form.city} onChange={(value) => update('city', value)} /><Input label="قیمت پیشنهادی هر واحد (تومان، اختیاری)" type="text" required={false} value={form.requested_price ? String(form.requested_price) : ''} onChange={(value) => update('requested_price', Number(normalizeNumericInput(value, false)) || undefined)} /><label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">تاریخ برداشت (اختیاری)<input type="date" value={form.harvest_date || ''} onChange={(event) => update('harvest_date', event.target.value || undefined)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" /></label></div><label className="mt-4 block text-sm font-bold text-slate-700 dark:text-emerald-50">توضیحات کیفیت، بسته‌بندی یا شرایط تحویل (اختیاری)<textarea value={form.description || ''} onChange={(event) => update('description', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" rows={4} /></label><div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={submitting || form.quantity <= 0} className="inline-flex items-center gap-2 rounded-xl min-h-12 bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600 disabled:active:scale-100"><BadgeDollarSign size={18} />{submitting ? 'در حال ثبت...' : 'ثبت درخواست فروش محصول'}</button>{threadId && (<button type="button" onClick={() => navigate(`/messages?c=${threadId}`)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-emerald-300 px-4 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900"><MessageCircle size={16} />گفتگو را باز کنید</button>)}</div></form><aside className="h-fit rounded-3xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30"><h2 className="font-extrabold text-amber-900 dark:text-amber-100">نکته مهم</h2><p className="mt-3 text-sm leading-7 text-amber-800 dark:text-amber-200">ثبت درخواست به معنی خرید قطعی یا قیمت تضمینی نیست. کیفیت، حجم، استاندارد، زمان برداشت، نمونه و لجستیک پیش از قرارداد بررسی می‌شوند.</p>{reference && <p className="mt-5 rounded-xl bg-white p-3 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-lime-300">کد پیگیری: {reference}</p>}<div className="mt-5 flex flex-col gap-2"><Link to="/storefronts" className="inline-flex min-h-11 items-center text-fluid-sm font-bold text-emerald-700 underline dark:text-lime-300">مشاهده بازار غرفه‌داران</Link><Link to="/legal" className="inline-flex min-h-11 items-center text-fluid-sm font-bold text-amber-800 underline dark:text-amber-200">قوانینی که این درخواست را چارچوب می‌دهد</Link></div></aside></section></main>;
}

function Feature({ icon: Icon, text }: { icon: typeof Wheat; text: string }) { return <div className="rounded-2xl bg-white/5 p-3"><Icon size={18} className="mx-auto text-lime-300" /><p className="mt-1.5 font-bold">{text}</p></div>; }

function Input({ label, value, onChange, type = 'text', required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" /></label>; }
