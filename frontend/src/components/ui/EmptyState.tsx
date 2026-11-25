// frontend/src/components/ui/EmptyState.tsx

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * An empty screen says three things in this order: what is not here, why, and
 * the single next thing to do. It is never decorated with an illustration —
 * an empty cart does not need a drawing of a cart.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line px-6 py-12 dark:border-night-line">
      {Icon && <Icon size={22} aria-hidden="true" className="text-ink-mute dark:text-white/50" />}
      <h2 className="text-lg font-extrabold text-ink dark:text-white">{title}</h2>
      {description && (
        <p className="max-w-prose text-sm text-ink-mute dark:text-white/60">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
