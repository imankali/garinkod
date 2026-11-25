// frontend/src/components/Logo.tsx

import { Sprout } from "lucide-react";

// ========================================
// Types
// ========================================
interface LogoProps {
  compact?: boolean;
}

/**
 * The wordmark and its mark.
 *
 * The mark used to be a 3D coin: emerald-to-lime gradient, a white shine
 * sweep, a lime dot pulsing at 1.5s and a blurred halo breathing at 2s
 * behind it, flipping 180° on hover. Four infinite animations in a 44px
 * square, in the sticky header, on every page — the busiest object on the
 * site and the one the visitor sees most often. Emil's frequency gate is
 * exactly this case: something seen a hundred times a day gets no
 * choreography, and the mark is the one element that should be still.
 *
 * It is now a flat brand tile: one green, one glyph, no gradient, no loop.
 * The whole lockup is a link, and the hover state is a 1px border shift on
 * the tile — a change you can feel without watching an animation.
 */
export default function Logo({ compact = false }: LogoProps) {
  return (
    <a
      href="/"
      className="group flex select-none items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
      aria-label="گرین کود - صفحه اصلی"
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-green text-white ring-1 ring-emerald-900/10 transition-[background-color,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:bg-emerald-800 md:h-12 md:w-12 dark:ring-white/15"
        aria-hidden="true"
      >
        <Sprout size={compact ? 20 : 23} strokeWidth={2} />
      </span>

      {!compact && (
        <span className="leading-tight">
          {/*
            Two weights, one colour. «گرین» was set in a clipped green
            gradient while «کود» sat in slate — a gradient wordmark that
            changed legibility with every reflow, and a two-tone lockup that
            read as a typo at small sizes. Weight carries the accent now.
          */}
          <span className="block text-lg font-extrabold tracking-[-0.02em] text-ink-deep md:text-xl dark:text-white">
            گرین‌کود
          </span>
          <span className="hidden text-fluid-2xs font-medium text-slate-500 md:block dark:text-emerald-200/70">
            فروشگاه تخصصی نهاده‌های کشاورزی
          </span>
        </span>
      )}
    </a>
  );
}
