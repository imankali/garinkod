// frontend/src/pages/Farmers.tsx
//
// The consultant's workbench (staff level 3+). Two panes:
//   • requests — every consultation request with the farmer's case file
//     attached; answering and writing calendar entries happens right there
//   • farmers — the directory with each farmer's full dossier: profile, every
//     land, every calendar, every request

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, CalendarPlus, Inbox, MapPin, MessageCircleQuestion, MessagesSquare, Search, Send,
  Sprout, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { consultingApi, messagesApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { useTranslation } from '../i18n';
import { cn } from '../utils/cn';
import { useDirectStore } from '../store/directStore';
import type {
  ConsultantFarmerDossier, ConsultantFarmerSummary, FarmCalendarEvent,
  FarmConsultationRequest, FarmEventKind, FarmLand,
} from '../types';
import { EVENT_KINDS, formatFaDate } from '../components/farm/farmOptions';

type View = 'requests' | 'farmers';

export default function Farmers() {
  const [view, setView] = useState<View>('requests');

  return (
    <main className="mx-auto max-w-7xl px-[var(--page-gutter)] py-6 md:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-800 dark:text-white md:text-2xl">
            <Sprout size={22} className="text-emerald-600 dark:text-lime-300" />
            پشتیبانی کشاورزان
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-emerald-200">
            درخواست‌های مشاوره، پرونده زمین‌ها و تقویم سم‌پاشی، کوددهی و آبیاری کشاورزان.
          </p>
        </div>
        <div className="flex rounded-2xl border border-emerald-100 bg-white p-1 dark:border-emerald-900 dark:bg-emerald-950">
          {(
            [
              { key: 'requests', label: 'درخواست‌های مشاوره', icon: Inbox },
              { key: 'farmers', label: 'کشاورزان', icon: Users },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                'flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition',
                view === key
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-500 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </header>

      {view === 'requests' ? <RequestsView /> : <FarmersDirectory />}
    </main>
  );
}

// ============================================================
// Requests queue
// ============================================================
function RequestsView() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<FarmConsultationRequest[]>([]);
  const [status, setStatus] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await consultingApi.requests(status ? { status } : undefined);
      setRequests(response.data || []);
      setActiveId((current) => current ?? response.data?.[0]?.id ?? null);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 20000);
    return () => clearInterval(interval);
  }, [load]);

  const active = useMemo(
    () => requests.find((request) => request.id === activeId) || null,
    [requests, activeId],
  );

  return (
    <div className="mt-5 grid h-[70dvh] overflow-hidden lg:min-h-[28rem] rounded-3xl border border-emerald-100 bg-white shadow-sm dark:border-emerald-800 dark:bg-emerald-950 lg:grid-cols-[340px_1fr]">
      {/* Queue */}
      <aside className={`${active ? 'hidden lg:flex' : 'flex'} h-full flex-col overflow-hidden`}>
        <div className="flex gap-1.5 border-b border-emerald-100 p-3 dark:border-emerald-900">
          {['', 'pending', 'answered', 'closed'].map((value) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => setStatus(value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-fluid-xs font-bold transition',
                status === value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-slate-500 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-100',
              )}
            >
              {value === '' ? 'همه' : value === 'pending' ? 'در انتظار' : value === 'answered' ? 'پاسخ‌داده' : 'بسته'}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
          {loading ? (
            <p className="py-10 text-center text-xs text-slate-400">{t('common.loading')}</p>
          ) : requests.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">درخواستی وجود ندارد.</p>
          ) : (
            <ul className="space-y-2">
              {requests.map((request) => (
                <li key={request.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(request.id)}
                    className={cn(
                      'w-full rounded-2xl border p-3 text-start transition',
                      activeId === request.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/50'
                        : 'border-transparent hover:bg-emerald-50/60 dark:hover:bg-emerald-900/30',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-extrabold text-slate-800 dark:text-white">
                        {request.farmer_name}
                      </p>
                      {request.status === 'pending' && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-fluid-xs text-slate-400">
                      {request.subject_label} · {request.land.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-fluid-xs leading-5 text-slate-500 dark:text-emerald-200">
                      {request.message}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Active request */}
      <section className={`${active ? '' : 'hidden lg:block'} flex h-full min-h-0 flex-col border-s border-emerald-100 dark:border-emerald-800`}>
        {active ? (
          <RequestWorkspace
            request={active}
            onBack={() => setActiveId(null)}
            onReplied={() => void load()}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            درخواستی را از فهرست انتخاب کنید.
          </div>
        )}
      </section>
    </div>
  );
}

function RequestWorkspace({
  request,
  onBack,
  onReplied,
}: {
  request: FarmConsultationRequest;
  onBack: () => void;
  onReplied: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [eventForm, setEventForm] = useState<{ kind: FarmEventKind; title: string; date: string; notes: string }>({
    kind: 'spraying', title: '', date: '', notes: '',
  });
  const [addingEvent, setAddingEvent] = useState(false);

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await consultingApi.reply(request.id, { reply: reply.trim(), status: 'answered' });
      toast.success('پاسخ برای کشاورز ارسال شد.');
      setReply('');
      await onReplied();
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setSending(false);
    }
  }

  async function submitEvent(event: FormEvent) {
    event.preventDefault();
    if (!eventForm.title.trim() || !eventForm.date) return;
    try {
      await consultingApi.addEvent(request.land.id, { ...eventForm, title: eventForm.title.trim() });
      toast.success('رویداد در تقویم زمین ثبت شد؛ کشاورز آن را با برچسب «یادداشت مشاور» می‌بیند.');
      setEventForm({ kind: 'spraying', title: '', date: '', notes: '' });
      setAddingEvent(false);
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  }

  const land = request.land;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3 dark:border-emerald-900">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-emerald-900"
          aria-label={t('common.back')}
        >
          <ArrowRight size={15} />
        </button>
        <MessageCircleQuestion size={16} className="text-emerald-600 dark:text-lime-300" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-extrabold text-slate-800 dark:text-white">
          {request.subject_label} — {request.farmer_name}
        </h2>
        <ChatWithFarmerButton farmerId={request.farmer} farmerName={request.farmer_name} />
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {/* Farmer + land case file */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-900/20">
          <p className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white">
            <Sprout size={14} className="text-emerald-600 dark:text-lime-300" />
            پرونده: {land.name}
            <span className="rounded-full bg-white px-2 py-0.5 text-fluid-2xs font-bold text-slate-500 dark:bg-emerald-950 dark:text-emerald-200">
              {land.land_type_label}
            </span>
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-fluid-xs text-slate-500 dark:text-emerald-200 sm:grid-cols-3">
            <span>محصول: {land.crop_type}{land.crop_variety ? ` (${land.crop_variety})` : ''}</span>
            <span>مساحت: {land.area_label}</span>
            <span>خاک: {land.soil_type_label}</span>
            <span>آبیاری: {land.irrigation_type_label}</span>
            {land.city && <span>موقعیت: {[land.province, land.city].filter(Boolean).join('، ')}</span>}
          </dl>
          <p className="mt-2 rounded-xl bg-white p-2.5 text-xs leading-5 text-slate-600 dark:bg-emerald-950 dark:text-emerald-100">
            {request.message}
          </p>
        </div>

        {/* Write into the land calendar */}
        <section className="rounded-2xl border border-emerald-100 bg-white p-3 dark:border-emerald-900 dark:bg-emerald-950">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-white">
              <CalendarPlus size={14} className="text-emerald-600 dark:text-lime-300" />
              ثبت در تقویم کشاورزی این زمین
            </h3>
            <button
              type="button"
              onClick={() => setAddingEvent((current) => !current)}
              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-fluid-xs font-bold text-white"
            >
              {addingEvent ? 'بستن' : 'افزودن رویداد'}
            </button>
          </div>
          {addingEvent && (
            <form onSubmit={submitEvent} className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr_auto_auto]">
              <select
                value={eventForm.kind}
                onChange={(event) => setEventForm((current) => ({ ...current, kind: event.target.value as FarmEventKind }))}
                className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
                aria-label="نوع عملیات"
              >
                {EVENT_KINDS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                value={eventForm.title}
                onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="عنوان (مثلاً سمپاشی کنه‌کش)"
                required
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
              />
              <input
                type="date"
                value={eventForm.date}
                onChange={(event) => setEventForm((current) => ({ ...current, date: event.target.value }))}
                required
                className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
                aria-label="تاریخ"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
              >
                {t('common.save')}
              </button>
              <textarea
                value={eventForm.notes}
                onChange={(event) => setEventForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="دستورالعمل اجرا (دوز، روش، زمان مناسب)…"
                rows={2}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-emerald-700 dark:bg-emerald-900 dark:text-white sm:col-span-4"
              />
            </form>
          )}
        </section>

        {/* Reply */}
        <form onSubmit={submitReply} className="rounded-2xl border border-emerald-100 bg-white p-3 dark:border-emerald-900 dark:bg-emerald-950">
          <h3 className="text-xs font-extrabold text-slate-800 dark:text-white">پاسخ به کشاورز</h3>
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={3}
            placeholder="پاسخ کارشناسی…"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={sending}
            className="mt-2 flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            <Send size={13} className="-scale-x-100" />
            {sending ? t('common.loading') : 'ارسال پاسخ'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Farmers directory + dossier
// ============================================================
function FarmersDirectory() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [farmers, setFarmers] = useState<ConsultantFarmerSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [dossier, setDossier] = useState<ConsultantFarmerDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [dossierLoading, setDossierLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await consultingApi.farmers(search ? { search } : undefined);
      setFarmers(response.data.results || []);
    } catch {
      setFarmers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeId) return;
    setDossierLoading(true);
    consultingApi
      .dossier(activeId)
      .then((response) => setDossier(response.data))
      .catch(() => setDossier(null))
      .finally(() => setDossierLoading(false));
  }, [activeId]);

  return (
    <div className="mt-5 grid h-[72dvh] overflow-hidden lg:min-h-[28rem] rounded-3xl border border-emerald-100 bg-white shadow-sm dark:border-emerald-800 dark:bg-emerald-950 lg:grid-cols-[320px_1fr]">
      {/* Directory */}
      <aside className={`${activeId ? 'hidden lg:flex' : 'flex'} h-full flex-col overflow-hidden`}>
        <div className="relative border-b border-emerald-100 p-3 dark:border-emerald-900">
          <Search size={14} className="pointer-events-none absolute start-6 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجوی کشاورز یا زمین…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-8 pe-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
          {loading ? (
            <p className="py-10 text-center text-xs text-slate-400">{t('common.loading')}</p>
          ) : farmers.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">کشاورزی یافت نشد.</p>
          ) : (
            <ul className="space-y-2">
              {farmers.map((farmer) => (
                <li key={farmer.id} className="relative">
                  <span className="absolute end-3 top-3 z-10">
                    <ChatWithFarmerButton
                      farmerId={farmer.id}
                      farmerName={farmer.full_name}
                      variant="ghost"
                    />
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveId(farmer.id)}
                    className={cn(
                      'w-full rounded-2xl border p-3 text-start transition',
                      activeId === farmer.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/50'
                        : 'border-transparent hover:bg-emerald-50/60 dark:hover:bg-emerald-900/30',
                    )}
                  >
                    <p className="truncate pe-32 text-xs font-extrabold text-slate-800 dark:text-white">
                      {farmer.full_name}
                    </p>
                    <p className="mt-0.5 truncate text-fluid-xs text-slate-400" dir="ltr">
                      @{farmer.username}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-fluid-2xs text-slate-500 dark:text-emerald-200">
                      <Sprout size={11} />
                      {farmer.land_count} زمین
                      {farmer.pending_requests > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                          {farmer.pending_requests} درخواست باز
                        </span>
                      )}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Dossier */}
      <section className={`${activeId ? '' : 'hidden lg:block'} flex h-full min-h-0 flex-col border-s border-emerald-100 dark:border-emerald-800`}>
        {dossierLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">{t('common.loading')}</div>
        ) : dossier ? (
          <DossierView dossier={dossier} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            کشاورزی را انتخاب کنید تا پرونده کاملش باز شود.
          </div>
        )}
      </section>
    </div>
  );
}

function DossierView({ dossier }: { dossier: ConsultantFarmerDossier }) {
  const { farmer, lands, requests } = dossier;
  const pending = requests.filter((request) => request.status === 'pending').length;

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Farmer identity */}
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-extrabold text-white">
              {(farmer.full_name || '؟').charAt(0)}
            </span>
            <div>
              <p className="text-sm font-extrabold text-slate-800 dark:text-white">{farmer.full_name}</p>
              <p className="text-fluid-xs text-slate-400" dir="ltr">@{farmer.username}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pending > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-fluid-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                {pending} درخواست در انتظار
              </span>
            )}
            <ChatWithFarmerButton farmerId={farmer.id} farmerName={farmer.full_name} />
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-fluid-xs text-slate-500 dark:text-emerald-200 sm:grid-cols-4">
          <span><strong className="text-slate-700 dark:text-white">تلفن:</strong> <bdi>{farmer.phone || '—'}</bdi></span>
          <span><strong className="text-slate-700 dark:text-white">ایمیل:</strong> <bdi>{farmer.email || '—'}</bdi></span>
          {farmer.address && (
            <span className="col-span-2"><strong className="text-slate-700 dark:text-white">نشانی:</strong> {farmer.address}</span>
          )}
        </dl>
      </div>

      {/* Lands with calendars */}
      {lands.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-emerald-200 p-6 text-center text-xs text-slate-400 dark:border-emerald-800">
          این کشاورز هنوز زمینی ثبت نکرده است.
        </p>
      ) : (
        lands.map((land) => <LandDossierCard key={land.id} land={land} />)
      )}

      {/* Requests history */}
      <h3 className="mt-5 text-sm font-extrabold text-slate-800 dark:text-white">تاریخچه درخواست‌های مشاوره</h3>
      {requests.length === 0 ? (
        <p className="mt-2 rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-400 dark:bg-emerald-900/40">
          درخواستی ثبت نشده است.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {requests.map((request) => (
            <li key={request.id} className="rounded-2xl border border-slate-100 p-3 text-xs dark:border-emerald-900">
              <div className="flex items-center justify-between gap-2">
                <p className="font-extrabold text-slate-700 dark:text-white">
                  {request.subject_label} · {request.land.name}
                </p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-fluid-2xs font-bold',
                    request.status === 'pending' && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
                    request.status === 'answered' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
                    request.status === 'closed' && 'bg-slate-100 text-slate-500 dark:bg-emerald-900 dark:text-emerald-200',
                  )}
                >
                  {request.status_label}
                </span>
              </div>
              <p className="mt-1 leading-5 text-slate-500 dark:text-emerald-200">{request.message}</p>
              {request.reply && (
                <p className="mt-1.5 rounded-xl bg-emerald-50 p-2 leading-5 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100">
                  <strong className="text-emerald-700 dark:text-lime-300">پاسخ:</strong> {request.reply}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LandDossierCard({ land }: { land: FarmLand & { events: FarmCalendarEvent[] } }) {
  const events = land.events || [];
  return (
    <section className="mt-3 rounded-2xl border border-emerald-100 bg-white p-3.5 dark:border-emerald-900 dark:bg-emerald-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white">
          <span>{land.land_type === 'orchard' ? '🌳' : land.land_type === 'greenhouse' ? '🏡' : '🌾'}</span>
          {land.name}
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-fluid-2xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
            {land.land_type_label}
          </span>
        </h4>
        <p className="text-fluid-2xs text-slate-400">
          {land.crop_type}{land.crop_variety ? ` · ${land.crop_variety}` : ''} · {land.area_label}
        </p>
      </div>
      <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-fluid-2xs text-slate-500 dark:text-emerald-200">
        <span>خاک: {land.soil_type_label}</span>
        <span>آبیاری: {land.irrigation_type_label}</span>
        {land.city && (
          <span className="flex items-center gap-1"><MapPin size={10} /> {[land.province, land.city].filter(Boolean).join('، ')}</span>
        )}
      </dl>

      {events.length > 0 && (
        <ul className="mt-2.5 space-y-1 border-t border-emerald-100 pt-2 dark:border-emerald-900">
          {events.map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-2 text-fluid-xs">
              <span className="flex min-w-0 items-center gap-1.5 text-slate-600 dark:text-emerald-100">
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-fluid-2xs font-bold',
                    event.kind === 'spraying' && 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
                    event.kind === 'fertilizing' && 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200',
                    event.kind === 'irrigation' && 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200',
                  )}
                >
                  {event.kind_label}
                </span>
                <span className="truncate">{event.title}</span>
              </span>
              <span className="shrink-0 text-fluid-2xs text-slate-400">{formatFaDate(event.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============================================================
// Chat with the farmer
// ============================================================
/**
 * Opens (or resumes) the consulting thread with one farmer and drops the
 * consultant straight into it.
 *
 * Support used to be one-way: a consultant could type a single canned reply
 * onto a request and nothing more. Real cases need back-and-forth — and
 * photos of the affected plant — so the dossier now links into the same
 * messenger the farmer already uses.
 */
function ChatWithFarmerButton({
  farmerId,
  farmerName,
  variant = 'solid',
}: {
  farmerId: number;
  farmerName: string;
  variant?: 'solid' | 'ghost';
}) {
  const openDirect = useDirectStore((state) => state.openDirect);
  const [busy, setBusy] = useState(false);

  async function startChat() {
    setBusy(true);
    try {
      const response = await messagesApi.openFarmerConversation(farmerId);
      openDirect({ conversationId: response.data.id });
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void startChat()}
      disabled={busy}
      className={cn(
        'flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-fluid-xs font-bold transition disabled:opacity-60',
        variant === 'solid'
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900',
      )}
      aria-label={`گفتگو با ${farmerName}`}
    >
      <MessagesSquare size={14} aria-hidden="true" />
      گفتگو با کشاورز
    </button>
  );
}
