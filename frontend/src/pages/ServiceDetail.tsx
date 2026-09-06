// frontend/src/pages/ServiceDetail.tsx
//
// «خدمات» with a page per service. The list itself is admin-editable and every
// card links here, where the visitor reads what is delivered and starts a
// request that arrives pre-tagged with the right service code.

import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, CalendarClock, CheckCircle2, MessageCircle, PhoneCall } from 'lucide-react';
import toast from 'react-hot-toast';

import ArticleBody from '../components/article/ArticleBody';
import SharePanel from '../components/SharePanel';
import { farmServicesApi } from '../api/services';
import { useDirectStore } from '../store/directStore';
import { useSiteContact, telHref } from '../hooks/useSiteContact';
const ICONS: Record<string, typeof CalendarClock> = {
  sprout: CalendarClock,
  droplets: CalendarClock,
  leaf: CheckCircle2,
  warehouse: CheckCircle2,
  tractor: CalendarClock,
  'message-circle': MessageCircle,
};

export default function ServiceDetail() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { contact, primaryPhone, whatsappDigits } = useSiteContact();
  const openDirect = useDirectStore((state) => state.openDirect);
  const [toastShown, setToastShown] = useState(false);

  const { data: service, isLoading, isError } = useQuery({
    queryKey: ['service', slug],
    queryFn: async () => (await farmServicesApi.getBySlug(slug)).data,
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });

  // Same query key as the services list, so this costs no extra request when
  // the visitor came from /services.
  const { data: allServices = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => (await farmServicesApi.getAll()).data,
    staleTime: 5 * 60 * 1000,
  });

  // Deep link from a request-form failure or a payment page.
  useEffect(() => {
    if (searchParams.get('requested') === '1' && !toastShown) {
      setToastShown(true);
      toast.success('درخواست خدمت ثبت شد؛ کد پیگیری را در پیام‌رسان ببینید.');
    }
  }, [searchParams, toastShown]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (isError || !service) {
    return (
      <div className="mx-auto flex min-h-[50dvh] max-w-3xl flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">این خدمت پیدا نشد</h1>
        <Link to="/services" className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">
          فهرست خدمات
        </Link>
      </div>
    );
  }

  const Icon = ICONS[service.icon] || CalendarClock;
  const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
  const pageUrl = `${siteUrl}/services/${service.slug}`;
  const seoTitle = service.seo_title || `${service.title} | گرین کود`;
  const seoDescription = service.seo_description || service.summary;
  const highlights = service.highlights || [];

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: service.title,
            description: seoDescription,
            serviceType: service.title,
            url: pageUrl,
            provider: { '@type': 'Organization', name: 'گرین کود', url: `${siteUrl}/` },
            areaServed: 'IR',
          })}
        </script>
      </Helmet>

      <main className="page-shell py-8 md:py-10">
        <Link
          to="/services"
          className="inline-flex min-h-11 items-center gap-2 text-fluid-sm font-bold text-emerald-700 hover:text-emerald-900 dark:text-lime-300"
        >
          <ArrowRight size={18} />
          همه خدمات مزرعه
        </Link>

        <header className="mt-4 grid gap-5 rounded-3xl bg-gradient-to-l from-emerald-800 to-emerald-600 p-6 text-white sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-fluid-2xs font-bold">
              <Icon size={14} />
              شبکه خدمات مزرعه
            </span>
            <h1 className="mt-3 text-fluid-2xl font-extrabold leading-12">{service.title}</h1>
            <p className="mt-3 max-w-2xl text-fluid-sm leading-8 text-emerald-50">{service.summary}</p>
            {service.price_note && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-fluid-xs font-bold">
                <CalendarClock size={15} />
                {service.price_note}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Link
              to={`/services?service=${service.code}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-fluid-sm font-extrabold text-emerald-800 shadow-md transition hover:bg-emerald-50"
            >
              <CheckCircle2 size={17} />
              ثبت درخواست این خدمت
            </Link>
            <button
              type="button"
              onClick={() => openDirect({ serviceChannel: 'consulting' })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/40 px-4 text-fluid-sm font-bold text-white transition hover:bg-white/10"
            >
              <MessageCircle size={17} />
              پرسش سریع در پیام‌رسان
            </button>
            {(whatsappDigits || primaryPhone) && (
              <a
                href={whatsappDigits ? `https://wa.me/${whatsappDigits}` : telHref(primaryPhone)}
                target={whatsappDigits ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/40 px-4 text-fluid-sm font-bold text-white transition hover:bg-white/10"
              >
                <PhoneCall size={17} />
                {whatsappDigits ? 'واتساپ' : primaryPhone}
              </a>
            )}
          </div>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7 dark:border-emerald-900 dark:bg-emerald-950">
            {service.image && (
              <img
                src={service.image_url}
                alt={service.title}
                className="mb-5 aspect-[16/8] w-full rounded-2xl object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
            {service.body ? (
              <ArticleBody body={service.body} />
            ) : (
              <p className="text-fluid-sm leading-8 text-slate-600 dark:text-emerald-100">{service.summary}</p>
            )}

            {highlights.length > 0 && (
              <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                {highlights.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 rounded-2xl bg-emerald-50/70 p-3 text-fluid-sm text-slate-700 dark:bg-emerald-900/40 dark:text-emerald-100"
                  >
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-lime-300" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 dark:border-emerald-900 dark:bg-emerald-950">
              <p className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">اشتراک‌گذاری این خدمت</p>
              <SharePanel url={pageUrl} title={service.title} text={service.summary} variant="icons" className="mt-2" />
            </div>

            {contact.expert_name && (
              <div className="rounded-3xl bg-emerald-50 p-5 dark:bg-emerald-900/40">
                <div className="flex items-center gap-3">
                  <img
                    src={contact.expert_photo_url || '/images/hero-farm.jpg'}
                    alt={contact.expert_name}
                    className="h-12 w-12 rounded-xl object-cover"
                    onError={(event) => {
                      event.currentTarget.src = '/images/hero-farm.jpg';
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-fluid-sm font-extrabold text-slate-800 dark:text-white">{contact.expert_name}</p>
                    <p className="truncate text-fluid-2xs text-slate-500 dark:text-emerald-200">{contact.expert_role}</p>
                  </div>
                </div>
                {contact.expert_note && (
                  <p className="mt-2.5 text-fluid-xs leading-7 text-slate-600 dark:text-emerald-100">{contact.expert_note}</p>
                )}
              </div>
            )}

            <div className="rounded-3xl border border-slate-100 bg-white p-5 dark:border-emerald-900 dark:bg-emerald-950">
              <p className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">بقیه خدمات</p>
              <ul className="mt-3 space-y-2">
                {allServices.filter((item) => item.slug !== service.slug).slice(0, 5).map((item) => (
                  <li key={item.slug}>
                    <Link
                      to={`/services/${item.slug}`}
                      className="flex min-h-11 items-center justify-between rounded-xl bg-slate-50 px-3 text-fluid-xs font-bold text-slate-600 transition hover:bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-100"
                    >
                      {item.title}
                      <ArrowRight size={14} className="rotate-180" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link to="/services" className="mt-3 inline-flex min-h-10 items-center text-fluid-xs font-bold text-emerald-700 underline dark:text-lime-300">
                ثبت درخواست خدمت
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
