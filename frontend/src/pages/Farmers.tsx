// frontend/src/pages/Farmers.tsx

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, Banknote, ClipboardCheck, MessageCircle } from 'lucide-react';

import { agricultureApi, locationsApi } from '../api/services';
import { parseApiError } from '../api/errors';
import PageHead from '../components/shop/PageHead';
import Button from '../components/ui/Button';
import { SelectField, TextArea, TextField } from '../components/ui/Field';

/**
 * «فروش محصول» — the seller page.
 *
 * It answers the four questions a farmer actually asks before signing up:
 * what does it cost, who checks my listing and how long that takes, when do I
 * get paid, and how do buyers reach me. Written as plain paragraphs under
 * four headings — no icon-card grid, no numbered timeline, no testimonials
 * carousel.
 */
const STEPS = [
  {
    icon: ClipboardCheck,
    title: '۱. ثبت‌نام با مدارک',
    body: 'نام، شمارهٔ همراه، کد ملی و شمارهٔ کارت برای تسویه. مدارک یک‌بار بررسی می‌شود و بعد از تأیید، غرفه فعال است.',
  },
  {
    icon: BadgeCheck,
    title: '۲. ثبت آگهی و بررسی',
    body: 'برای هر محصول: عنوان، مقدار موجود، واحد فروش، قیمت و عکس. آگهی پیش از انتشار بررسی می‌شود تا خریدار بداند موجودی و کیفیت را چه کسی تضمین کرده.',
  },
  {
    icon: MessageCircle,
    title: '۳. گفتگو با خریدار',
    body: 'خریدار از صفحهٔ غرفه یا صفحهٔ آگهی پیام می‌دهد. موجودی، زمان برداشت و هزینهٔ ارسال همان‌جا نهایی می‌شود.',
  },
  {
    icon: Banknote,
    title: '۴. تسویه',
    body: 'پس از تحویل و تأیید سفارش، مبلغ به کارت ثبت‌شده واریز می‌شود. کارمزد و سهم پلتفرم پیش از تأیید سفارش در پیشخوان دیده می‌شود.',
  },
] as const;

/**
 * «محصولت را بفروش» — the offer form.
 *
 * The page promised «محصولت را مستقیم بفروش» and «ثبت‌نام را از همین‌جا شروع کن»
 * with nothing behind either link but a login form, while
 * `agricultureApi.requestProcurement` sat unused. A farmer with a crop ready
 * this week needs somewhere to say so *before* deciding to run a stall.
 *
 * On submit the server files a `ProcurementRequest`, returns a code, and — for
 * a signed-in farmer — mirrors it into the `procurement` thread of their inbox,
 * so the same offer appears in two places without being entered twice.
 */
function OfferForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [crop, setCrop] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('کیلوگرم');
  const [price, setPrice] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [note, setNote] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filed, setFiled] = useState<{ code: string; message: string } | null>(null);

  const provinces = useQuery({
    queryKey: ['locations', 'provinces'],
    queryFn: async () => (await locationsApi.provinces()).data.results,
    staleTime: 60 * 60 * 1000,
  });
  // `?? []` inline in render trips exhaustive-deps; memoise the fallback.
  const provinceRows = useMemo(() => provinces.data ?? [], [provinces.data]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await agricultureApi.requestProcurement({
        farmer_name: name.trim(),
        phone: phone.trim(),
        crop_name: crop.trim(),
        quantity: Number(quantity.replace(/[^\d.]/g, '')) || 0,
        unit,
        province: province.trim(),
        city: city.trim(),
        description: note.trim(),
        // Only sent when the farmer typed one: `requested_price` is a number,
        // and an empty field must not become zero.
        ...(price.trim() ? { requested_price: Number(price.replace(/[^\d]/g, '')) } : {}),
      });
      const data = answer.data as { request?: { code?: string }; message?: string };
      setFiled({ code: data.request?.code ?? '', message: data.message ?? '' });
    } catch (caught) {
      setError(parseApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  if (filed) {
    return (
      <section
        aria-labelledby="offer-title"
        className="rounded-lg border border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-night-soft"
      >
        <h2 id="offer-title" className="text-xs font-extrabold text-brand-900 dark:text-brand-100">
          درخواست ثبت شد
        </h2>
        <p className="mt-1 text-2xs leading-7 text-ink-soft dark:text-white/70">
          {filed.message}
          {filed.code && (
            <>
              {' '}
              کد پیگیری: <span className="font-bold">{filed.code}</span> — و برای کاربر واردشده،
              همین درخواست در صندوق گفتگوها هم باز شد.
            </>
          )}
        </p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setFiled(null)}>
          ثبت محصول دیگر
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="offer-title">
      <h2 id="offer-title" className="text-base font-extrabold text-ink dark:text-white">
        محصولت را برای خرید معرفی کن
      </h2>
      <p className="mt-1 text-2xs leading-7 text-ink-soft dark:text-white/60">
        لازم نیست اول غرفه بسازی. محصولی که آمادهٔ فروش داری را اینجا معرفی کن؛ تیم خرید
        بررسی می‌کند و برای قیمت و حمل با تو تماس می‌گیرد.
      </p>

      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <TextField label="نام و نام خانوادگی" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <TextField label="شمارهٔ همراه" required dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        <TextField label="محصول" required value={crop} onChange={(e) => setCrop(e.target.value)} placeholder="مثلاً گوجه‌فرنگی" />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <TextField label="مقدار" required dir="ltr" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <SelectField label="واحد" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {['کیلوگرم', 'تن', 'کارتن', 'کیسه'].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectField>
        </div>
        <SelectField
          label="استان"
          required
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            setCity('');
          }}
        >
          <option value="">انتخاب کنید…</option>
          {provinceRows.map((entry) => (
            <option key={entry.id} value={entry.name}>
              {entry.name}
            </option>
          ))}
        </SelectField>
        <TextField label="شهر / بخش" required value={city} onChange={(e) => setCity(e.target.value)} />
        <TextField
          label="قیمت پیشنهادی هر واحد (تومان)"
          dir="ltr"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          hint="اختیاری. اگر ننویسی، تیم خرید قیمت روز را پیشنهاد می‌دهد."
        />
        <div className="sm:col-span-2">
          <TextArea
            label="توضیح"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            hint="زمان برداشت، درجه‌بندی، بسته‌بندی — هر چیزی که به قیمت‌گذاری کمک می‌کند."
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" loading={busy} disabled={!name.trim() || !phone.trim() || !crop.trim() || !quantity.trim() || !province.trim() || !city.trim()}>
            ثبت درخواست فروش
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-2xs font-bold text-danger-700 dark:text-danger-600">
          {error}
        </p>
      )}
    </section>
  );
}

