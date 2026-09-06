import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Droplets, Leaf, Loader2, MessageCircle, Sprout, Tractor, Wrench } from "lucide-react";
import toast from "react-hot-toast";

import { agricultureApi, farmServicesApi } from "../api/services";
import type { ServiceRequestPayload } from "../types";
import { normalizePhoneNumber, normalizeNumericInput } from "../utils/normalizeDigits";

// Local fallback so the form still works if the admin has not published any
// service rows yet; when rows exist they come from the API and each one has its
// own detail page (Royal Kesh-style «صفحه جزئیات خدمت»).
const FALLBACK_SERVICES: { id: ServiceRequestPayload['service_type']; title: string; text: string; icon: typeof Droplets }[] = [
  { id: 'agronomy', title: 'مشاوره زراعی', text: 'برنامه تغذیه، آفات، بیماری و زمان‌بندی مصرف نهاده.', icon: Sprout },
  { id: 'irrigation', title: 'طراحی و نصب آبیاری', text: 'ارزیابی مزرعه، طراحی، اجرا و نگهداری آبیاری قطره‌ای و بارانی.', icon: Droplets },
  { id: 'soil', title: 'آزمایش و بهبود خاک', text: 'نمونه‌برداری، تحلیل خاک و برنامه اصلاح و کوددهی.', icon: Leaf },
  { id: 'greenhouse', title: 'گلخانه و کشت کنترل‌شده', text: 'مشاوره راه‌اندازی، تجهیزات و بهره‌برداری.', icon: Wrench },
  { id: 'machinery', title: 'ماشین‌آلات و تعمیرات', text: 'تأمین، سرویس و راهکار مکانیزاسیون.', icon: Tractor },
  { id: 'other', title: 'سایر نیازهای مزرعه', text: 'نیاز خود را شرح دهید تا به کارشناس مرتبط ارجاع شود.', icon: MessageCircle },
];

const ICONS: Record<string, typeof Sprout> = {
  sprout: Sprout,
  droplets: Droplets,
  leaf: Leaf,
  wrench: Wrench,
  warehouse: Wrench,
  tractor: Tractor,
  'message-circle': MessageCircle,
};

const INITIAL: ServiceRequestPayload = { service_type: 'agronomy', customer_name: '', phone: '', province: '', city: '', crop: '', farm_area_hectare: undefined, description: '' };

