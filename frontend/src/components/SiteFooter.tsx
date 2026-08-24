// frontend/src/components/SiteFooter.tsx

import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';

import { visibleSections } from '../config/navigation';
import { useAuthStore, useUserLevel } from '../store/authStore';
import Logo from './Logo';

/**
 * The site footer.
 *
 * Beyond branding, this is the safety net for discoverability: it renders
 * every destination the viewer is allowed to open, grouped by purpose. A user
 * who cannot find something in the header will find it here, which is the
 * conventional expectation on the web.
 */
export default function SiteFooter() {
  const { isAuthenticated } = useAuthStore();
  const level = useUserLevel();
  const sections = visibleSections({ level, isAuthenticated });
  const year = new Date().toLocaleDateString('fa-IR', { year: 'numeric' });

  return (
    <footer
      className="mt-12 border-t border-emerald-100 bg-white dark:border-emerald-900 dark:bg-emerald-950"
      // Clear the fixed mobile bar so the last row is never covered.
      style={{ paddingBottom: 'var(--mobile-nav-clearance)' }}
    >
      <div className="page-shell py-10">
        <div className="grid gap-8 lg:grid-cols-[1.5fr_3fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-fluid-sm leading-7 text-slate-500 dark:text-emerald-200">
              گرین کود، بازار تخصصی نهاده‌های کشاورزی و پل ارتباط مستقیم کشاورز با خریدار.
            </p>

            <ul className="mt-5 space-y-2 text-fluid-xs text-slate-500 dark:text-emerald-200">
              <li className="flex items-center gap-2">
                <Phone size={14} aria-hidden="true" className="shrink-0 text-emerald-600" />
                <a href="tel:+982100000000" dir="ltr" className="hover:underline">
                  ۰۲۱-۰۰۰۰۰۰۰۰
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} aria-hidden="true" className="shrink-0 text-emerald-600" />
                <a href="mailto:info@garinkood.ir" dir="ltr" className="hover:underline">
                  info@garinkood.ir
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={14} aria-hidden="true" className="mt-1 shrink-0 text-emerald-600" />
                <span>ایران — ارسال به سراسر کشور</span>
              </li>
            </ul>
          </div>

          {/* Every reachable destination, grouped. */}
          <nav aria-label="نقشه سایت" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {sections.map((section) => (
              <div key={section.id}>
                <h2 className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                  {section.title}
                </h2>
                <ul className="mt-3 space-y-1">
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={item.to}
                        className="-mx-2 flex min-h-9 items-center rounded-lg px-2 text-fluid-xs text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900 dark:hover:text-lime-300"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-9 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-5 text-fluid-2xs text-slate-400 dark:border-emerald-900 sm:flex-row">
          <p>© {year} گرین کود — تمامی حقوق محفوظ است.</p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck size={13} aria-hidden="true" className="text-emerald-600" />
            پرداخت امن و بازگشت وجه طبق قوانین پلتفرم
          </p>
        </div>
      </div>
    </footer>
  );
}
