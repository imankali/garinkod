// frontend/src/components/storefront/ListingDetailState.tsx
//
// Loading and error shells shared by the listing dialog and the full detail
// page, so both surfaces show the same waiting/failure shapes.

import { Loader2, Package } from 'lucide-react';

export default function ListingDetailState({
  kind,
  message,
  onBack,
}: {
  kind: 'loading' | 'error';
  message?: string;
  onBack?: () => void;
}) {
  if (kind === 'loading') {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-emerald-500" />
      </div>
    );
  }
  return (
    <div className="py-8 text-center">
      <Package size={36} className="mx-auto text-slate-300" />
      <p className="mt-3 text-fluid-sm font-bold text-slate-700 dark:text-white">{message}</p>
      <p className="mt-1 text-fluid-xs text-slate-500 dark:text-emerald-200">
        ممکن است آگهی حذف یا از انتشار خارج شده باشد.
      </p>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-fluid-xs font-bold text-white transition hover:bg-emerald-700"
        >
          بازگشت
        </button>
      )}
    </div>
  );
}
