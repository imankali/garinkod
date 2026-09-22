// frontend/src/components/ui/Pagination.tsx

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * The shared compact pager for management and financial lists.
 *
 * Keeping this primitive in the UI layer prevents small differences in disabled
 * states, touch targets and Persian labels from multiplying across every
 * paginated screen.
 */
export default function Pagination({
  page,
  totalPages,
  onPageChange,
  ariaLabel,
  className = 'mt-5',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={`flex items-center justify-center gap-2 ${className}`}
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold disabled:opacity-40 dark:border-emerald-800 dark:text-emerald-100"
      >
        قبلی
      </button>
      <span className="text-xs text-slate-500 dark:text-emerald-200">
        صفحه {page} از {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold disabled:opacity-40 dark:border-emerald-800 dark:text-emerald-100"
      >
        بعدی
      </button>
    </nav>
  );
}
