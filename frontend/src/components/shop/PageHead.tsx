// frontend/src/components/shop/PageHead.tsx

import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { useTitle } from '../../lib/useTitle';

/**
 * The opening block of an inner page: one h1, one lead line, optional actions.
 *
 * No breadcrumb here — the header's navigation already says where you are, and
 * a breadcrumb on a two-level site is a row of links back to pages the reader
 * just came from. The type scale is the same as the home page's section
 * headings so a route change does not feel like a new site.
 */
export default function PageHead({
  title,
  lead,
  actions,
  className,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  className?: string;
}) {
  // Every inner page opens with this block, so the document title is set here
  // rather than in twenty page components.
  useTitle(title);

  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-ink sm:text-3xl dark:text-white">
          {title}
        </h1>
        {lead && <p className="mt-2 max-w-[62ch] text-sm leading-7 text-ink-soft dark:text-white/65">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
