// frontend/src/components/ui/PageLoader.tsx
//
// The one full-page loading state.
//
// Four pages had the same anonymous spinner: a bare rotating ring with no
// accessibility role, so a screen reader announced nothing at all while the
// page was still fetching and a sighted reader had no word for what was
// happening. It now carries role="status", aria-busy and a visible label, and
// the four call sites share it so the next page cannot invent a fifth shape.
//
// It is a *page* loader on purpose: inside a card or a list, keep the layout
// with a skeleton instead (see ui/SkeletonCard) so the page does not jump
// between empty and full.

import { cn } from '../../utils/cn';

interface PageLoaderProps {
  /** What is being loaded, in the reader's language. */
  label?: string;
  /** `inline` drops the 50dvh centring for use inside a panel. */
  variant?: 'page' | 'inline';
  className?: string;
}

export default function PageLoader({
  label = 'در حال بارگذاری…',
  variant = 'page',
  className,
}: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        variant === 'page' && 'min-h-[50dvh]',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"
      />
      <p className="text-fluid-xs font-bold text-slate-500 dark:text-emerald-200">{label}</p>
    </div>
  );
}
