// frontend/src/components/layout/Footer.tsx

import { Link } from 'react-router';
import { Mail, MapPin, Phone } from 'lucide-react';

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
  const phone = import.meta.env.VITE_PHONE_NUMBER?.trim();
  const email = import.meta.env.VITE_CONTACT_EMAIL?.trim();

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
                  <a
                    href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                    className="inline-flex min-h-9 items-center gap-2 transition-colors hover:text-white"
                  >
                    <Phone size={14} aria-hidden="true" />
                    <span dir="ltr" className="dateline">{phone}</span>
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex min-h-9 items-center gap-2 transition-colors hover:text-white"
                  >
                    <Mail size={14} aria-hidden="true" />
                    <span dir="ltr">{email}</span>
                  </a>
                </li>
              )}
              <li className="inline-flex items-center gap-2">
                <MapPin size={14} aria-hidden="true" />
                تهران، ایران
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
            © {new Date().toLocaleDateString('fa-IR', { year: 'numeric' })} گرین‌کود — همهٔ حقوق محفوظ است.
          </p>
        </div>
      </div>
    </footer>
  );
}
