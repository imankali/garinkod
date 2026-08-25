import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeDollarSign, BarChart3, Handshake, Wheat } from "lucide-react";
import toast from "react-hot-toast";

import { agricultureApi } from "../api/services";
import type { ProcurementRequestPayload } from "../types";

const INITIAL: ProcurementRequestPayload = { farmer_name: '', phone: '', crop_name: '', variety: '', quantity: 0, unit: 'کیلوگرم', province: '', city: '', description: '' };

export default function FarmerSell() {
  const [form, setForm] = useState<ProcurementRequestPayload>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await agricultureApi.requestProcurement(form);
      setReference(response.data.request.code);
      toast.success('درخواست فروش محصول ثبت شد.');
    } catch {
      // API client reports the failure.
    } finally { setSubmitting(false); }
  }

  const update = <Key extends keyof ProcurementRequestPayload>(key: Key, value: ProcurementRequestPayload[Key]) => setForm((current) => ({ ...current, [key]: value }));
  return <main className="mx-auto max-w-6xl px-[var(--page-gutter)] py-9"><section className="grid overflow-hidden rounded-3xl bg-slate-900 text-white md:grid-cols-2"><div className="p-8 md:p-10"><p className="text-sm font-bold text-lime-300">تأمین و تجارت محصول کشاورز</p><h1 className="mt-2 text-3xl font-extrabold">محصولتان را برای خرید عمده معرفی کنید</h1><p className="mt-4 leading-7 text-slate-200">غلات، حبوبات، میوه، سبزی، خشکبار و دیگر محصولات کشاورزی را ثبت کنید. تیم خرید کیفیت، حجم، محل تحویل و شرایط بازار را ارزیابی می‌کند و در صورت تطابق پیشنهاد می‌دهد.</p><div className="mt-7 grid grid-cols-3 gap-3 text-center text-xs"><Feature icon={Wheat} text="محصولات متنوع" /><Feature icon={Handshake} text="مذاکره شفاف" /><Feature icon={BarChart3} text="ارزیابی بازار" /></div></div><div className="min-h-56 bg-[url('/images/hero-farm.jpg')] bg-cover bg-center" /></section><section className="mt-8 grid gap-6 lg:grid-cols-[1fr_330px]"><form onSubmit={submit} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">اطلاعات محصول قابل عرضه</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Input label="نام کشاورز / مجموعه" value={form.farmer_name} onChange={(value) => update('farmer_name', value)} /><Input label="شماره تماس" value={form.phone} onChange={(value) => update('phone', value)} /><Input label="نام محصول" value={form.crop_name} onChange={(value) => update('crop_name', value)} /><Input label="رقم یا گرید (اختیاری)" required={false} value={form.variety || ''} onChange={(value) => update('variety', value)} /><Input label="مقدار قابل عرضه" type="number" value={form.quantity ? String(form.quantity) : ''} onChange={(value) => update('quantity', Number(value))} /><Input label="واحد" value={form.unit || ''} onChange={(value) => update('unit', value)} /><Input label="استان" value={form.province} onChange={(value) => update('province', value)} /><Input label="شهر / محل بارگیری" value={form.city} onChange={(value) => update('city', value)} /><Input label="قیمت پیشنهادی هر واحد (تومان، اختیاری)" type="number" required={false} value={form.requested_price ? String(form.requested_price) : ''} onChange={(value) => update('requested_price', value ? Number(value) : undefined)} /><label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">تاریخ برداشت (اختیاری)<input type="date" value={form.harvest_date || ''} onChange={(event) => update('harvest_date', event.target.value || undefined)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" /></label></div><label className="mt-4 block text-sm font-bold text-slate-700 dark:text-emerald-50">توضیحات کیفیت، بسته‌بندی یا شرایط تحویل (اختیاری)<textarea value={form.description || ''} onChange={(event) => update('description', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" rows={4} /></label><button disabled={submitting || form.quantity <= 0} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><BadgeDollarSign size={18} />{submitting ? 'در حال ثبت...' : 'ثبت درخواست فروش محصول'}</button></form><aside className="h-fit rounded-3xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30"><h2 className="font-extrabold text-amber-900 dark:text-amber-100">نکته مهم</h2><p className="mt-3 text-sm leading-7 text-amber-800 dark:text-amber-200">ثبت درخواست به معنی خرید قطعی یا قیمت تضمینی نیست. کیفیت، حجم، استاندارد، زمان برداشت، نمونه و لجستیک پیش از قرارداد بررسی می‌شوند.</p>{reference && <p className="mt-5 rounded-xl bg-white p-3 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-lime-300">کد پیگیری: {reference}</p>}<Link to="/marketplace" className="mt-5 inline-flex min-h-11 items-center text-fluid-sm font-bold text-emerald-700 underline dark:text-lime-300">مشاهده بازار کشاورزان و غرفه‌ها</Link></aside></section></main>;
}

function Feature({ icon: Icon, text }: { icon: typeof Wheat; text: string }) { return <div className="rounded-xl bg-white/10 p-3"><Icon className="mx-auto text-lime-300" size={21} /><span className="mt-2 block">{text}</span></div>; }
function Input({ label, value, onChange, type = 'text', required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">{label}<input required={required} type={type} min={type === 'number' ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" /></label>; }
