// frontend/src/components/management/HealthPanel.tsx
//
// «چقدر توان داریم، چقدر استفاده شد، چه خراب شد».
//
// Three questions, answered from real rows only. The capacity figure is shown
// next to the sentence that produced it, because a number an operator cannot
// question is a number they will not trust when it is time to open the queue.
// The online list is the presence table, so a stale tab is not counted as a
// visitor and a restart of the server does not reset the count to zero. The log
// is grouped with counters, which is the only way a fault that repeats on every
// page view stays readable.

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Gauge, Hourglass, Loader2, RotateCcw, Users } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  managementApi,
  opsApi,
  type ManagedUser,
  type OpsLogRow,
  type OpsPresenceRow,
  type OpsSample,
} from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const LEVELS = [
  { value: '', label: 'همه' },
  { value: 'error', label: 'خطا' },
  { value: 'warning', label: 'هشدار' },
  { value: 'notice', label: 'اطلاع' },
] as const;

export default function HealthPanel() {
  const health = useQuery({
    queryKey: ['ops-health'],
    queryFn: async () => (await opsApi.health()).data,
    retry: false,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  if (health.isLoading) {
    return (
      <section className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 text-slate-500 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <Loader2 className="animate-spin" />
        <span className="ms-3">در حال خواندن وضعیت سرور…</span>
      </section>
    );
  }
  if (health.isError || !health.data) {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
        <h2 className="text-lg font-extrabold">داده‌های سلامت خوانده نشد</h2>
        <p className="mt-2 text-sm leading-7">
          این بخش فقط برای دسترسی مدیریتی باز می‌شود. اگر تازه وارد شده‌اید، یک بار صفحه را تازه کنید.
        </p>
        <button onClick={() => health.refetch()} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white">
          تلاش دوباره
        </button>
      </section>
    );
  }

  const data = health.data;
  const pressure = data.utilisation_percent;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-800 dark:text-white">
              <Gauge size={20} className="text-emerald-600 dark:text-lime-300" />
              توان سایت در این لحظه
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">
              {data.strategy_label} · اندازه‌گیری: {clock(data.measured_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => health.refetch()}
              className="rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:bg-emerald-900/50 dark:text-emerald-100"
            >
              تازه‌کردن
            </button>
            <a
              href="/admin/shop/capacitysettings/"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              تنظیم ظرفیت و صف
            </a>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="نفرات داخل سایت" value={fa(data.inside_now)} hint={`${fa(data.activity_window_minutes)} دقیقهٔ اخیر`} tone="emerald" />
          <Stat label="ظرفیت مجاز" value={fa(data.capacity)} hint={data.strategy_label} tone="slate" />
          <Stat label="در صف انتظار" value={fa(data.waiting_now)} hint={data.queue.enabled ? 'صف باز است' : 'صف بسته است'} tone={data.waiting_now ? 'amber' : 'slate'} />
          <Stat label="جای خالی" value={fa(data.spare_places)} hint={`٪${fa(pressure)} اشغال`} tone={pressure >= 90 ? 'rose' : 'slate'} />
        </div>

        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:bg-emerald-900/40 dark:text-emerald-100">
          <strong className="font-bold">چطور به این عدد رسیده‌ایم: </strong>
          {data.capacity_basis}
        </p>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-emerald-900/50">
          <div
            className={`h-full rounded-full transition-all ${pressure >= 90 ? 'bg-rose-500' : pressure >= 70 ? 'bg-amber-500' : 'bg-emerald-600'}`}
            style={{ width: `${Math.min(100, Math.max(2, pressure))}%` }}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">تجهیزات سرور</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">
            هرچه هست، از خود سرور خوانده می‌شود؛ چیزی که سرور نگفته، خالی می‌ماند و صفر حساب نمی‌شود.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Fact label="هسته‌های پردازشی" value={data.measurements.cpu_count === null ? '—' : fa(data.measurements.cpu_count)} />
            <Fact label="بار یک‌دقیقه‌ای" value={num(data.measurements.load_1m)} />
            <Fact label="بار پنج‌دقیقه‌ای" value={num(data.measurements.load_5m)} />
            <Fact
              label="حافظه آزاد"
              value={
                data.measurements.memory_available_mb === null
                  ? '—'
                  : `${gb(data.measurements.memory_available_mb)} گیگ`
              }
            />
            <Fact
              label="حافظه کل"
              value={data.measurements.memory_total_mb === null ? '—' : `${gb(data.measurements.memory_total_mb)} گیگ`}
            />
            <Fact
              label="سقف کانتینر"
              value={data.measurements.container_limit_mb ? `${gb(data.measurements.container_limit_mb)} گیگ` : 'بدون سقف'}
            />
            <Fact
              label="فضای آزاد دیسک"
              value={data.measurements.disk_free_mb === null ? '—' : `${gb(data.measurements.disk_free_mb)} گیگ`}
            />
            <Fact label="پردازنده گرافیکی" value={data.measurements.gpu || 'گزارشی در کار نیست'} />
            <Fact label="پایگاه داده" value={data.database.label} />
            <Fact label="بالا بودن این پروسه" value={data.uptime.label} />
            <Fact label="از" value={stamp(data.uptime.started_at)} />
            <Fact label="فایل" value={data.database.file || '—'} />
          </dl>
          {data.uptime.note ? <p className="mt-3 text-fluid-2xs text-slate-400">{data.uptime.note}</p> : null}
          <p className="mt-3 text-fluid-2xs leading-6 text-slate-400">
            پردازنده گرافیکی برای دیدن وضعیت سرور نمایش داده می‌شود، نه در محاسبهٔ سقف: بار یک فروشگاه نهاده از
            حافظه، دیتابیس و CPU می‌آید، نه از رندر. اگر روزی بار GPU-محوری (مثلاً تحلیل تصویر آفت) روی این
            سرور بیاید، وزنش باید جدا و آگاهانه اضافه شود.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800 dark:text-white">
              <Hourglass size={18} className="text-emerald-600 dark:text-lime-300" />
              صف ورودی
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                data.queue.enabled ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600 dark:bg-emerald-900/50 dark:text-emerald-100'
              }`}
            >
              {data.queue.enabled ? 'فعال' : 'خاموش — سایت همه را می‌پذیرد'}
            </span>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-emerald-100">
            تا وقتی این کلید خاموش است، هیچ کاربری معطل نمی‌شود؛ حتی اگر ظرفیت پر شده باشد. روشن‌کردنش یعنی
            «وقتی سرور نفس تنگ کرد، تازه‌واردها چند لحظه صبر کنند» — و تا {fa(data.queue.max_minutes)} دقیقه.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Fact label="در صف" value={fa(data.queue.waiting)} />
            <Fact label="تازه وارد شده‌اند" value={fa(data.queue.admitted_recently)} />
            <Fact label="سقف صبر" value={`${fa(data.queue.max_minutes)} دقیقه`} />
          </div>
          {data.queue.next_positions.length > 0 && (
            <ul className="mt-4 space-y-2">
              {data.queue.next_positions.map((row) => (
                <li key={row.position} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-xs dark:bg-emerald-900/40">
                  <span dir="ltr" className="truncate font-mono text-slate-600 dark:text-emerald-100">{row.path}</span>
                  <span className="shrink-0 text-slate-500 dark:text-emerald-200">
                    نفر {fa(row.position)} · {fa(row.waiting_minutes)} دقیقه
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800 dark:text-white">
          <Users size={18} className="text-emerald-600 dark:text-lime-300" />
          کسانی که همین حالا داخل سایت‌اند
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">
          {fa(data.online_users)} کاربر و {fa(data.online_guests)} مهمان در {fa(data.presence.window_minutes)} دقیقهٔ اخیر —
          از روی ردّ درخواست‌های واقعی، نه شمارندهٔ حافظه.
        </p>
        <OnlinePeople />
      </section>

      <PresenceRows rows={data.presence.recent} staff={data.presence.staff} windowMinutes={data.presence.window_minutes} />
      <SampleStrip samples={data.samples} />
      <LogNotebook />
    </div>
  );
}

/**
 * The account holder currently in the shop.
 *
 * A guest has no name to show, so they are counted; a user has a phone, a level
 * and an order history, and that is what an operator needs when something looks
 * wrong for one person only.
 */
function OnlinePeople() {
  const [page, setPage] = useState(1);
  const users = useQuery({
    queryKey: ['ops-online-users', page],
    queryFn: async () => (await managementApi.users({ online: 1, page, page_size: 8 })).data,
    retry: false,
    staleTime: 15_000,
  });

  if (users.isLoading) return <p className="mt-4 text-sm text-slate-500">در حال خواندن حاضران…</p>;
  const rows = users.data?.results ?? [];
  if (!rows.length) {
    return (
      <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-emerald-900/40">
        هیچ کاربر واردشده‌ای در پنجرهٔ حضور نیست. مهمان‌ها در جدول بالا شمرده می‌شوند.
      </p>
    );
  }
  return (
    <>
      <div className="mt-4 space-y-2">
        {rows.map((row: ManagedUser) => (
          <article key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs dark:bg-emerald-900/40">
            <div className="min-w-0">
              <strong className="text-slate-800 dark:text-white">{row.full_name || row.username}</strong>
              <span className="ms-2 text-slate-500 dark:text-emerald-200">{row.level_label}</span>
              <p className="mt-1 truncate text-slate-500 dark:text-emerald-200" dir="ltr">
                {row.current_path || '/'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-slate-500 dark:text-emerald-200">
              <span>{fa(row.requests_in_window ?? 0)} درخواست</span>
              <span>{fa(row.orders ?? 0)} سفارش</span>
              <span>{row.last_seen_at ? `آخرین لحظه ${clock(row.last_seen_at)}` : '—'}</span>
            </div>
          </article>
        ))}
      </div>
      {rows.length === 8 && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40 dark:bg-emerald-900/50 dark:text-emerald-100" disabled={page === 1}>
 قبلی</button>
          <span className="text-xs text-slate-500">صفحهٔ {fa(page)}</span>
          <button onClick={() => setPage((value) => value + 1)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-emerald-900/50 dark:text-emerald-100">
 بعدی</button>
        </div>
      )}
    </>
  );
}

function PresenceRows({ rows, staff, windowMinutes }: { rows: OpsPresenceRow[]; staff: number; windowMinutes: number }) {
  if (!rows.length) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">ردپای لحظه‌ای</h2>
        <p className="mt-3 text-sm text-slate-500">
          در {fa(windowMinutes)} دقیقهٔ اخیر درخواستی ثبت نشده است. جدول وقتی پر می‌شود که کسی واقعاً صفحه‌ای باز کند.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">ردپای لحظه‌ای</h2>
        <span className="text-xs text-slate-500 dark:text-emerald-200">{fa(staff)} نفر از کارمندان</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-right text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="py-2 font-bold">چه‌کسی</th>
              <th className="py-2 font-bold">نوع</th>
              <th className="py-2 font-bold">کجا</th>
              <th className="py-2 font-bold">درخواست</th>
              <th className="py-2 font-bold">آخرین لحظه</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/60">
            {rows.map((row) => (
              <tr key={row.identity} className={row.is_staff ? 'bg-emerald-50/60 dark:bg-emerald-900/30' : ''}>
                <td className="py-2.5 text-slate-700 dark:text-white">{row.who || 'مهمان'}</td>
                <td className="py-2.5 text-slate-500 dark:text-emerald-200">{row.kind_label}</td>
                <td className="py-2.5 text-slate-500 dark:text-emerald-200" dir="ltr">{row.path}</td>
                <td className="py-2.5 text-slate-500 dark:text-emerald-200">{fa(row.requests)}</td>
                <td className="py-2.5 text-slate-500 dark:text-emerald-200">{clock(row.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-fluid-2xs leading-6 text-slate-400">
        نشانهٔ هر کاربر تا هشت رقم آخرش نمایش داده می‌شود؛ کلید کامل در هیچ پاسخ این سایت نمی‌آید.
      </p>
    </section>
  );
}

/** The last hour of samples, as bars: a picture of whether the ceiling is near. */
function SampleStrip({ samples }: { samples: OpsSample[] }) {
  if (samples.length < 2) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">نمود بار در ساعت اخیر</h2>
        <p className="mt-3 text-sm text-slate-500">
          هنوز نمونه‌ای در تاریخچه نیست. هر {fa(60)} ثانیه یک بار اندازه‌گیری می‌شود، پس این نمودار با اولین
          دقیقهٔ شلوغی پر می‌شود.
        </p>
      </section>
    );
  }
  const peak = Math.max(...samples.map((row) => Math.max(row.capacity, 1)));
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">نمود بار در ساعت اخیر</h2>
      <div className="mt-4 flex h-28 items-end gap-1">
        {samples.map((row) => {
          const share = Math.min(100, Math.round((row.online / Math.max(1, row.capacity)) * 100));
          return (
            <div
              key={row.at}
              title={`${clock(row.at)} · ${fa(row.online)} نفر از ظرفیت ${fa(row.capacity)} · ${fa(row.waiting)} در صف`}
              className={`flex-1 rounded-t-md ${share >= 90 ? 'bg-rose-500' : share >= 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ height: `${Math.max(6, Math.round((row.online / peak) * 100))}%` }}
            />
          );
        })}
      </div>
      <p className="mt-3 text-fluid-2xs text-slate-400">
        ارتفاع هر ستون نسبت به بیشینهٔ همین بازه است؛ عدد دقیق روی ستون با نگه‌داشتن نشانگر دیده می‌شود.
      </p>
    </section>
  );
}

