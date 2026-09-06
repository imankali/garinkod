// frontend/src/components/direct/DeskOutOfHours.tsx
//
// The one sentence a farmer needs when the desk is not answering: «الان ساعت
// کاری نیست؛ درخواستتان را بنویسید تا در بازه بعدی پاسخ دهیم» — plus when that
// next window actually opens.
//
// Whether the desk is open is a single computed answer shared by the chat
// header, this note and the staff queue, so the three cannot disagree about
// something the farmer is about to act on.

import { MoonStar } from 'lucide-react';

import type { DeskState } from '../../types';

export type DeskPresence = 'online' | 'open' | 'closed';

/**
 * The desk's state, derived the same way everywhere it is shown.
 *
 * An untracked desk (the admin switched the indicator off, or this is a private
 * shop chat with no hours at all) counts as open: the absence of a schedule is
 * not a reason to tell someone nobody will read their message.
 */
export function deskPresence(desk: DeskState | null): DeskPresence {
  if (!desk || !desk.tracked) return 'open';
  if (!desk.is_open) return 'closed';
  return desk.online_count > 0 ? 'online' : 'open';
}

/**
 * The composer's out-of-hours notice.
 *
 * The wording is the platform's, editable in the admin panel; the next opening
 * comes from the desk's own schedule. It is a note, not a block — the message
 * still sends and waits in the queue, which is the whole point of writing at
 * eleven at night.
 */
export function DeskOutOfHoursNote({ desk }: { desk: DeskState | null }) {
  if (!desk || !desk.tracked || desk.is_open) return null;
  const text =
    desk.out_of_hours_note.trim()
    || 'الان ساعت کاری نیست؛ لطفا درخواست خودتان را شرح دهید تا در بازه کاری بعدی پاسخگوی شما باشیم.';

  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-2xs leading-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <MoonStar size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        {text}
        {desk.opens_at_label && (
          <span className="mt-0.5 block font-extrabold">بازگشایی: {desk.opens_at_label}</span>
        )}
      </span>
    </p>
  );
}
