// frontend/src/components/farm/LandCalendar.tsx
//
// One land's spraying/fertilizing/irrigation calendar. Both the farmer and
// the consultant write here; consultant entries carry a badge. Events can be
// marked done/cancelled, deleted, and new ones added inline.

import { FormEvent, useMemo, useState } from 'react';
import { CalendarPlus, Check, Droplets, FlaskConical, Sprout, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { farmApi, type FarmEventPayload } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useTranslation } from '../../i18n';
import { cn } from '../../utils/cn';
import type { FarmCalendarEvent, FarmEventKind } from '../../types';
import { EVENT_COLORS, EVENT_KINDS, formatFaDate } from './farmOptions';

const KIND_ICONS: Record<FarmEventKind, typeof Sprout> = {
  spraying: FlaskConical,
  fertilizing: Sprout,
  irrigation: Droplets,
};

export default function LandCalendar({
  events,
  landId,
  onChanged,
}: {
  events: FarmCalendarEvent[];
  landId: number;
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [kindFilter, setKindFilter] = useState<FarmEventKind | 'all'>('all');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FarmEventPayload>({ kind: 'spraying', title: '', date: '', notes: '' });
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => events.filter((event) => kindFilter === 'all' || event.kind === kindFilter),
    [events, kindFilter],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, FarmCalendarEvent[]>();
    for (const event of filtered) {
      const list = groups.get(event.date) || [];
      list.push(event);
      groups.set(event.date, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.date) return;
    setBusy(true);
    try {
      await farmApi.addEvent(landId, { ...form, title: form.title.trim() });
      setForm({ kind: 'spraying', title: '', date: '', notes: '' });
      setAdding(false);
      await onChanged();
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(target: FarmCalendarEvent, status: FarmCalendarEvent['status']) {
    try {
      await farmApi.updateEvent(target.id, { status });
      await onChanged();
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  }

  async function remove(target: FarmCalendarEvent) {
    try {
      await farmApi.deleteEvent(target.id);
      await onChanged();
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-white">
          <CalendarPlus size={16} className="text-emerald-600 dark:text-lime-300" />
          تقویم سم‌پاشی، کوددهی و آبیاری
        </h3>
        <button
          type="button"
          onClick={() => setAdding((current) => !current)}
          className="flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-fluid-xs font-bold text-white transition hover:bg-emerald-700"
        >
          <CalendarPlus size={14} />
          افزودن رویداد
        </button>
      </div>

      {/* Kind filter */}
      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="فیلتر نوع عملیات">
        <button
          type="button"
          role="tab"
          aria-selected={kindFilter === 'all'}
          onClick={() => setKindFilter('all')}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-fluid-xs font-bold transition',
            kindFilter === 'all'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 dark:bg-emerald-900 dark:text-emerald-100',
          )}
        >
          همه
        </button>
        {EVENT_KINDS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kindFilter === value}
            onClick={() => setKindFilter(value)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-fluid-xs font-bold transition',
              kindFilter === value
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 dark:bg-emerald-900 dark:text-emerald-100',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <form onSubmit={submit} className="mt-3 grid gap-2 rounded-2xl border border-dashed border-emerald-300 p-3 sm:grid-cols-[auto_1fr_auto_auto] dark:border-emerald-700">
          <select
            value={form.kind}
            onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as FarmEventKind }))}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
            aria-label="نوع عملیات"
          >
            {EVENT_KINDS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="عنوان رویداد…"
            required
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
          />
          <input
            type="date"
            value={form.date}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            required
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
            aria-label="تاریخ"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 dark:border-emerald-700"
              aria-label={t('common.cancel')}
            >
              <X size={14} />
            </button>
          </div>
          <textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="دستورالعمل اجرا (دوز، روش، زمان مناسب)…"
            rows={2}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-emerald-700 dark:bg-emerald-900 dark:text-white sm:col-span-4"
          />
        </form>
      )}

      {/* Events grouped by date */}
      {grouped.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-400 dark:bg-emerald-900/40 dark:text-emerald-300">
          هنوز رویدادی در تقویم این زمین ثبت نشده است.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {grouped.map(([date, dayEvents]) => (
            <li key={date}>
              <p className="mb-1.5 text-fluid-xs font-extrabold text-slate-400 dark:text-emerald-300">
                {formatFaDate(date)}
              </p>
              <ul className="space-y-1.5">
                {dayEvents.map((event) => {
                  const Icon = KIND_ICONS[event.kind] || Sprout;
                  return (
                    <li
                      key={event.id}
                      className={cn(
                        'rounded-2xl border p-3',
                        EVENT_COLORS[event.kind],
                        event.status === 'cancelled' && 'opacity-50 line-through',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <Icon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold">
                              {event.title}
                              {event.is_consultant_note && (
                                <span className="rounded-full bg-white/70 px-2 py-0.5 text-fluid-2xs font-bold dark:bg-emerald-950/50">
                                  یادداشت مشاور
                                </span>
                              )}
                              {event.status === 'done' && (
                                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-fluid-2xs font-bold text-white">
                                  انجام شد
                                </span>
                              )}
                            </p>
                            {event.notes && (
                              <p className="mt-1 whitespace-pre-wrap text-fluid-xs leading-5 opacity-80">{event.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {event.status === 'planned' && (
                            <button
                              type="button"
                              onClick={() => void setStatus(event, 'done')}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/70 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/50"
                              aria-label="انجام شد"
                              title="انجام شد"
                            >
                              <Check size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void remove(event)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/70 text-rose-500 hover:bg-rose-600 hover:text-white dark:bg-emerald-950/50"
                            aria-label="حذف رویداد"
                            title="حذف"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
