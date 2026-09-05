// frontend/src/pages/Contact.tsx
//
// A real contact page: the channels the company publishes in the admin, a
// locator that does not embed a third-party map (no script is loaded; the
// coordinates are printed and an optional external link is offered), and the
// quick form that posts to the same feedback queue as the support page.

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock3,
  ExternalLink,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Share2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import NewsletterForm from '../components/NewsletterForm';
import RouteSeo from '../components/RouteSeo';
import { siteInfoApi, trustApi } from '../api/services';
import { telHref } from '../hooks/useSiteContact';
import { normalizePhoneNumber, toEnglishDigits } from '../utils/normalizeDigits';

const INPUT =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm font-normal outline-none transition focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white';

export default function Contact() {
  const { data: contact } = useQuery({
    queryKey: ['site-contact'],
    queryFn: async () => (await siteInfoApi.getContact()).data,
    staleTime: 10 * 60 * 1000,
  });

  const [form, setForm] = useState({ name: '', phone: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error('موضوع و پیام را بنویسید تا بتوانیم دقیق پاسخ دهیم.');
      return;
    }
    setBusy(true);
    try {
      await trustApi.feedback({
        name: form.name || undefined,
        kind: 'consultation',
        subject: form.subject.trim(),
        message: `${form.message.trim()}${form.phone ? `\n\nشماره تماس: ${toEnglishDigits(form.phone)}` : ''}`,
      });
      setForm({ name: '', phone: '', subject: '', message: '' });
      toast.success('پیام شما در صف پشتیبانی ثبت شد.');
    } catch {
      // The API client reports the failure once.
    } finally {
      setBusy(false);
    }
  }

  const lat = contact?.map_lat ? Number(contact.map_lat) : null;
  const lng = contact?.map_lng ? Number(contact.map_lng) : null;
  const whatsapp = contact?.whatsapp_number?.replace(/\D/g, '');

  return (
    <main className="page-shell py-8 md:py-10">
      <RouteSeo />

      <header className="max-w-3xl">
        <h1 className="text-fluid-2xl font-extrabold leading-12 text-slate-800 dark:text-white">تماس با گرین کود</h1>
        <p className="mt-3 leading-8 text-slate-500 dark:text-emerald-200">
          برای پرسش فنی، قیمت عمده، همکاری غرفه‌داری یا پیگیری سفارش از هر یک از راه‌های زیر استفاده کنید.
          سریع‌ترین مسیر، گفت‌وگو در پیام‌رسان سایت است چون سابقه خرید و پرونده زمین شما در همان گفتگو دیده می‌شود.
        </p>
      </header>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Channels */}
        <div className="space-y-4">
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 dark:border-emerald-900 dark:bg-emerald-950">
            <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">راه‌های ارتباطی</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InfoBlock icon={MapPin} title="نشانی مرکزی">
                <p className="whitespace-pre-line">{contact?.address || 'نشانی در پنل مدیریت ثبت نشده است.'}</p>
                {contact?.provinces_note && <p className="mt-2 text-fluid-2xs text-slate-400">{contact.provinces_note}</p>}
              </InfoBlock>

              <InfoBlock icon={Phone} title="تلفن">
                {contact?.phones.length ? (
                  <ul className="space-y-1">
                    {contact.phones.map((phone) => (
                      <li key={phone}>
                        <a href={telHref(phone)} dir="ltr" className="inline-flex items-center gap-1.5 font-bold text-emerald-700 hover:underline dark:text-lime-300">
                          <Phone size={13} />
                          {phone}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span>شماره‌ای ثبت نشده است.</span>
                )}
              </InfoBlock>

              <InfoBlock icon={Mail} title="ایمیل">
                {contact?.emails.length ? (
                  <ul className="space-y-1">
                    {contact.emails.map((email) => (
                      <li key={email}>
                        <a href={`mailto:${email}`} dir="ltr" className="font-bold text-emerald-700 hover:underline dark:text-lime-300">
                          {email}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span>ایمیلی ثبت نشده است.</span>
                )}
              </InfoBlock>

              <InfoBlock icon={Clock3} title="ساعات کاری">
                <p>{contact?.working_hours || 'شنبه تا چهارشنبه، ساعات اداری.'}</p>
              </InfoBlock>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-fluid-xs font-bold text-white"
                >
                  <MessageCircle size={16} />
                  گفتگو در واتساپ
                </a>
              )}
              {contact?.telegram_url && (
                <a
                  href={contact.telegram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-fluid-xs font-bold text-slate-600 dark:border-emerald-800 dark:text-emerald-100"
                >
                  <Send size={16} />
                  کانال تلگرام
                </a>
              )}
              {contact?.instagram_url && (
                <a
                  href={contact.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-fluid-xs font-bold text-slate-600 dark:border-emerald-800 dark:text-emerald-100"
                >
                  <Instagram size={16} />
                  اینستاگرام
                </a>
              )}
              {contact?.eitaa_url && (
                <a
                  href={contact.eitaa_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-fluid-xs font-bold text-slate-600 dark:border-emerald-800 dark:text-emerald-100"
                >
                  <Share2 size={16} />
                  ایتا
                </a>
              )}
              <Link
                to="/support"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 px-4 text-fluid-xs font-bold text-amber-700 dark:border-amber-700 dark:text-amber-200"
              >
                ثبت شکایت از غرفه
              </Link>
            </div>
          </section>

          {/* Location: coordinates only, no embedded map provider. */}
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 dark:border-emerald-900 dark:bg-emerald-950">
            <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">موقعیت روی نقشه</h2>
            {lat !== null && lng !== null ? (
              <>
                <div
                  className="relative mt-4 h-44 overflow-hidden rounded-2xl bg-[linear-gradient(0deg,rgba(16,185,129,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.08)_1px,transparent_1px)] bg-[size:28px_28px] dark:bg-[linear-gradient(0deg,rgba(163,230,53,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(163,230,53,0.08)_1px,transparent_1px)]"
                  role="img"
                  aria-label={`موقعیت دفتر مرکزی در عرض جغرافیایی ${lat.toLocaleString('fa-IR')} و طول ${lng.toLocaleString('fa-IR')}`}
                >
                  <span className="absolute start-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-8 ring-emerald-500/20">
                    <MapPin size={18} />
                  </span>
                  <span className="absolute bottom-2 start-2 rounded-lg bg-white/90 px-2 py-1 text-fluid-2xs font-bold text-slate-600 dark:bg-emerald-950/90 dark:text-emerald-100" dir="ltr">
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                  </span>
                </div>
                {contact?.map_note && <p className="mt-3 text-fluid-xs text-slate-500 dark:text-emerald-200">{contact.map_note}</p>}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-fluid-xs font-bold text-emerald-700 underline dark:text-lime-300"
                >
                  باز کردن در نقشه
                  <ExternalLink size={14} />
                </a>
                <p className="mt-2 text-fluid-2xs leading-6 text-slate-400">
                  برای حفظ حریم خصوصی، نقشه‌ای از سرویس خارجی در صفحه بارگذاری نمی‌شود؛ فقط مختصات و پیوند باز کردن.
                </p>
              </>
            ) : (
              <p className="mt-3 text-fluid-sm text-slate-500 dark:text-emerald-200">
                مختصات دفتر مرکزی در پنل ثبت نشده است. نشانی متنی در بخش «نشانی مرکزی» قابل ویرایش است.
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5 dark:border-emerald-800 dark:bg-emerald-900/40">
            <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">خبرنامه قیمت و کشت</h2>
            <p className="mt-1 text-fluid-xs text-slate-500 dark:text-emerald-200">
              هر هفته یک پیام: تغییر قیمت نهاده‌ها، موجودی تازه و راهنمای کشت فصل.
            </p>
            <div className="mt-3 max-w-md">
              <NewsletterForm source="contact-page" variant="panel" topics={['قیمت روز', 'موجودی بذر', 'راهنمای کشت', 'تخفیف‌ها']} />
            </div>
          </section>
        </div>

        {/* Quick form */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <form
            onSubmit={submit}
            className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 dark:border-emerald-900 dark:bg-emerald-950"
          >
            <h2 className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">پیام سریع</h2>
            <p className="mt-1 text-fluid-2xs text-slate-500 dark:text-emerald-300">
              این فرم به صف پشتیبانی می‌رود. برای پرسش فنی با عکس، «مشاوره کشاورزی» در پیام‌رسان سایت سریع‌تر است.
            </p>
            <label className="mt-4 block text-fluid-xs font-bold text-slate-700 dark:text-emerald-50">
              نام شما
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={INPUT} />
            </label>
            <label className="mt-3 block text-fluid-xs font-bold text-slate-700 dark:text-emerald-50">
              شماره تماس
              <input
                dir="ltr"
                inputMode="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: normalizePhoneNumber(event.target.value) })}
                className={INPUT}
                placeholder="09121234567"
              />
            </label>
            <label className="mt-3 block text-fluid-xs font-bold text-slate-700 dark:text-emerald-50">
              موضوع
              <input
                required
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                className={INPUT}
              />
            </label>
            <label className="mt-3 block text-fluid-xs font-bold text-slate-700 dark:text-emerald-50">
              پیام شما
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                className={INPUT}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-fluid-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Send size={16} />
              {busy ? 'در حال ارسال...' : 'ارسال پیام'}
            </button>
          </form>

          <div className="rounded-3xl bg-slate-900 p-5 text-white">
            <p className="text-fluid-sm font-extrabold">مشاوره با پرونده زمین</p>
            <p className="mt-1.5 text-fluid-xs leading-7 text-slate-300">
              اگر خاک، آب یا سابقه کشت زمین شما ثبت شده باشد، کارشناس همان اطلاعات را می‌خواند؛ لازم نیست از نو بنویسید.
            </p>
            <Link to="/profile?tab=farm" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-lime-400 px-3 text-fluid-xs font-bold text-emerald-950">
              ثبت پرونده زمین
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}

function InfoBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-emerald-900/40">
      <p className="flex items-center gap-1.5 text-fluid-xs font-extrabold text-slate-700 dark:text-white">
        <Icon size={15} className="text-emerald-600 dark:text-lime-300" />
        {title}
      </p>
      <div className="mt-2 text-fluid-sm leading-7 text-slate-600 dark:text-emerald-100">{children}</div>
    </div>
  );
}
