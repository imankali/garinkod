// frontend/src/components/direct/DeskPresence.tsx
//
// Who is behind a service thread, and whether they are there now.
//
// Two pieces, because they answer two different questions:
//
// * :func:`DeskIdentity` is the header. It names the person who answered last,
//   with the photo and title the platform published for them. When a colleague
//   takes the thread over mid-conversation the header changes with them, which
//   is the difference between «جواب آدم قبلی فرق داشت» and an obvious hand-over.
// * :func:`DeskOutOfHours` is the composer's notice: the desk is shut, the
//   message will still be delivered, and it says when it reopens.
//
// Nothing here decides whether the desk is open — that is the server's answer
// in ``/api/desk/state/``, so the chat, the banner and the staff queue agree.

import { Headphones, Sprout, UserRound } from 'lucide-react';

import { cn } from '../../utils/cn';
import type { DeskAgentPublic, DeskState } from '../../types';

/** Two letters for the avatar placeholder — Persian names abbreviate the same way. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return `${parts[0]?.charAt(0) ?? ''}${parts[1]?.charAt(0) ?? ''}`;
}

export function DeskIdentity({
  agent,
  desk,
  channelLabel,
  handover,
}: {
  agent: DeskAgentPublic | null;
  desk: DeskState | null;
  channelLabel: string;
  /** The thread was picked up by someone other than the assigned operator. */
  handover: boolean;
}) {
  const name = agent?.name || channelLabel;
  const online = agent ? agent.online : Boolean(desk && desk.is_open && desk.online_count > 0);

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="relative shrink-0">
        {agent?.photo_url ? (
          <img
            src={agent.photo_url}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-emerald-200 dark:ring-emerald-700"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-fluid-2xs font-extrabold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
            {agent ? initials(name) : channelLabel === 'پشتیبانی' ? <Headphones size={16} /> : <Sprout size={16} />}
          </span>
        )}
        <span
          className={cn(
            'absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-emerald-950',
            online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-emerald-800',
          )}
          title={online ? 'همین حالا آنلاین است' : 'آفلاین — پیام شما در صف می‌ماند'}
          aria-hidden="true"
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="block truncate text-fluid-sm font-extrabold text-slate-800 dark:text-white">
            {name}
          </span>
          {agent?.title && (
            <span className="hidden truncate rounded-full bg-emerald-50 px-2 py-0.5 text-fluid-2xs font-bold text-emerald-700 sm:inline dark:bg-emerald-900 dark:text-lime-300">
              {agent.title}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-fluid-2xs text-slate-500 dark:text-emerald-200">
          {handover ? (
            <span className="font-extrabold text-amber-600 dark:text-amber-300">
              پاسخ‌گوی این گفتگو عوض شده است
            </span>
          ) : (
            <span className={cn('font-bold', online ? 'text-emerald-600 dark:text-lime-300' : 'opacity-70')}>
              {online ? 'آنلاین' : 'بدون حضور — پاسخ در صف'}
            </span>
          )}
          {desk?.tracked && <span className="opacity-80">· ساعت کاری {desk.hours}</span>}
          {agent && agent.rating_count > 0 && (
            <span className="flex items-center gap-0.5 opacity-80" title={`${agent.rating_count} نظر ثبت شده`}>
              <UserRound size={10} aria-hidden="true" />
              {agent.rating_average.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} از ۵
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
