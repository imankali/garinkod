// frontend/src/components/ui/AutoRotateToggle.tsx
//
// The visible half of `useAutoRotate`: the mechanism WCAG 2.2.2 asks for, put
// where the moving content is.
//
// Design decisions worth stating, because each was a choice:
//   - The icon is Pause/Play rather than a lightning bolt or a "reduce motion"
//     gear: the control's meaning must be readable without its tooltip.
//   - The accessible name is an *action* ("توقف پخش خودکار") and it flips with
//     the state, instead of a fixed label plus `aria-pressed`. A toggle button
//     announced as "auto-play, pressed" makes the user work out which way round
//     pressed means; an action label does not.
//   - The state change is also pushed through an `aria-live` region outside the
//     button, because a control that only renames itself is silent for anyone
//     whose screen reader does not re-announce the focused button's name.
//   - One shared preference: pressing any instance stops the hero, the rails and
//     every storefront rail at once, and the labels of the others flip with it.

import { Pause, Play } from 'lucide-react';

import { useAutoRotate } from '../../hooks/useAutoRotate';
import { cn } from '../../utils/cn';

interface AutoRotateToggleProps {
  /** Overlay styling for controls that sit on top of imagery. */
  tone?: 'overlay' | 'surface';
  /** Show the action as text next to the icon, from `sm` up. */
  withLabel?: boolean;
  className?: string;
}

export default function AutoRotateToggle({
  tone = 'overlay',
  withLabel = false,
  className,
}: AutoRotateToggleProps) {
  const { playing, toggle } = useAutoRotate();
  const action = playing ? 'توقف پخش خودکار' : 'پخش خودکار را روشن کن';

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        // `.tap-target` grows the hit area to 44×44 without enlarging the visible
        // control — the same contract the round rail arrows use.
        className={cn(
          'tap-target inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full transition',
          withLabel ? 'px-2.5 sm:px-3 text-fluid-2xs font-bold' : 'w-8',
          tone === 'overlay'
            ? 'bg-white/20 text-white backdrop-blur hover:bg-white/35 focus-visible:outline-2 focus-visible:outline-white'
            : 'bg-white/95 text-slate-700 ring-1 ring-slate-200 hover:text-emerald-700 dark:bg-emerald-950 dark:text-white dark:ring-emerald-700',
          className,
        )}
      >
        {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        {withLabel ? (
          <>
            {/* The visible text is the name where there is room for it. */}
            <span className="hidden sm:inline">{action}</span>
            <span className="sm:hidden sr-only">{action}</span>
          </>
        ) : (
          <span className="sr-only">{action}</span>
        )}
      </button>
      {/* Outside the button on purpose: a live region nested in a button is
          inconsistently announced, and this one has to be heard rather than
          found. `sr-only` is absolutely positioned, so it adds no flex item. */}
      <span role="status" aria-live="polite" className="sr-only">
        {playing ? 'پخش خودکار روشن است' : 'پخش خودکار متوقف شد'}
      </span>
    </>
  );
}
