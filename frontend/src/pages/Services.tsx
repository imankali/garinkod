import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Droplets, Leaf, Sprout, Tractor, Wrench, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";

import { agricultureApi } from "../api/services";
import type { ServiceRequestPayload } from "../types";

const SERVICES: { id: ServiceRequestPayload['service_type']; title: string; text: string; icon: typeof Droplets }[] = [
  { id: 'agronomy', title: 'مشاوره زراعی', text: 'برنامه تغذیه، آفات، بیماری و زمان‌بندی مصرف نهاده.', icon: Sprout },
  { id: 'irrigation', title: 'طراحی و نصب آبیاری', text: 'ارزیابی مزرعه، طراحی، اجرا و نگهداری آبیاری قطره‌ای و بارانی.', icon: Droplets },
  { id: 'soil', title: 'آزمایش و بهبود خاک', text: 'نمونه‌برداری، تحلیل خاک و برنامه اصلاح و کوددهی.', icon: Leaf },
  { id: 'greenhouse', title: 'گلخانه و کشت کنترل‌شده', text: 'مشاوره راه‌اندازی، تجهیزات و بهره‌برداری.', icon: Wrench },
  { id: 'machinery', title: 'ماشین‌آلات و تعمیرات', text: 'تأمین، سرویس و راهکار مکانیزاسیون.', icon: Tractor },
  { id: 'other', title: 'سایر نیازهای مزرعه', text: 'نیاز خود را شرح دهید تا به کارشناس مرتبط ارجاع شود.', icon: MessageCircle },
];

const INITIAL: ServiceRequestPayload = { service_type: 'agronomy', customer_name: '', phone: '', province: '', city: '', crop: '', farm_area_hectare: undefined, description: '' };

export default function Services() {
  const [form, setForm] = useState<ServiceRequestPayload>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await agricultureApi.requestService(form);
      setReference(response.data.request.code);
      toast.success('درخواست خدمت ثبت شد.');
    } catch {
      // API client shows the error.
    } finally { setSubmitting(false); }
  }

  return <main className="mx-auto max-w-6xl px-[var(--page-gutter)] py-9"><section className="rounded-3xl bg-gradient-to-l from-emerald-700 to-lime-600 p-7 text-white md:p-10"><p className="text-sm font-bold text-lime-100">شبکه خدمات مزرعه</p><h1 className="mt-2 text-3xl font-extrabold">از مشاوره تا اجرای آبیاری در کنار کشاورز</h1><p className="mt-3 max-w-2xl leading-7 text-emerald-50">درخواست خود را ثبت کنید؛ این درخواست برای ارزیابی به تیم مرتبط می‌رسد و پیش از هر قرارداد، زمان‌بندی و هزینه با شما هماهنگ می‌شود.</p></section><section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{SERVICES.map((service) => { const Icon = service.icon; const selected = form.service_type === service.id; return <button type="button" key={service.id} onClick={() => setForm((current) => ({ ...current, service_type: service.id }))} className={`rounded-2xl border p-5 text-start transition ${selected ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200 dark:border-lime-400 dark:bg-emerald-900' : 'border-slate-100 bg-white hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950'}`}><Icon className="text-emerald-600 dark:text-lime-300" /><h2 className="mt-3 font-extrabold text-slate-800 dark:text-white">{service.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-emerald-200">{service.text}</p></button>; })}</section><section className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]"><form onSubmit={submit} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">ثبت درخواست {SERVICES.find((service) => service.id === form.service_type)?.title}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Input label="نام و نام خانوادگی" value={form.customer_name} onChange={(value) => setForm({ ...form, customer_name: value })} /><Input label="شماره تماس" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><Input label="استان" value={form.province} onChange={(value) => setForm({ ...form, province: value })} /><Input label="شهرستان" value={form.city} onChange={(value) => setForm({ ...form, city: value })} /><Input label="محصول/کشت (اختیاری)" value={form.crop || ''} onChange={(value) => setForm({ ...form, crop: value })} /><Input label="مساحت مزرعه (هکتار، اختیاری)" type="number" value={form.farm_area_hectare?.toString() || ''} onChange={(value) => setForm({ ...form, farm_area_hectare: value ? Number(value) : undefined })} /></div><label className="mt-4 block text-sm font-bold text-slate-700 dark:text-emerald-50">شرح نیاز <textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" rows={5} placeholder="نوع زمین، مشکل فعلی، زمان مورد انتظار و اطلاعاتی که به کارشناس کمک می‌کند..." /></label><button disabled={submitting} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{submitting ? 'در حال ثبت...' : 'ثبت درخواست خدمت'}</button></form><aside className="h-fit rounded-3xl bg-emerald-50 p-6 dark:bg-emerald-900/40"><h2 className="font-extrabold text-slate-800 dark:text-white">فرآیند شفاف</h2><ol className="mt-4 space-y-4 text-sm leading-6 text-slate-600 dark:text-emerald-100"><li><strong>۱. ثبت نیاز:</strong> اطلاعات مزرعه و خدمت مدنظر ثبت می‌شود.</li><li><strong>۲. بررسی:</strong> تیم مناسب درخواست را ارزیابی می‌کند.</li><li><strong>۳. پیشنهاد:</strong> محدوده کار، زمان و هزینه پیش از اجرا هماهنگ می‌شود.</li><li><strong>۴. اجرا و پشتیبانی:</strong> وضعیت کار قابل پیگیری خواهد بود.</li></ol>{reference && <p className="mt-5 rounded-xl bg-white p-3 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-lime-300">کد پیگیری درخواست: {reference}</p>}<Link to="/farmer-sell" className="mt-6 inline-block text-sm font-bold text-emerald-700 underline dark:text-lime-300">محصول کشاورزی برای فروش دارید؟</Link></aside></section></main>;
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">{label}<input required={!label.includes('اختیاری')} type={type} min={type === 'number' ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" /></label>; }
