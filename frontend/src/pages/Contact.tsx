// frontend/src/pages/Contact.tsx

import { useQuery } from '@tanstack/react-query';
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';

import { siteInfoApi } from '../api/services';
import PageHead from '../components/shop/PageHead';
import { Skeleton } from '../components/ui/Skeleton';
import { mailHref, telHref } from '../lib/phone';

/**
 * «تماس با ما».
 *
 * The address block, the working hours and the channels the operator actually
 * maintains — read from the API so a changed phone number never lingers here.
 * Social channels render only when the operator filled them in; a link to an
 * empty Instagram account is worse than no link.
 */
export default function Contact() {
  const { data, isLoading } = useQuery({
    queryKey: ['site-contact'],
    queryFn: async () => (await siteInfoApi.getContact()).data,
    staleTime: 30 * 60 * 1000,
  });

  const socials = [
    { label: 'تلگرام', href: data?.telegram_url },
    { label: 'اینستاگرام', href: data?.instagram_url },
    { label: 'ایتا', href: data?.eitaa_url },
    { label: 'واتس‌اپ', href: data?.whatsapp_number ? `https://wa.me/${data.whatsapp_number.replace(/[^\d]/g, '')}` : '' },
  ].filter((social) => Boolean(social.href));

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <PageHead
        title="تماس با گرین‌کود"
        lead="برای سؤال فنی دربارهٔ نهاده‌ها، سفارش، یا همکاری — از هر کانالی که راحت‌تر است."
      />

      {isLoading ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="rounded-lg border border-line bg-paper p-5 dark:border-night-line dark:bg-night-soft" aria-labelledby="contact-info">
            <h2 id="contact-info" className="text-base font-extrabold text-ink dark:text-white">نشانی و شماره‌ها</h2>
            <dl className="mt-3 flex flex-col gap-3 text-xs">
              {data?.address && (
                <div className="flex gap-2">
                  <MapPin size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-300" />
                  <div>
                    <dt className="font-extrabold text-ink dark:text-white">نشانی دفتر</dt>
                    <dd className="mt-0.5 leading-7 text-ink-soft dark:text-white/65">{data.address}</dd>
                  </div>
                </div>
              )}
              {data?.working_hours && (
                <div className="flex gap-2">
                  <Clock size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-300" />
                  <div>
                    <dt className="font-extrabold text-ink dark:text-white">ساعات پاسخ‌گویی</dt>
                    <dd className="mt-0.5 leading-7 text-ink-soft dark:text-white/65">{data.working_hours}</dd>
                  </div>
                </div>
              )}
              {(data?.phones ?? []).length > 0 && (
                <div className="flex gap-2">
                  <Phone size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-300" />
                  <div>
                    <dt className="font-extrabold text-ink dark:text-white">تلفن</dt>
                    <dd className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
                      {(data?.phones ?? []).map((phone) =>
                        // A number that cannot be dialled is printed as text,
                        // never as a link that does nothing.
                        telHref(phone) ? (
                          <a
                            key={phone}
                            dir="ltr"
                            href={telHref(phone)}
                            className="dateline font-bold text-brand-700 transition-colors hover:text-brand-900 dark:text-brand-300"
                          >
                            {phone}
                          </a>
                        ) : (
                          <span key={phone} dir="ltr" className="dateline font-bold text-ink dark:text-white">
                            {phone}
                          </span>
                        ),
                      )}
                    </dd>
                  </div>
                </div>
              )}
              {(data?.emails ?? []).length > 0 && (
                <div className="flex gap-2">
                  <Mail size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-300" />
                  <div>
                    <dt className="font-extrabold text-ink dark:text-white">ایمیل</dt>
                    <dd className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
                      {(data?.emails ?? []).map((email) =>
                        mailHref(email) ? (
                          <a
                            key={email}
                            dir="ltr"
                            href={mailHref(email)}
                            className="font-bold text-brand-700 transition-colors hover:text-brand-900 dark:text-brand-300"
                          >
                            {email}
                          </a>
                        ) : (
                          <span key={email} dir="ltr" className="font-bold text-ink dark:text-white">
                            {email}
                          </span>
                        ),
                      )}
                    </dd>
                  </div>
                </div>
              )}
            </dl>

            {data?.provinces_note && (
              <p className="mt-4 border-t border-line pt-3 text-2xs leading-6 text-ink-mute dark:border-night-line dark:text-white/50">
                {data.provinces_note}
              </p>
            )}
          </section>

          <aside className="flex flex-col gap-3">
            {data?.expert_name && (
              <section className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft" aria-labelledby="expert">
                <h2 id="expert" className="text-2xs font-extrabold text-ink-mute dark:text-white/45">کارشناس پاسخ‌گو</h2>
                <div className="mt-2 flex items-center gap-2.5">
                  {data.expert_photo_url && (
                    <img
                      src={data.expert_photo_url}
                      alt=""
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <p className="text-xs font-extrabold text-ink dark:text-white">{data.expert_name}</p>
                    <p className="text-2xs text-ink-mute dark:text-white/45">{data.expert_role}</p>
                  </div>
                </div>
                {data.expert_note && <p className="mt-2 text-2xs leading-6 text-ink-soft dark:text-white/60">{data.expert_note}</p>}
              </section>
            )}

            <section className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft" aria-labelledby="socials">
              <h2 id="socials" className="text-2xs font-extrabold text-ink-mute dark:text-white/45">شبکه‌های اجتماعی</h2>
              {socials.length === 0 ? (
                <p className="mt-2 text-2xs text-ink-mute dark:text-white/40">در حال راه‌اندازی.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {socials.map((social) => (
                    <li key={social.label}>
                      <a
                        href={social.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex min-h-9 items-center gap-1.5 text-2xs font-bold text-brand-700 transition-colors hover:text-brand-900 dark:text-brand-300"
                      >
                        <MessageCircle size={13} aria-hidden="true" />
                        {social.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
