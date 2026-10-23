// frontend/src/components/direct/ChannelChips.tsx
//
// The inbox's channel filter row, shared by the drawer and the full page.
//
// The chips used to be one oversized row that overflowed the drawer with no
// hint that more existed. This version is compact (small text, tight padding),
// swipes horizontally with momentum on touch, drag-scrolls with the mouse on
// desktop through the shared useDragToScroll hook, lets that hook fade the
// overflowing edge so the cut-off is visible, and — on wide screens — lets the
// user scroll it with the mouse wheel.

import { useEffect, useRef } from 'react';

import type { MessageChannel } from '@/types/messaging';
import { cn } from '../../utils/cn';
import { useDragToScroll } from '../../hooks/useDragToScroll';
import { useTabListKeys } from '../../hooks/useTabListKeys';

export type ChannelFilter = 'all' | MessageChannel;

export default function ChannelChips({
  channels,
  unreadByChannel,
  value,
  onChange,
  allLabel,
  className,
}: {
  channels: { value: MessageChannel; label: string }[];
  unreadByChannel: Partial<Record<MessageChannel, number>>;
  value: ChannelFilter;
  onChange: (next: ChannelFilter) => void;
  allLabel: string;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Mouse drag-to-scroll, momentum and click suppression come from the shared
  // rail hook; it also paints the edge fade through data-overflow/edge flags.
  // `focusable: false` keeps the tablist out of the tab order; the chips
  // themselves are the tab stops, and each focused chip scrolls into view.
  const scrollerDrag = useDragToScroll<HTMLDivElement>(scrollerRef, { focusable: false });
  // role="tablist" promises ← → Home End; the row implements them here on
  // the same node the drag hook owns.
  const channelTabs = useTabListKeys<HTMLDivElement>(scrollerRef);

  // Keep the active chip in view when it changes (e.g. picked via keyboard).
  useEffect(() => {
    const element = scrollerRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    element?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [value]);

  // Mouse wheel scrolls the row sideways, so desktop users are not stuck.
  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    const element = scrollerRef.current;
    if (!element || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (element.scrollWidth <= element.clientWidth) return;
    element.scrollLeft += event.deltaY * (document.documentElement.dir === 'rtl' ? -1 : 1);
  }

  const total = Object.values(unreadByChannel).reduce((sum, n) => sum + (n || 0), 0);

  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        ref={scrollerRef}
        role="tablist"
        aria-label="فیلتر منبع پیام"
        onWheel={onWheel}
        {...scrollerDrag.handlers}
        onKeyDown={(event) => {
          channelTabs.onKeyDown(event);
          scrollerDrag.handlers.onKeyDown(event);
        }}
        className="no-scrollbar flex snap-x snap-proximity gap-1 overflow-x-auto scroll-px-3 px-3 py-2 [-webkit-overflow-scrolling:touch] [overscroll-behavior-x:contain]"
      >
        <Chip label={allLabel} active={value === 'all'} count={total} onClick={() => onChange('all')} />
        {channels.map((channel) => (
          <Chip
            key={channel.value}
            label={channel.label}
            active={value === channel.value}
            count={unreadByChannel[channel.value] || 0}
            onClick={() => onChange(channel.value)}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-8 shrink-0 snap-start items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-bold leading-none transition',
        active
          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:border-emerald-600',
      )}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-extrabold',
            active ? 'bg-white/25 text-white' : 'bg-emerald-600 text-white',
          )}
        >
          {count > 99 ? '۹۹+' : count.toLocaleString('fa-IR')}
        </span>
      )}
    </button>
  );
}
