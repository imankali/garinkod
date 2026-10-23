// frontend/src/components/ui/PlaybackToggle.tsx
//
// The play/pause control every auto-rotating surface must carry.
//
// ui-ux-pro-max rates "auto-rotating content without user control" a High
// severity defect (WCAG 2.2.2): pausing on hover and on focus is necessary but
// not sufficient, because a touch user never hovers and a keyboard user who
// tabs past the rail resumes it. This button is the explicit, persistent stop.
//
// It is a toggle button, so the accessible name states the *current* action
// ("توقف پخش خودکار") and `aria-pressed` exposes whether rotation is on.

import { Pause, Play } from 'lucide-react';

import { cn } from '../../utils/cn';

interface PlaybackToggleProps {
  /** True while the surface is rotating on its own. */
  playing: boolean;
  onToggle: () => void;
  /** What is rotating, for the accessible name: «اسلایدها», «پیشنهادها»… */
  subject?: string;
  /** `ghost` sits in a heading row; `chip` floats over a coloured slab. */
  variant?: 'ghost' | 'chip';
  className?: string;
}

export default function PlaybackToggle({
  playing,
  onToggle,
  subject = 'محتوای خودکار',
  variant = 'ghost',
  className,
}: PlaybackToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={playing}
      aria-label={playing ? `توقف پخش خودکار ${subject}` : `پخش خودکار ${subject}`}
      title={playing ? 'توقف پخش خودکار' : 'پخش خودکار'}
      className={cn(
        'inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2 text-fluid-2xs font-bold transition',
        variant === 'chip'
          ? 'bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-white'
          : 'text-slate-500 hover:bg-slate-100 hover:text-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900',
        className,
      )}
    >
      {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
      <span className="hidden sm:inline">{playing ? 'توقف' : 'پخش'}</span>
    </button>
  );
}
