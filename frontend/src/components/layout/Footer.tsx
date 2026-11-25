// frontend/src/components/layout/Footer.tsx

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Mail, MapPin, Phone } from 'lucide-react';

import { siteInfoApi } from '../../api/services';
import { mailHref, telHref } from '../../lib/phone';
import { year } from '../../lib/date';
import { FOOTER_NAV } from './nav';
import Logo from './Logo';
import NewsletterForm from './NewsletterForm';

/**
 * The footer answers the three questions a last-page visitor has: where else
 * can I go, how do I reach a person, and what am I agreeing to.
 *
 * It is one green-tinted slab, not three stacked bands of gradients. Links are
 * plain text in columns — no icon beside each one, because nine glazed icons
 * make a sitemap look like a feature list.
 */
export default function Footer() {
  /**
   * The contact channels come from the server, which is the only place they are
   * maintained. They used to be two build-time environment variables, so a
   * number that changed in the admin changed on /contact and nowhere else — the
   * footer of every page kept publishing the old one. The variables remain as a
   * fallback for a deployment whose API has not answered yet.
   */
  const contact = useQuery({
    queryKey: ['site-contact'],
    queryFn: async () => (await siteInfoApi.getContact()).data,
    staleTime: 30 * 60 * 1000,
  });

  const phone = contact.data?.phones?.[0] || import.meta.env.VITE_PHONE_NUMBER?.trim();
  const email = contact.data?.emails?.[0] || import.meta.env.VITE_CONTACT_EMAIL?.trim();
  const address = contact.data?.address || 'تهران، ایران';

  return (
    <footer className="mt-16 border-t border-line bg-brand-900 pb-20 text-brand-50 lg:pb-0 dark:border-night-line dark:bg-night">
      <div className="shell py-12">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Logo className="[&_span]:!text-white" />
            <p className="mt-4 text-xs leading-7 text-brand-100/80">
              گرین‌کود فروشگاه نهاده‌های کشاورزی و بازار مستقیم محصول کشاورزان است. کاتالوگ
              بررسی‌شده، غرفه‌های تأییدشده و مشاورهٔ کارشناس، یک‌جا.
            </p>

            <ul className="mt-5 space-y-2 text-xs text-brand-100/80">
              {phone && (
                <li>
                  {telHref(phone) ? (
                    <a
                      href={telHref(phone)}
                      className="inline-flex min-h-9 items-center gap-2 transition-colors hover:text-white"
                    >
                      <Phone size={14} aria-hidden="true" />
                      <span dir="ltr" className="dateline">{phone}</span>
                    </a>
                  ) : (
                    // Printed, not linked: a number that cannot be dialled is
                    // still information, and `tel:` with nothing after it is not.
                    <span className="inline-flex min-h-9 items-center gap-2">
                      <Phone size={14} aria-hidden="true" />
                      <span dir="ltr" className="dateline">{phone}</span>
                    </span>
                  )}
                </li>
              )}
              {mailHref(email) && (
                <li>
                  <a
                    href={mailHref(email)}
                    className="inline-flex min-h-9 items-center gap-2 transition-colors hover:text-white"
                  >
                    <Mail size={14} aria-hidden="true" />
                    <span dir="ltr">{email}</span>
                  </a>
                </li>
              )}
              <li className="flex items-start gap-2">
                <MapPin size={14} aria-hidden="true" className="mt-1.5 shrink-0" />
                <span className="leading-6">{address}</span>
              </li>
            </ul>
          </div>

          {FOOTER_NAV.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-xs font-extrabold text-white">{group.title}</h2>
              <ul className="mt-3 space-y-1">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="inline-flex min-h-8 items-center text-xs text-brand-100/85 transition-colors duration-150 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 grid gap-6 border-t border-white/15 pt-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <NewsletterForm />
          <p className="dateline text-[11px] text-brand-100/60">
            © {year()} گرین‌کود — همهٔ حقوق محفوظ است.
          </p>
        </div>
      </div>
    </footer>
  );
}
