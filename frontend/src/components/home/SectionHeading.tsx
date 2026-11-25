// frontend/src/components/home/SectionHeading.tsx

import { ChevronLeft, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

/**
 * One heading for every section of the home page.
 *
 * The shop window used to open each panel its own way — some with a Lucide
 * glyph that meant nothing, some with a hint line, some with the glyph acting
 * as the only ornament — so the page read as nine unrelated modules stacked.
 * The rules applied here, and nowhere else:
 *
 *   - No kicker above the heading. Impeccable bans it outright: the heading
 *     carries its own weight. The `hint` prop survives as supporting text
 *     *below* the title, where it answers "what is this list?" instead of
 *     labelling the heading before it is read.
 *   - No icon as decoration. `icon` is still accepted because existing call
 *     sites pass one, but it is only rendered when it carries information —
 *     call sites that used it as a bullet drop it (see RankedRail).
 *   - The "see all" link sits on the same baseline as the heading, aligned to
 *     the far end of the row, and is the only element allowed to be a pill.
 *   - Space above a section is larger than below its heading (craft floor):
 *     the section owns `pt`, the heading owns `mt` on its supporting text.
 */
export default function SectionHeading({
  id,
  title,
  hint,
  href,
  linkLabel = 'دیدن همه',
}: {
  id: string;
  title: string;
  hint?: string;
  href?: string;
  linkLabel?: string;
  /** Accepted for backwards compatibility; unused — see the note above. */
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2
          id={id}
          className="text-fluid-xl font-extrabold tracking-[-0.01em] text-ink-deep dark:text-white"
        >
          {title}
        </h2>
        {hint && (
          <p className="mt-1 text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-200/80">
            {hint}
          </p>
        )}
      </div>
      {href && (
        <Link
          to={href}
          className="group inline-flex min-h-11 shrink-0 items-center gap-1 text-fluid-xs font-bold text-emerald-700 transition-colors hover:text-emerald-900 dark:text-lime-300 dark:hover:text-white"
        >
          {linkLabel}
          <ChevronLeft
            size={15}
            aria-hidden="true"
            className="transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      )}
    </div>
  );
}
