// frontend/src/components/direct/DeskEntries.tsx
//
// The two service desks at the top of the messenger: «مشاوره کشاورزی» and
// «پشتیبانی».
//
// They are entries rather than a form or a phone number, because the ask was a
// chat with a person: tapping one opens (or creates) that thread and lands the
// farmer in the same conversation the desk works from. The card carries what the
// farmer checks before writing — is anyone there, and what are the hours — from
// the desk's own state, so it cannot claim «آنلاین» that the server disagrees
// with.
//
// For an operator the same card is their queue: the count of unassigned threads
// is what tells them someone is waiting rather than waiting on a colleague.

import { useCallback, useEffect, useState } from 'react';
import { Headphones, Sprout } from 'lucide-react';
import toast from 'react-hot-toast';

import { deskApi, messagesApi } from '../../api/services';
import { deskPresence } from './DeskOutOfHours';
import { parseApiError } from '../../api/errors';
import { cn } from '../../utils/cn';
import type { DeskState, StorefrontConversation } from '../../types';

const DESKS = [
  {
    channel: 'consulting' as const,
    title: 'مشاوره کشاورزی',
    hint: 'کود، سم، آبیاری و برنامهٔ کشت را با کارشناس در میان بگذارید.',
    icon: Sprout,
  },
  {
    channel: 'support' as const,
    title: 'پشتیبانی',
    hint: 'سفارش، پرداخت، آدرس و هر چیزی که در حساب کاربری گیر کرده.',
    icon: Headphones,
  },
];

const PRESENCE_REFRESH_MS = 30000;

export default function DeskEntries({
  conversations,
  onOpen,
  className,
}: {
  conversations: StorefrontConversation[];
  onOpen: (conversationId: number) => void;
  className?: string;
}) {
  const [states, setStates] = useState<Partial<Record<'consulting' | 'support', DeskState>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const results = await Promise.allSettled(
      DESKS.map((desk) => deskApi.state(desk.channel)),
    );
    const next: Partial<Record<'consulting' | 'support', DeskState>> = {};
    results.forEach((result, index) => {
      const channel = DESKS[index]!.channel;
      if (result.status === 'fulfilled') next[channel] = result.value.data;
    });
    setStates(next);
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), PRESENCE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function open(channel: 'consulting' | 'support') {
    const existing = conversations.find((conversation) => conversation.channel === channel);
    if (existing) {
      onOpen(existing.id);
      return;
    }
    setBusy(channel);
    try {
      const response = await messagesApi.openServiceConversation(channel);
      onOpen(response.data.id);
    } catch (caught) {
      toast.error(parseApiError(caught).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn('grid gap-2 sm:grid-cols-2', className)}>
      {DESKS.map((desk) => {
        const state = states[desk.channel];
        const thread = conversations.find((conversation) => conversation.channel === desk.channel);
        const unread = thread?.unread_count ?? 0;
        const closed = thread?.status === 'closed';
        const unassigned = state?.viewer_is_staff
          ? conversations.filter(
              (conversation) => conversation.channel === desk.channel && conversation.agent === null,
            ).length
          : 0;
        // Same derivation as the chat header and the composer's notice.
        const presence = deskPresence(state ?? null);
        const Icon = desk.icon;

        return (
          <button
            key={desk.channel}
            type="button"
            onClick={() => void open(desk.channel)}
            disabled={busy === desk.channel}
            className={cn(
              'flex min-w-0 items-start gap-2.5 rounded-2xl border p-3 text-start transition',
              'border-emerald-100 bg-white hover:border-emerald-400 hover:bg-emerald-50/60',
              'dark:border-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 disabled:opacity-60',
            )}
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
              <Icon size={18} aria-hidden="true" />
              <span
                className={cn(
                  'absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-emerald-950',
                  {
                    closed: 'bg-slate-400',
                    online: 'bg-emerald-500',
                    open: 'bg-amber-400',
                  }[presence],
                )}
                aria-hidden="true"
                title={
                  presence === 'online'
                    ? 'همین حالا کسی پای میز است'
                    : presence === 'closed'
                      ? 'خارج از ساعت کاری'
                      : 'در ساعت کاری، بدون کاربر آنلاین'
                }
              />
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-fluid-xs font-extrabold text-slate-800 dark:text-white">
                  {desk.title}
                </span>
                {unread > 0 && (
                  <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                    {unread.toLocaleString('fa-IR')}
                  </span>
                )}
                {closed && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-emerald-900 dark:text-emerald-200">
                    بسته شده
                  </span>
                )}
              </span>

              <span className="mt-1 block truncate text-fluid-2xs leading-5 text-slate-500 dark:text-emerald-200">
                {thread ? thread.last_message?.body || desk.hint : desk.hint}
              </span>

              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold">
                <span className={cn(presence === 'online' ? 'text-emerald-600 dark:text-lime-300' : 'text-slate-400 dark:text-emerald-300/70')}>
                  {presence === 'closed'
                    ? `خارج از ساعت کاری${state?.opens_at_label ? ` — بازگشایی ${state.opens_at_label}` : ''}`
                    : presence === 'online'
                      ? `${(state?.online_count ?? 0).toLocaleString('fa-IR')} نفر آنلاین`
                      : 'در ساعت کاری'}
                </span>
                {state?.tracked && <span className="text-slate-400 dark:text-emerald-300/70">{state.hours}</span>}
                {unassigned > 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                    {unassigned.toLocaleString('fa-IR')} گفتگوی بی‌سرپرست
                  </span>
                )}
              </span>
            </span>

            <span className="shrink-0 self-center rounded-full bg-emerald-50 px-2 py-1 text-fluid-2xs font-extrabold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
              {thread ? 'ادامه' : 'شروع'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
