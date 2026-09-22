// frontend/src/components/ui/QueryErrorState.tsx

import { AlertTriangle, RefreshCw } from 'lucide-react';

import Button from './Button';

interface QueryErrorStateProps {
  title: string;
  message: string;
  isRetrying?: boolean;
  onRetry: () => void;
}

/** Consistent retry state for account pages backed by React Query. */
export default function QueryErrorState({
  title,
  message,
  isRetrying = false,
  onRetry,
}: QueryErrorStateProps) {
  return (
    <section
      role="alert"
      className="rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm dark:border-rose-900 dark:bg-emerald-950"
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200">
        <AlertTriangle size={26} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-fluid-lg font-extrabold text-slate-800 dark:text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-fluid-sm leading-7 text-slate-500 dark:text-emerald-200">
        {message}
      </p>
      <div className="mt-5 flex justify-center">
        <Button
          variant="primary"
          icon={RefreshCw}
          loading={isRetrying}
          onClick={onRetry}
        >
          تلاش دوباره
        </Button>
      </div>
    </section>
  );
}
