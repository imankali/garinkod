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
//
// The eyebrow slot stays in the API because pages use it to name the section
// a page belongs to, but it is no longer set as a small capitalised label
// ABOVE the h1 with a glyph beside it. Impeccable bans that pattern outright
// ("no kicker or eyebrow above a heading — the heading carries its own
// weight"), and it was doing real damage here: every page opened with two
// competing first lines and a 15px icon whose only job was to decorate the
// first one. It is now the breadcrumb's companion — a quiet category line
// that sits above the title at body size, reads as a continuation of the
// trail, and disappears into the heading instead of announcing it.

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
            <p className="text-fluid-2xs font-bold text-slate-500 dark:text-emerald-200/80">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 flex items-center gap-2 text-balance text-fluid-2xl font-extrabold leading-tight tracking-[-0.02em] text-ink-deep dark:text-white">
            {/* The glyph belongs to the title it illustrates, if it stays at
                all — beside the heading, at heading weight, not above it. */}
            {Icon && <Icon size={22} aria-hidden="true" className="shrink-0 text-emerald-700 dark:text-lime-300" />}
            <span className="min-w-0">{title}</span>
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