/**
 * The shop's own error notebook.
 *
 * Resolve is not delete: the count stays, so a fault that returns after being
 * marked fixed shows up as «this again», which is the only honest way to talk
 * about a recurring bug.
 */
function LogNotebook() {
  const [level, setLevel] = useState<string>('');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput, 350);

  useEffect(() => setPage(1), [level, onlyOpen, search]);

  const logs = useQuery({
    queryKey: ['ops-logs', level, onlyOpen, search, page],
    queryFn: async () =>
      (
        await opsApi.logs({
          level: level || undefined,
          search: search || undefined,
          open: onlyOpen ? 1 : undefined,
          page,
          page_size: 10,
        })
      ).data,
    retry: false,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const act = useCallback(async (row: OpsLogRow, action: 'resolve' | 'reopen', note = '') => {
    try {
      await opsApi.resolveLog(row.id, note, action);
      toast.success(action === 'resolve' ? 'علامت‌گذاری شد.' : 'دوباره باز شد.');
      await logs.refetch();
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  }, [logs]);

  const summary = logs.data?.summary;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800 dark:text-white">
          <AlertTriangle size={18} className="text-amber-500" />
          لاگ‌های سیستم
        </h2>
        <div className="flex items-center gap-2 text-xs">
          {LEVELS.map((item) => (
            <button
              key={item.value || 'all'}
              onClick={() => setLevel(item.value)}
              className={`rounded-full px-3 py-1.5 font-bold transition ${
                level === item.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-emerald-900/50 dark:text-emerald-100'
              }`}
            >
              {item.label}
            </button>
          ))}
          <label className="ms-2 inline-flex items-center gap-2 font-bold text-slate-600 dark:text-emerald-100">
            <input type="checkbox" checked={onlyOpen} onChange={(event) => setOnlyOpen(event.target.checked)} className="accent-emerald-600" />
            فقط بازها
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="جستجو در متن خطا، نشانی صفحه یا نام بخش"
          className="min-h-11 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-900/40 dark:text-white"
        />
        {summary && (
          <p className="text-xs text-slate-500 dark:text-emerald-200">
            {fa(summary.open)} گروه باز · {fa(summary.occurrences_open)} رخداد · ۲۴ ساعت اخیر:{' '}
            {fa(summary.error_24h)} خطا، {fa(summary.warning_24h)} هشدار
          </p>
        )}
      </div>

      {logs.isLoading && <p className="mt-5 text-sm text-slate-500">در حال خواندن دفترچه…</p>}
      {logs.isError && <p className="mt-5 text-sm text-rose-600">لاگ‌ها خوانده نشد. اگر تازه وارد شده‌اید، دوباره تلاش کنید.</p>}

      {!logs.isLoading && !logs.isError && !(logs.data?.results.length ?? 0) && (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-emerald-900/40">
          چیزی ثبت نشده است. این یعنی نه استثنائی از سمت سرور آمده و نه گزارشی از صفحهٔ کاربر — و تا وقتی
          چیزی خراب نشده، همین پاسخ درست است.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {(logs.data?.results ?? []).map((row) => (
          <LogRow key={row.id} row={row} onAct={act} />
        ))}
      </div>

      {(logs.data?.pages ?? 1) > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-xs">
          <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="rounded-lg bg-slate-100 px-3 py-1.5 font-bold text-slate-600 disabled:opacity-40 dark:bg-emerald-900/50 dark:text-emerald-100">
 قبلی</button>
          <span className="text-slate-500">
            {fa(page)} از {fa(logs.data?.pages ?? 1)}
          </span>
          <button onClick={() => setPage((value) => Math.min(logs.data?.pages ?? 1, value + 1))} disabled={page >= (logs.data?.pages ?? 1)} className="rounded-lg bg-slate-100 px-3 py-1.5 font-bold text-slate-600 disabled:opacity-40 dark:bg-emerald-900/50 dark:text-emerald-100">
 بعدی</button>
        </div>
      )}
    </section>
  );
}

function LogRow({ row, onAct }: { row: OpsLogRow; onAct: (row: OpsLogRow, action: 'resolve' | 'reopen', note?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(row.note || '');
  const tone = row.level === 'error' ? 'bg-rose-100 text-rose-800' : row.level === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600 dark:bg-emerald-900/60 dark:text-emerald-100';

  async function act(action: 'resolve' | 'reopen') {
    setBusy(true);
    await onAct(row, action, action === 'resolve' ? note : '');
    setBusy(false);
  }

  return (
    <article className={`rounded-2xl border p-4 ${row.is_open ? 'border-slate-200 bg-slate-50/70 dark:border-emerald-900 dark:bg-emerald-900/30' : 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-fluid-2xs font-bold ${tone}`}>{row.level_label}</span>
            <span className="text-fluid-2xs text-slate-500 dark:text-emerald-200">{row.source}</span>
            {row.count > 1 && (
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-fluid-2xs font-bold text-white">{fa(row.count)} بار</span>
            )}
            {!row.is_open && <span className="inline-flex items-center gap-1 text-fluid-2xs font-bold text-emerald-700 dark:text-lime-200"><Check size={12} /> برطرف‌شده</span>}
          </div>
          <p className="mt-2 break-words text-sm font-bold text-slate-800 dark:text-white">{row.title}</p>
          {row.message ? <p className="mt-1 break-words text-xs leading-6 text-slate-600 dark:text-emerald-100" dir="auto">{row.message}</p> : null}
          <p className="mt-2 text-fluid-2xs text-slate-400">
            {row.method} <span dir="ltr">{row.path}</span> {row.status_code ? `· ${fa(row.status_code)}` : ''} · نخست {stamp(row.first_at)} · آخرین {clock(row.last_at)}
            {row.user ? ` · کاربر: ${row.user}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {row.is_open ? (
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="یادداشت رفع (اختیاری)"
              className="min-h-10 w-44 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950 dark:text-white"
            />
          ) : null}
          <div className="flex items-center gap-2">
            {row.is_open ? (
              <button onClick={() => act('resolve')} disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                <Check size={14} /> برطرف شد
              </button>
            ) : (
              <button onClick={() => act('reopen')} disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-60">
                <RotateCcw size={14} /> دوباره باز کن
              </button>
            )}
          </div>
          {!row.is_open && (row.resolved_by || row.note) && (
            <p className="max-w-[190px] text-end text-fluid-2xs leading-5 text-slate-500 dark:text-emerald-200">
              {row.resolved_by ? `${row.resolved_by} · ` : ''}
              {row.resolved_at ? stamp(row.resolved_at) : ''}
              {row.note ? ` — ${row.note}` : ''}
            </p>
          )}
        </div>
      </div>
      {row.context && Object.keys(row.context as object).length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-fluid-2xs font-bold text-slate-500 dark:text-emerald-200">بافت درخواست (پاک‌سازی‌شده)</summary>
          <pre dir="ltr" className="mt-2 max-h-56 overflow-auto rounded-xl bg-slate-900/90 p-3 text-left text-[10px] leading-5 text-emerald-100">
            {typeof row.context === 'string' ? row.context : JSON.stringify(row.context, null, 2)}
          </pre>
        </details>
      ) : null}
    </article>
  );
}

// ========================================
// small helpers, Persian-first
// ========================================

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: 'emerald' | 'amber' | 'rose' | 'slate' }) {
  const tones = {
    emerald: 'text-emerald-700 dark:text-lime-200',
    amber: 'text-amber-600 dark:text-amber-300',
    rose: 'text-rose-600 dark:text-rose-300',
    slate: 'text-slate-800 dark:text-white',
  } as const;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      <p className={`text-2xl font-extrabold ${tones[tone]}`}>{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-600 dark:text-emerald-100">{label}</p>
      {hint ? <p className="mt-1 text-fluid-2xs text-slate-400">{hint}</p> : null}
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-emerald-900/40">
      <dt className="text-fluid-2xs text-slate-500 dark:text-emerald-200">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-bold text-slate-800 dark:text-white" title={value}>{value}</dd>
    </div>
  );
}

function fa(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('fa-IR');
}

function num(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('fa-IR', { maximumFractionDigits: 2 });
}

function gb(mb: number): string {
  return (mb / 1024).toLocaleString('fa-IR', { maximumFractionDigits: 1 });
}

function clock(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

function stamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fa-IR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
