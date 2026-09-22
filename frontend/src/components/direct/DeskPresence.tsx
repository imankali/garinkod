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
import type { DeskAgentPublic, DeskState } from '@/types/messaging';

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
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <span className="relative shrink-0">
        {agent?.photo_url ? (
          <img
            src={agent.photo_url}
            alt=""
            className="h-10 w-10 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-emerald-900"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-bl from-emerald-100 to-lime-50 text-fluid-2xs font-extrabold text-emerald-700 shadow-sm ring-1 ring-emerald-200/70 dark:from-emerald-900 dark:to-emerald-950 dark:text-lime-300 dark:ring-emerald-800">
            {agent ? initials(name) : channelLabel === 'پشتیبانی' ? <Headphones size={17} /> : <Sprout size={17} />}
          </span>
        )}
        <span
          className={cn(
            'absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-emerald-950',
            online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-emerald-800',
          )}
          title={online ? 'همین حالا آنلاین است' : 'آفلاین — پیام شما در صف می‌ماند'}
          aria-hidden="true"
        />
      </span>

      {/* Two clean rows — name (+ badge), then one truncated status line. Every
          leaf is nowrap/truncate so a long desk title or hours can never wrap
          the header into the vertical word-stacking that made it look broken. */}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="block min-w-0 truncate text-fluid-sm font-extrabold text-slate-800 dark:text-white">
            {name}
          </span>
          {agent?.title && (
            <span className="hidden shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-fluid-2xs font-bold text-emerald-700 sm:inline dark:bg-emerald-900 dark:text-lime-300">
              {agent.title}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-fluid-2xs text-slate-500 dark:text-emerald-200/90">
          {handover ? (
            <span className="truncate font-extrabold text-amber-600 dark:text-amber-300">
              پاسخ‌گوی این گفتگو عوض شده است
            </span>
          ) : (
            <span
              className={cn(
                'flex items-center gap-1 whitespace-nowrap font-bold',
                online ? 'text-emerald-600 dark:text-lime-300' : 'text-amber-600 dark:text-amber-300/90',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  online ? 'bg-emerald-500' : 'bg-amber-400',
                )}
                aria-hidden="true"
              />
              {online ? 'آنلاین' : 'بدون حضور — پاسخ در صف'}
            </span>
          )}
          {desk?.tracked && (
            <span className="whitespace-nowrap rounded-full bg-slate-100 px-1.5 py-px font-bold text-slate-600 dark:bg-emerald-900/60 dark:text-emerald-100/90">
              ساعت کاری {desk.hours}
            </span>
          )}
          {agent && agent.rating_count > 0 && (
            <span
              className="ms-auto flex shrink-0 items-center gap-0.5 opacity-80"
              title={`${agent.rating_count} نظر ثبت شده`}
            >
              <UserRound size={10} aria-hidden="true" />
              {agent.rating_average.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} از ۵
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
