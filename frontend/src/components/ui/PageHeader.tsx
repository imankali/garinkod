// frontend/src/components/ui/PageHeader.tsx
//
// One page-opening block for every content page.
//
// The audit that motivated it found fourteen different shapes of "page title":
// some had a breadcrumb, some an eyebrow, some neither, padding ranged from
// py-4 to py-12, and the h1 type size alternated between fluid-xl, fluid-2xl
// and a hand-written clamp. A reader moving between /faq, /about and
// /services was re-learning the same hierarchy on every page.
//
// The contract this fixes (ui-ux-pro-max: hierarchy, 4/8 spacing rhythm,
// focus order, readable measure):
//   - exactly one h1 per page, announced first in the DOM;
//   - a breadcrumb whose links are real navigation (aria-label + aria-current),
//     not a decorative string;
//   - a lead paragraph capped at a readable measure instead of running the
//     full 1280px;
//   - actions that wrap under the title on phones and sit beside it on
//     desktop, with the same 44px minimum height as every other control.

import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, type LucideIcon } from 'lucide-react';

import { cn } from '../../utils/cn';

export interface PageCrumb {
  label: string;
  /** Omit on the last crumb — that one is the current page. */
  to?: string;
}

interface PageHeaderProps {
  title: string;
  /** Small line above the title: the page's category, not a second title. */
  eyebrow?: string;
  description?: string;
  /** Optional vector glyph shown beside the eyebrow. */
  icon?: LucideIcon;
  breadcrumbs?: PageCrumb[];
  /** Buttons/links for the page's primary action(s). */
  actions?: ReactNode;
  /** Extra content under the title block (filters, tabs, stats…). */
  children?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  eyebrow,
  description,
  icon: Icon,
  breadcrumbs,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-6 sm:mb-8', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="مسیر صفحه" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-fluid-2xs font-bold text-slate-500 dark:text-emerald-200">
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {crumb.to && !last ? (
                    <Link
                      to={crumb.to}
                      className="rounded-md px-1 py-0.5 transition hover:text-emerald-700 hover:underline dark:hover:text-lime-300"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? 'page' : undefined} className="px-1 text-slate-700 dark:text-white">
                      {crumb.label}
                    </span>
                  )}
                  {!last && <ChevronLeft size={12} aria-hidden="true" className="opacity-60" />}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="flex items-center gap-1.5 text-fluid-2xs font-extrabold text-emerald-700 dark:text-lime-300">
              {Icon && <Icon size={15} aria-hidden="true" />}
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-balance text-fluid-2xl font-extrabold leading-tight text-slate-800 dark:text-white">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-pretty text-fluid-sm leading-7 text-slate-600 dark:text-emerald-100">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
      </div>

      {children}
    </header>
  );
}
