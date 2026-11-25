// frontend/src/components/layout/Logo.tsx

import { Sprout } from 'lucide-react';

import { cn } from '../../lib/cn';

/**
 * The wordmark.
 *
 * A flat green tile with a sprout glyph and the name set in two weights. No
 * gradient, no 3D flip, no breathing halo, no pulsing dot — the mark is the
 * element a visitor sees on every page, which is exactly the definition of
 * "animate nothing" in the motion rules. The only state it has is a hover on
 * the tile so a pointer knows it is a link home.
 */
export default function Logo({ className }: { className?: string }) {
  return (
    <a
      href="/"
      className={cn('group flex shrink-0 items-center gap-2.5 rounded-md', className)}
      aria-label="گرین‌کود، صفحهٔ اصلی"
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-700 text-white transition-colors duration-150 group-hover:bg-brand-800"
      >
        <Sprout size={19} strokeWidth={2.2} />
      </span>
      <span className="leading-none">
        <span className="block text-[1.0625rem] font-extrabold tracking-[-0.03em] text-ink dark:text-white">
          گرین‌کود
        </span>
        <span className="mt-1 hidden text-[11px] font-medium text-ink-mute sm:block dark:text-white/50">
          نهاده‌های کشاورزی
        </span>
      </span>
    </a>
  );
}
