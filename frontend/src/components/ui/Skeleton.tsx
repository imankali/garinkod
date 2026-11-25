// frontend/src/components/ui/Skeleton.tsx

import { cn } from '../../lib/cn';

/**
 * Loading placeholders with the exact geometry of the thing they replace, so
 * the swap moves nothing. The shimmer is CSS (`.skeleton`), runs on transform
 * only, and is the single looping animation on the site.
 */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

/** One product card's footprint: square photo, two title lines, price, button. */
export function ProductCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-line bg-paper dark:border-night-line dark:bg-night-soft',
        compact ? 'w-full' : '',
      )}
    >
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-1 h-5 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

/** A grid of card skeletons; announce once, not once per card. */
export function CardGridSkeleton({ count = 8, label = 'در حال بارگذاری کالاها' }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: count }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export function RailSkeleton({ count = 5, label = 'در حال بارگذاری' }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="w-[15rem] shrink-0">
            <ProductCardSkeleton compact />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Text lines, for article and policy pages. */
export function ProseSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="در حال بارگذاری متن" className="flex flex-col gap-3">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}
