// frontend/src/pages/NotFound.tsx

import { Link } from 'react-router';

import Button from '../components/ui/Button';
import { NAV } from '../components/layout/nav';
import { useTitle } from '../lib/useTitle';

/**
 * A 404 that is a map, not an apology.
 *
 * The visitor is lost, so the page spends its space on the nine destinations
 * rather than on an illustration and the words «صفحه یافت نشد» twice.
 */
export default function NotFound() {
  // The only page that does not open with <PageHead>, so it names itself.
  useTitle('این نشانی وجود ندارد');

  return (
    <div className="shell flex flex-col gap-6 py-16">
      <div className="max-w-[55ch]">
        <p className="dateline text-2xs font-extrabold text-brand-700 dark:text-brand-300">۴۰۴</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-9 tracking-[-0.03em] text-ink dark:text-white">
          این نشانی وجود ندارد
        </h1>
        <p className="mt-2 text-sm leading-7 text-ink-soft dark:text-white/65">
          ممکن است آدرس اشتباه تایپ شده باشد یا آن صفحه حذف شده باشد. از یکی از این مسیرها ادامه بدهید.
        </p>
      </div>

      <ul className="grid gap-x-6 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-night-line">
        {NAV.map((item) => (
          <li key={item.to} className="border-b border-line dark:border-night-line">
            <Link
              to={item.to}
              className="flex min-h-11 items-center justify-between text-xs font-bold text-ink transition-colors hover:text-brand-800 dark:text-white dark:hover:text-brand-300"
            >
              {item.label}
              <span aria-hidden="true" className="text-ink-mute dark:text-white/30">←</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button to="/" size="md">صفحهٔ اصلی</Button>
        <Button to="/track" size="md" variant="secondary">پیگیری سفارش</Button>
      </div>
    </div>
  );
}