export default function Services() {
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<ServiceRequestPayload>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState('');

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => (await farmServicesApi.getAll()).data,
    staleTime: 5 * 60 * 1000,
  });

  // A service page links here with ?service=<code> so the right option is
  // already chosen when the buyer arrives.
  useEffect(() => {
    const code = params.get('service');
    if (code) setForm((current) => ({ ...current, service_type: code as ServiceRequestPayload['service_type'] }));
  }, [params]);

  const cards = services.length
    ? services.map((service) => ({
        id: service.code as ServiceRequestPayload['service_type'],
        title: service.title,
        text: service.summary,
        icon: ICONS[service.icon] || Sprout,
        slug: service.slug,
        price_note: service.price_note,
        highlights: service.highlights,
      }))
    : FALLBACK_SERVICES.map((service) => ({ ...service, slug: '', price_note: '', highlights: [] as string[] }));

  function selectService(id: ServiceRequestPayload['service_type']) {
    setForm((current) => ({ ...current, service_type: id }));
    const next = new URLSearchParams(params);
    next.set('service', id);
    setParams(next, { replace: true });
  }

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

  const selected = cards.find((card) => card.id === form.service_type) ?? cards[0];

  return <main className="page-shell py-8 md:py-10">
    <section className="rounded-3xl bg-gradient-to-l from-emerald-700 to-lime-600 p-7 text-white md:p-9">
      <p className="text-sm font-bold text-lime-100">شبکه خدمات مزرعه</p>
      <h1 className="mt-2 text-fluid-2xl font-extrabold leading-12">از مشاوره تا اجرای آبیاری در کنار کشاورز</h1>
      <p className="mt-3 max-w-2xl leading-8 text-emerald-50">درخواست خود را ثبت کنید؛ این درخواست برای ارزیابی به تیم مرتبط می‌رسد و پیش از هر قرارداد، زمان‌بندی و هزینه با شما هماهنگ می‌شود.</p>
    </section>

    <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="فهرست خدمات">
      {cards.map((service) => { const Icon = service.icon; const isSelected = service.id === selected?.id; return (
        <article key={service.id} className={`relative rounded-3xl border p-5 text-start transition ${isSelected ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200 dark:border-lime-400 dark:bg-emerald-900/50' : 'border-slate-100 bg-white hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950'}`}>
          <Icon className="text-emerald-600 dark:text-lime-300" />
          <h2 className="mt-3 font-extrabold text-slate-800 dark:text-white">{service.title}</h2>
          <p className="mt-2 text-fluid-sm leading-7 text-slate-500 dark:text-emerald-200">{service.text}</p>
          {service.highlights.length > 0 && (
            <ul className="mt-3 space-y-1">
              {service.highlights.slice(0, 3).map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-fluid-2xs text-slate-500 dark:text-emerald-300">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600 dark:text-lime-300" />
                  {item}
                </li>
              ))}
            </ul>
          )}
          {service.price_note && <p className="mt-3 rounded-xl bg-slate-50 px-2.5 py-1.5 text-fluid-2xs font-bold text-slate-500 dark:bg-emerald-900/60 dark:text-emerald-100">{service.price_note}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => selectService(service.id)} className="inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-3 text-fluid-2xs font-bold text-white transition hover:bg-emerald-700">
              انتخاب و ثبت درخواست
            </button>
            {service.slug && (
              <Link to={`/services/${service.slug}`} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-emerald-200 px-3 text-fluid-2xs font-bold text-emerald-700 dark:border-emerald-800 dark:text-lime-300">
                جزئیات خدمت
                <ArrowLeft size={13} className="rotate-180" />
              </Link>
            )}
          </div>
        </article>); })}
    </section>

    <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
      <form id="service-request" onSubmit={submit} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">ثبت درخواست {selected?.title}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label="نام و نام خانوادگی" value={form.customer_name} onChange={(value) => setForm({ ...form, customer_name: value })} />
          <Input label="شماره تماس" value={form.phone} onChange={(value) => setForm({ ...form, phone: normalizePhoneNumber(value) })} />
          <Input label="استان" value={form.province} onChange={(value) => setForm({ ...form, province: value })} />
          <Input label="شهرستان" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
          <Input label="محصول/کشت (اختیاری)" value={form.crop || ''} onChange={(value) => setForm({ ...form, crop: value })} />
          <Input label="مساحت مزرعه (هکتار، اختیاری)" type="text" value={form.farm_area_hectare?.toString() || ''} onChange={(value) => setForm({ ...form, farm_area_hectare: Number(normalizeNumericInput(value, true)) || undefined })} />
        </div>
        <label className="mt-4 block text-sm font-bold text-slate-700 dark:text-emerald-50">شرح نیاز <textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" rows={5} placeholder="نوع زمین، مشکل فعلی، زمان مورد انتظار و اطلاعاتی که به کارشناس کمک می‌کند..." /></label>
        <button disabled={submitting} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:opacity-50">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          {submitting ? 'در حال ثبت...' : 'ثبت درخواست خدمت'}
        </button>
      </form>

      <aside className="h-fit rounded-3xl bg-emerald-50 p-6 dark:bg-emerald-900/40">
        <h2 className="font-extrabold text-slate-800 dark:text-white">فرآیند شفاف</h2>
        <ol className="mt-4 space-y-4 text-sm leading-6 text-slate-600 dark:text-emerald-100">
          <li><strong>۱. ثبت نیاز:</strong> اطلاعات مزرعه و خدمت مدنظر ثبت می‌شود.</li>
          <li><strong>۲. بررسی:</strong> تیم مناسب درخواست را ارزیابی می‌کند.</li>
          <li><strong>۳. پیشنهاد:</strong> محدوده کار، زمان و هزینه پیش از اجرا هماهنگ می‌شود.</li>
          <li><strong>۴. اجرا و پشتیبانی:</strong> وضعیت کار قابل پیگیری خواهد بود.</li>
        </ol>
        {reference && <p className="mt-5 rounded-xl bg-white p-3 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-lime-300">کد پیگیری درخواست: {reference}</p>}
        <Link to="/farmer-sell" className="mt-5 inline-flex min-h-11 items-center text-fluid-sm font-bold text-emerald-700 underline dark:text-lime-300">محصول کشاورزی برای فروش دارید؟</Link>
      </aside>
    </section>
  </main>;
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">{label}<input required={!label.includes('اختیاری')} type={type} min={type === 'number' ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" /></label>; }