export default function Farmers() {
  return (
    <div className="shell flex flex-col gap-8 py-8">
      <PageHead
        title="محصولت را مستقیم بفروش"
        lead="غرفه‌داری در گرین‌کود برای کشاورز، تعاونی و تولیدکننده است: آگهی می‌گذارید، خریدار مستقیم با شما حرف می‌زند و پرداخت پس از تحویل تسویه می‌شود."
        actions={
          <Button to="/login" size="md">
            شروع غرفه‌داری
          </Button>
        }
      />

      <ol className="grid gap-4 sm:grid-cols-2">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
            <Icon size={18} aria-hidden="true" className="text-brand-700 dark:text-brand-300" />
            <h2 className="mt-2 text-xs font-extrabold text-ink dark:text-white">{title}</h2>
            <p className="mt-1 text-2xs leading-7 text-ink-soft dark:text-white/60">{body}</p>
          </li>
        ))}
      </ol>

      <section aria-labelledby="farmer-faq" className="rounded-lg border border-line bg-paper p-5 dark:border-night-line dark:bg-night-soft">
        <h2 id="farmer-faq" className="text-base font-extrabold text-ink dark:text-white">پرسش‌های رایج کشاورزان</h2>
        <dl className="mt-3 divide-y divide-line dark:divide-night-line">
          {[
            ['هزینهٔ غرفه‌داری چقدر است؟', 'ثبت‌نام و ساخت غرفه رایگان است؛ پلتفرم درصدی از هر فروش موفق برمی‌دارد که پیش از تأیید سفارش در پیشخوان نمایش داده می‌شود.'],
            ['بررسی آگهی چقدر طول می‌کشد؟', 'معمولاً کمتر از یک روز کاری. اگر آگهی برگشت بخورد، دلیلش نوشته می‌شود تا همان را اصلاح کنید.'],
            ['بدون عکس حرفه‌ای هم می‌شود؟', 'بله. عکس واضح با نور روز از خود محصول کافی است؛ عکس تبلیغاتی لازم نیست.'],
            ['ارسال با کیست؟', 'برای بارهای کوچک، پست و باربری؛ برای بارهای عمده، هماهنگی مستقیم با خریدار در گفتگو.'],
          ].map(([term, value]) => (
            <div key={term} className="py-3">
              <dt className="text-xs font-extrabold text-ink dark:text-white">{term}</dt>
              <dd className="mt-1 text-2xs leading-7 text-ink-soft dark:text-white/60">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <OfferForm />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-5 py-4 dark:border-brand-800 dark:bg-night-soft">
        <p className="text-xs font-bold text-brand-900 dark:text-brand-100">
          غرفه‌ای داری؟ ثبت‌نام را از همین‌جا شروع کن؛ مدارک یک‌بار بررسی می‌شود.
        </p>
        <Link
          to="/storefronts"
          className="inline-flex min-h-9 items-center gap-1.5 text-2xs font-extrabold text-brand-800 transition-colors hover:text-brand-900 dark:text-brand-300"
        >
          نمونهٔ غرفه‌های فعال
          <ArrowLeft size={13} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
