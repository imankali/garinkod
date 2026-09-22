import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Droplets, Landmark, Leaf, Loader2, MessageCircle, Sprout, Tractor, Wrench } from "lucide-react";
import toast from "react-hot-toast";

import { agricultureApi, farmApi, farmServicesApi } from "../api/services";
import type { ServiceRequestPayload } from '@/types/commerce';
import type { FarmLand } from '@/types/farming';
import { normalizePhoneNumber, normalizeNumericInput } from "../utils/normalizeDigits";
import { useAuthStore } from "../store/authStore";

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
  const navigate = useNavigate();
  const { isAuthenticated, account, user } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<ServiceRequestPayload>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState('');
  // After a successful sign-in submit: the consulting thread the request was
  // mirrored into — «گفتگو را باز کنید» jumps straight into it.
  const [threadId, setThreadId] = useState<number | null>(null);
  const [threadOpening, setThreadOpening] = useState(false);
  // «انتخاب و ثبت درخواست» scrolls the form into view — the cards sit above it,
  // so picking a service must hand the eye straight to the form it fills.
  const formRef = useRef<HTMLFormElement>(null);
  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // A signed-in user starts from what the account already knows: name and
  // phone prefill, and the phone is only asked for when the account has none —
  // the request form doubles as phone capture, per the request flow.
  const [lands, setLands] = useState<FarmLand[]>([]);
  const hasAccountPhone = Boolean((account?.phone || '').trim());
  const fullName = useMemo(() => {
    const first = user?.first_name || '';
    const last = user?.last_name || '';
    const joined = `${first} ${last}`.trim();
    return joined || account?.full_name || user?.username || '';
  }, [user, account]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setForm((current) => ({
      ...current,
      customer_name: current.customer_name || fullName,
      phone: current.phone || (account?.phone || ''),
    }));
    // Load the caller's registered lands for the dossier picker.
    farmApi.lands()
      .then((response) => setLands(response.data || []))
      .catch(() => setLands([]));
  }, [isAuthenticated, fullName, account?.phone]);

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

  function selectLand(landId: number | null) {
    const land = lands.find((row) => row.id === landId) || null;
    setForm((current) => ({
      ...current,
      land: landId,
      // Picking a land fills the facts the request shares with the case file;
      // the farmer can still override them below.
      province: land?.province || current.province,
      city: land?.city || current.city,
      crop: land?.crop_type || current.crop,
      farm_area_hectare: land ? Number(land.area) || undefined : current.farm_area_hectare,
    }));
  }

  async function openThread() {
    if (!threadId) return;
    setThreadOpening(true);
    navigate(`/messages?c=${threadId}`);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload: ServiceRequestPayload = { ...form };
      // The server only stores a phone the account is missing; sending the
      // prefilled number back is harmless, but a signed-in user with a phone
      // already on file does not need to retype it here at all.
      if (isAuthenticated && hasAccountPhone) payload.phone = payload.phone || (account?.phone || '');
      const response = await agricultureApi.requestService(payload);
      setReference(response.data.request.code);
      setThreadId(response.data.conversation_id ?? null);
      toast.success(
        isAuthenticated
          ? 'درخواست ثبت شد و در پیام‌رسان برای کارشناس‌ها ارسال شد.'
          : 'درخواست خدمت ثبت شد.',
      );
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
            <button type="button" onClick={() => { selectService(service.id); scrollToForm(); }} className="inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-3 text-fluid-2xs font-bold text-white transition hover:bg-emerald-700">
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
      <form ref={formRef} id="service-request" onSubmit={submit} className="scroll-mt-[calc(var(--header-height,72px)+1rem)] rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">ثبت درخواست {selected?.title}</h2>
        {isAuthenticated ? (
          <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-fluid-2xs leading-6 text-emerald-700 dark:bg-emerald-900/50 dark:text-lime-200">
            اطلاعات حساب شما از قبل پر شده است{!hasAccountPhone ? '؛ فقط شماره تماس لازم داریم' : ''}. درخواست بعد از ثبت مستقیم در گفتگوی مشاوره برای کارشناس‌ها ارسال می‌شود.
          </p>
        ) : null}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label="نام و نام خانوادگی" value={form.customer_name} onChange={(value) => setForm({ ...form, customer_name: value })} />
          <Input
            label={hasAccountPhone ? 'شماره تماس' : 'شماره تماس (برای پیگیری ثبت می‌شود)'}
            value={form.phone}
            onChange={(value) => setForm({ ...form, phone: normalizePhoneNumber(value) })}
          />
          <Input label="استان" value={form.province} onChange={(value) => setForm({ ...form, province: value })} />
          <Input label="شهرستان" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
          <Input label="محصول/کشت (اختیاری)" value={form.crop || ''} onChange={(value) => setForm({ ...form, crop: value })} />
          <Input label="مساحت مزرعه (هکتار، اختیاری)" type="text" value={form.farm_area_hectare?.toString() || ''} onChange={(value) => setForm({ ...form, farm_area_hectare: Number(normalizeNumericInput(value, true)) || undefined })} />
        </div>

        {/* Land dossier picker — signed-in callers attach one of their مزرعه من
            lands or let the server create one from this very form; guests file
            without a dossier. */}
        {isAuthenticated && (
          <fieldset className="mt-4 rounded-2xl border border-emerald-100 p-4 dark:border-emerald-800">
            <legend className="flex items-center gap-1.5 px-1 text-sm font-extrabold text-slate-800 dark:text-white">
              <Landmark size={14} className="text-emerald-600 dark:text-lime-300" />
              پرونده زمین
            </legend>
            <p className="text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-200">
              اگر زمین موردنظر در «مزرعه من» ثبت شده آن را انتخاب کنید؛ اگر نه، با همان اطلاعات این فرم به‌طور خودکار ساخته می‌شود تا مشاور شناسنامه کامل زمین را ببیند.
            </p>
            {lands.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectLand(null)}
                  className={`min-h-9 rounded-xl border px-3 text-fluid-2xs font-bold transition ${!form.land ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/60 dark:text-lime-200' : 'border-slate-200 text-slate-500 dark:border-emerald-800 dark:text-emerald-200'}`}
                >
                  بدون زمین مشخص
                </button>
                {lands.map((land) => (
                  <button
                    key={land.id}
                    type="button"
                    onClick={() => selectLand(land.id)}
                    className={`min-h-9 rounded-xl border px-3 text-fluid-2xs font-bold transition ${form.land === land.id ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/60 dark:text-lime-200' : 'border-slate-200 text-slate-500 hover:border-emerald-300 dark:border-emerald-800 dark:text-emerald-200'}`}
                  >
                    {land.name} · {land.crop_type}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        )}

        <label className="mt-4 block text-sm font-bold text-slate-700 dark:text-emerald-50">شرح نیاز <textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900" rows={5} placeholder="نوع زمین، مشکل فعلی، زمان مورد انتظار و اطلاعاتی که به کارشناس کمک می‌کند..." /></label>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button disabled={submitting} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:opacity-50">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitting ? 'در حال ثبت...' : 'ثبت درخواست خدمت'}
          </button>
          {threadId && (
            <button
              type="button"
              onClick={() => void openThread()}
              disabled={threadOpening}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-300 px-4 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900"
            >
              <MessageCircle size={15} />
              گفتگو را باز کنید
            </button>
          )}
        </div>
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
