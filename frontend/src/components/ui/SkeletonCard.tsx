// frontend/src/components/ui/SkeletonCard.tsx
//
// Geometry-exact loading skeletons for the two catalogue card shapes.
// The whole point of a skeleton is to hold the *layout* steady while data
// arrives, so every block below mirrors the real card's box model:
// same outer border/radius, same aspect-square media zone (the card keeps one
// ratio that scales with its width, never a fixed height), same p-2.5/p-3
// content padding, same 40px button row with a 44px hit area. When the real card swaps in, nothing shifts —
// which is exactly what our CLS = 0 Lighthouse budget pays for.
//
// The shimmer is a framer-motion gradient sweep (not the one-note
// `animate-pulse` placeholder it replaces). It runs end→start so the light
// reads naturally in this RTL page, and it freezes entirely for users with
// prefers-reduced-motion — they get a calm, static placeholder instead of
// motion they asked us not to show.

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../utils/cn';

export type SkeletonCardVariant = 'product' | 'listing';

interface SkeletonCardProps {
  variant?: SkeletonCardVariant;
  className?: string;
}

/**
 * One shimmering rectangle. `bg-slate-200/70` on light, `bg-emerald-900/50`
 * in the dark theme, with a translucent highlight sweeping across.
 */
function ShimmerBlock({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-slate-200/70 dark:bg-emerald-900/50',
        className,
      )}
    >
      {!reduceMotion && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-lime-200/10"
          initial={{ x: '120%' }}
          animate={{ x: '-120%' }}
          transition={{
            duration: 1.6,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatDelay: 0.15,
          }}
        />
      )}
    </div>
  );
}

/** Mirrors ProductCard's box model exactly (fixed media height included). */
function ProductSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm dark:border-emerald-900/40 dark:bg-ink">
      {/* Media zone — ProductCard keeps one square ratio that scales with the card. */}
      <ShimmerBlock className="aspect-square w-full rounded-none" />

      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        {/* Category & brand row */}
        <div className="mb-1 flex items-center justify-between">
          <ShimmerBlock className="h-3 w-20" />
          <ShimmerBlock className="h-2.5 w-12" />
        </div>
        {/* Title — the real one is a two-line clamp with min-h-11 */}
        <div className="mb-1.5 min-h-10 space-y-2 py-0.5">
          <ShimmerBlock className="h-3.5 w-full" />
          <ShimmerBlock className="h-3.5 w-4/5" />
        </div>
        {/* Price row */}
        <div className="mb-2 flex items-baseline gap-2">
          <ShimmerBlock className="h-4 w-24" />
          <ShimmerBlock className="h-3 w-14" />
        </div>
        {/* Actions: primary button + square companion, both min-h-11 */}
        <div className="flex items-center gap-1.5">
          <ShimmerBlock className="h-11 w-full flex-1 rounded-lg" />
          <ShimmerBlock className="h-11 w-11 shrink-0 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Mirrors MarketplaceListingCard's box model exactly (ratio-only media). */
function ListingSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm dark:border-emerald-900 dark:bg-ink">
      {/* Media zone — the listing card holds the ratio, no fixed height. */}
      <ShimmerBlock className="aspect-square w-full rounded-none" />

      <div className="flex flex-1 flex-col p-3">
        {/* Title — two-line clamp like the real Link */}
        <div className="min-h-10 space-y-2 py-0.5">
          <ShimmerBlock className="h-3.5 w-full" />
          <ShimmerBlock className="h-3.5 w-3/5" />
        </div>
        {/* Storefront · crop meta line */}
        <ShimmerBlock className="mt-1 h-2.5 w-2/3" />
        {/* Price row */}
        <div className="mt-2.5 flex items-baseline gap-2">
          <ShimmerBlock className="h-4 w-28" />
          <ShimmerBlock className="h-3 w-10" />
        </div>
        {/* Actions: primary + square direct button, both min-h-10 */}
        <div className="mt-3 flex gap-2">
          <ShimmerBlock className="h-10 w-full flex-1 rounded-xl" />
          <ShimmerBlock className="h-10 w-10 shrink-0 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function SkeletonCard({ variant = 'product', className }: SkeletonCardProps) {
  // Empty shimmer blocks announce nothing by themselves; the sr-only line is
  // the only thing a screen reader hears.
  return (
    <div className={className}>
      <span className="sr-only">در حال بارگذاری…</span>
      {variant === 'listing' ? <ListingSkeleton /> : <ProductSkeleton />}
    </div>
  );
}
