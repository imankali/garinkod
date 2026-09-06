// frontend/src/components/direct/DeskComposer.tsx
//
// The desk's own additions to the composer: the canned lines and the notice
// about the working hours.
//
// Both come from one server-side object (`/api/desk/state/`) so the chips a
// farmer taps and the hours the banner quotes cannot drift apart from what the
// admin configured:
//
// * customer lines are the FAQ — tapping one **sends** it, because the desk only
//   needs the question in words and the farmer was going to type it anyway;
// * operator lines only **fill** the input, because a canned answer almost always
//   needs the farmer's crop, number or order in it before it is true;
// * lines flagged `first_message_only` disappear once the conversation has
//   started, which is what keeps an opening FAQ from becoming mid-thread clutter.

import { useState } from 'react';
import { ChevronDown, Zap } from 'lucide-react';

import { DeskOutOfHoursNote } from './DeskOutOfHours';
import { cn } from '../../utils/cn';
import type { DeskQuickReply, DeskState } from '../../types';

/**
 * Which lines are still worth offering.
 *
 * «started» means the side that is typing has already written something in this
 * thread; before that, the whole list (including the opening questions) is shown.
 */
export function visibleQuickReplies(replies: DeskQuickReply[], started: boolean) {
  return started ? replies.filter((reply) => !reply.first_message_only) : replies;
}

export default function DeskComposer({
  desk,
  started,
  disabled,
  onSend,
  onFill,
}: {
  desk: DeskState;
  /** Has this side already written in the thread? */
  started: boolean;
  disabled: boolean;
  /** A customer's tap sends the line as a message. */
  onSend: (text: string) => void;
  /** An operator's tap puts it in the input, where it can still be edited. */
  onFill: (text: string) => void;
}) {
  const replies = visibleQuickReplies(desk.quick_replies, started);
  const staff = desk.viewer_is_staff;
  const label = staff ? 'پاسخ‌های آماده میز' : 'سؤال‌های پرتکرار';
  // Open while the thread is still empty — that is when these lines earn their place, and
  // an empty chat has the room for them — and folded into one control afterwards. A desk
  // composer that stays expanded steals the chat's height, and the canned lines become the
  // part nobody can reach; one tap is a better price than a clipped panel.
  const [expanded, setExpanded] = useState(!started);

  return (
    <div className="space-y-2">
      <DeskOutOfHoursNote desk={desk} />

      {replies.length > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-white/70 dark:border-emerald-800 dark:bg-emerald-900/20">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls="desk-quick-replies"
            className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-fluid-2xs font-extrabold text-slate-500 outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset dark:text-emerald-200"
          >
            <Zap size={11} className="shrink-0 text-emerald-500" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-start">
              {label}
              <span className="ms-1 rounded-full bg-emerald-100 px-1.5 py-px text-[0.625rem] font-bold text-emerald-700 dark:bg-emerald-800/60 dark:text-emerald-100">
                {replies.length.toLocaleString('fa-IR')}
              </span>
            </span>
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={cn('shrink-0 transition-transform', expanded && 'rotate-180')}
            />
          </button>
          {/* Scrollable rather than wrapped: the composer is the last place that
              should grow taller because a chip row needed a second line. The vertical
              padding is for the focus ring, which a scroller would otherwise cut. */}
          {expanded && (
          <div
            id="desk-quick-replies"
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1.5 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {replies.map((reply) => (
              <button
                key={reply.id}
                type="button"
                disabled={disabled}
                onClick={() => (staff ? onFill(reply.text) : onSend(reply.text))}
                title={staff ? 'در کادر نوشتن قرار می‌گیرد' : 'با یک لمس ارسال می‌شود'}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-fluid-2xs font-bold outline-none transition',
                  'focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1',
                  'disabled:opacity-50',
                  staff
                    ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-lime-300',
                )}
              >
                {reply.label}
              </button>
            ))}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
