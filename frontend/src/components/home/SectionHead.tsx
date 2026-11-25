// frontend/src/components/home/SectionHead.tsx

import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

/**
 * The heading of every panel on every page.
 *
 * Three rules, applied once here instead of nine times in nine sections:
 *   • the title is the only large element — no kicker above it;
 *   • the explanation, when there is one, sits UNDER the title at body size,
 *     where it answers a question the title raised;
 *   • "see all" sits on the same baseline, at the far end, in link weight.
 *
 * The arrow moves 2px on hover and nothing else does; the whole row is not a
 * link (a heading that navigates is a trap for a screen reader).
 */
export default function SectionHead({
  id,
  title,
  hint,
  action,
}: {
  id: string;
  title: string;
  hint?: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-extrabold tracking-[-0.02em] text-ink sm:text-xl dark:text-white">
          {title}
        </h2>
        {hint && (
          <p className="mt-1 max-w-[60ch] text-2xs leading-6 text-ink-mute dark:text-white/55">{hint}</p>
        )}
      </div>
      {action && (
        <Link
          to={action.to}
          className="group inline-flex min-h-9 shrink-0 items-center gap-1 text-xs font-bold text-brand-700 transition-colors duration-150 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-100"
        >
          {action.label}
          <ArrowLeft
            size={14}
            aria-hidden="true"
            className="transition-transform duration-150 ease-[var(--ease-out)] group-hover:-translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      )}
    </div>
  );
}
