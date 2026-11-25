// frontend/src/pages/Services.tsx

import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';

import { agricultureApi, farmServicesApi, locationsApi } from '../api/services';
import { parseApiError } from '../api/errors';
import type { ServiceRequestPayload } from '@/types/commerce';
import PageHead from '../components/shop/PageHead';
import { SelectField, TextArea, TextField } from '../components/ui/Field';
import Button from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';

/**
 * Farm services: what can be ordered, and one form to order it.
 *
 * The catalogue comes from the server (`/services/catalog/`), so the studio can
 * add a service without a deploy; the request form posts to
 * `/services/requests/` and tells the visitor what happens next. Both are on
 * this page because splitting them ("read here, order there") is how a service
 * page becomes a brochure.
 */
const KINDS: Array<{ value: ServiceRequestPayload['service_type']; label: string }> = [
  { value: 'agronomy', label: 'مشاورهٔ زراعت' },
  { value: 'soil', label: 'آزمون خاک و آب' },
  { value: 'irrigation', label: 'طراحی و اجرای آبیاری' },
  { value: 'greenhouse', label: 'گلخانه' },
  { value: 'machinery', label: 'ماشین‌آلات و خاک‌ورزی' },
  { value: 'other', label: 'موارد دیگر' },
];

export default function Services() {
  const catalog = useQuery({
    queryKey: ['services-catalog'],
    queryFn: async () => (await farmServicesApi.getAll()).data,
    staleTime: 10 * 60 * 1000,
  });

  const [kind, setKind] = useState<ServiceRequestPayload['service_type']>('agronomy');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [crop, setCrop] = useState('');
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The same closed set of divisions the checkout uses: a service visit is
  // dispatched by province, so a typed «تهران» and a typed «استان تهران» must
  // not become two different answers.
  const provinces = useQuery({
    queryKey: ['locations', 'provinces'],
    queryFn: async () => (await locationsApi.provinces()).data.results ?? [],
    staleTime: 24 * 60 * 60 * 1000,
  });
  const cities = useQuery({
    queryKey: ['locations', 'cities', province],
    queryFn: async () => (await locationsApi.cities(province)).data.results ?? [],
    enabled: Boolean(province),
    staleTime: 24 * 60 * 60 * 1000,
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await agricultureApi.requestService({
        service_type: kind,
        customer_name: name,
        phone,
        province,
        city,
        crop: crop || undefined,
        farm_area_hectare: area ? Number(area) : undefined,
        description,
      });
      setSent(result.data.request.code);
    } catch (caught) {
      setError(parseApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <PageHead
        title="خدمات کشاورزی"
        lead="آزمون خاک، مشاورهٔ تغذیه، آبیاری و ماشین‌آلات — کارشناس گرین‌کود به مزرعه می‌آید یا از راه دور برنامه می‌دهد. درخواست را ثبت کنید تا تماس بگیریم."
      />

      <section aria-labelledby="catalog-title">
        <h2 id="catalog-title" className="text-base font-extrabold text-ink dark:text-white">فهرست خدمات</h2>
        {catalog.isLoading ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {(catalog.data ?? []).map((service) => (
              <li key={service.id} className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
                <h3 className="text-xs font-extrabold text-ink dark:text-white">
                  <Link
                    to={`/services/${encodeURIComponent(service.slug)}`}
                    className="hover:text-brand-800 hover:underline dark:hover:text-brand-300"
                  >
                    {service.title}
                  </Link>
                </h3>
                <p className="mt-1 text-2xs leading-6 text-ink-soft dark:text-white/60">{service.summary}</p>
                {service.highlights.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {service.highlights.map((point) => (
                      <li key={point} className="flex items-start gap-1.5 text-2xs text-ink-mute dark:text-white/50">
                        <Check size={12} aria-hidden="true" className="mt-1 shrink-0 text-brand-700 dark:text-brand-300" />
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
                {service.price_note && (
                  <p className="dateline mt-2 text-2xs font-bold text-brand-800 dark:text-brand-300">{service.price_note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="request-title" className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
        <h2 id="request-title" className="text-base font-extrabold text-ink dark:text-white">درخواست خدمت</h2>
        <p className="mt-1 text-2xs text-ink-mute dark:text-white/50">
          کارشناس برای هماهنگی زمان بازدید تماس می‌گیرد. هزینه پس از تعیین محدودهٔ کار اعلام می‌شود.
        </p>

        {sent ? (
          <div className="mt-4 rounded-md border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-night">
            <p className="text-xs font-extrabold text-brand-900 dark:text-brand-100">درخواست ثبت شد.</p>
            <p className="dateline mt-1 text-2xs text-ink-soft dark:text-white/60">
              کد پیگیری: <span className="font-bold">{sent}</span> — برای پیگیری همین کد را نگه دارید.
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setSent(null)}>
              ثبت درخواست دیگر
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
            <SelectField label="نوع خدمت" value={kind} onChange={(event) => setKind(event.target.value as ServiceRequestPayload['service_type'])}>
              {KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <TextField label="نام و نام خانوادگی" required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            <TextField label="شمارهٔ همراه" required dir="ltr" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
            <SelectField
              label="استان"
              required
              value={province}
              onChange={(event) => {
                setProvince(event.target.value);
                setCity('');
              }}
            >
              <option value="">انتخاب کنید…</option>
              {(provinces.data ?? []).map((entry) => (
                <option key={entry.id} value={entry.name}>
                  {entry.name}
                </option>
              ))}
            </SelectField>
            <SelectField label="شهر / بخش" required value={city} disabled={!province} onChange={(event) => setCity(event.target.value)}>
              <option value="">{province ? 'انتخاب کنید…' : 'اول استان را انتخاب کنید'}</option>
              {(cities.data ?? []).map((entry) => (
                <option key={entry.id} value={entry.name}>
                  {entry.name}
                </option>
              ))}
            </SelectField>
            <TextField label="محصول" value={crop} onChange={(event) => setCrop(event.target.value)} placeholder="مثلاً گوجهٔ گلخانه‌ای" />
            <TextField
              label="مساحت (هکتار)"
              dir="ltr"
              inputMode="decimal"
              value={area}
              onChange={(event) => setArea(event.target.value)}
              hint="تقریبی کافی است."
            />
            <div className="sm:col-span-2">
              <TextArea
                label="توضیح وضعیت"
                required
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="مشکل یا هدفی که برایش کمک می‌خواهید؛ هرچه دقیق‌تر، برنامه بهتر."
              />
            </div>
            {error && (
              <p role="alert" className="sm:col-span-2 rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-2xs font-medium text-danger-700 dark:bg-danger-700/15">
                {error}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" loading={busy}>ثبت درخواست</Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
