// frontend/src/components/ui/EmptyState.tsx
//
// Every "nothing here" in the app, in one shape.
//
// ui-ux-pro-max lists blank empty screens as a Medium defect and asks for a
// helpful message *and* an action. The audit found the opposite in this
// codebase: eleven ad-hoc one-liners ("سفارشی ثبت نشده") with no icon, no
// explanation, and no way forward — four of them inside surfaces a first-time
// buyer sees (orders, messages, search results, checkout).
//
// The component is deliberately presentational: the caller owns the copy and
// the destination, because "no orders yet" and "no search results for X" need
// different next steps.

import type { ReactNode } from 'react';
import { Sprout, type LucideIcon } from 'lucide-react';

import { cn } from '../../utils/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** A real next step: a link or button, styled by the caller. */
  action?: ReactNode;
  /** Use inside a card rather than as a whole-page state. */
  compact?: boolean;
  className?: string;
}

export default function EmptyState({
  title,
  description,
  icon: Icon = Sprout,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/40 px-5 text-center dark:border-emerald-800 dark:bg-emerald-950/40',
        compact ? 'py-8' : 'py-12 sm:py-16',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100 dark:bg-emerald-900 dark:text-lime-300 dark:ring-emerald-800"
      >
        <Icon size={26} />
      </span>
      <p className="mt-4 text-fluid-base font-extrabold text-slate-800 dark:text-white">{title}</p>
      {description && (
        <p className="mt-2 max-w-md text-pretty text-fluid-sm leading-7 text-slate-600 dark:text-emerald-100">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
