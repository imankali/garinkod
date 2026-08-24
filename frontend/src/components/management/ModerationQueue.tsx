// frontend/src/components/management/ModerationQueue.tsx

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Filter, Loader2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { managementApi, type ModerationQueueRow } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const CONTENT_TYPES = [
  { value: 'all', label: 'همه محتوا' },
  { value: 'listing', label: 'آگهی غرفه' },
  { value: 'post', label: 'پست و استوری' },
  { value: 'comment', label: 'نظرات' },
  { value: 'feedback', label: 'بازخوردها' },
  { value: 'complaint', label: 'شکایت‌ها' },
];

const STATUSES = [
  { value: 'pending', label: 'در انتظار بررسی' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'rejected', label: 'ردشده' },
  { value: 'all', label: 'همه وضعیت‌ها' },
];

const PAGE_SIZE = 20;

/** Only these types support approve/reject from this screen. */
const MODERATABLE = new Set(['listing', 'post', 'comment']);

/**
 * The unified review queue: listings, posts, comments, feedback and
 * complaints in one paginated, filterable list with bulk actions.
 *
 * Rejection always collects a reason — the API refuses without one, and the
 * seller is shown exactly what was written.
 */
export default function ModerationQueue() {
  const [contentType, setContentType] = useState('all');
  const [status, setStatus] = useState('pending');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 350);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<ModerationQueueRow[]>([]);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<ModerationQueueRow | null>(null);
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await managementApi.moderationQueue({
        type: contentType,
        status,
        search: search || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setRows(response.data.results);
      setCount(response.data.count);
      setTotalPages(response.data.total_pages);
      setSelected(new Set());
    } catch (caught) {
      setError(parseApiError(caught).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [contentType, status, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [contentType, status, search]);

  const rowKey = (row: ModerationQueueRow) => `${row.type}:${row.id}`;

  function toggleRow(row: ModerationQueueRow) {
    const key = rowKey(row);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  const selectableRows = rows.filter((row) => MODERATABLE.has(row.type));
  const allSelected = selectableRows.length > 0 && selectableRows.every((row) => selected.has(rowKey(row)));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableRows.map(rowKey)));
  }

  async function approveOne(row: ModerationQueueRow) {
    setBusy(true);
    try {
      await managementApi.moderate(row.type as 'listing' | 'post' | 'comment', row.id, 'published');
      toast.success('محتوا تأیید و منتشر شد.');
      await load();
    } catch {
      // The interceptor has already shown the reason.
    } finally {
      setBusy(false);
    }
  }

  async function submitRejection() {
    if (reason.trim().length < 5) {
      setReasonError('دلیل رد باید حداقل ۵ کاراکتر باشد.');
      return;
    }
    setBusy(true);
    setReasonError('');
    try {
      if (bulkRejecting) {
        // Bulk actions apply to one content type at a time, which is what the
        // API's transactional endpoint expects.
        const byType = new Map<string, number[]>();
        selected.forEach((key) => {
          const [type, id] = key.split(':');
          if (!type || !id) return;
          byType.set(type, [...(byType.get(type) ?? []), Number(id)]);
        });
        for (const [type, ids] of byType) {
          await managementApi.bulkModerate(
            type as 'listing' | 'post' | 'comment',
            ids,
            'rejected',
            reason.trim(),
          );
        }
        toast.success(`${selected.size} مورد رد شد.`);
      } else if (rejecting) {
        await managementApi.moderate(
          rejecting.type as 'listing' | 'post' | 'comment',
          rejecting.id,
          'rejected',
          reason.trim(),
        );
        toast.success('محتوا رد شد و دلیل برای غرفه‌دار ثبت شد.');
      }
      setRejecting(null);
      setBulkRejecting(false);
      setReason('');
      await load();
    } catch (caught) {
      const parsed = parseApiError(caught);
      setReasonError(parsed.fields.reason ?? parsed.message);
    } finally {
      setBusy(false);
    }
  }

  async function bulkApprove() {
    setBusy(true);
    try {
      const byType = new Map<string, number[]>();
      selected.forEach((key) => {
        const [type, id] = key.split(':');
        if (!type || !id) return;
        byType.set(type, [...(byType.get(type) ?? []), Number(id)]);
      });
      for (const [type, ids] of byType) {
        await managementApi.bulkModerate(type as 'listing' | 'post' | 'comment', ids, 'published');
      }
      toast.success(`${selected.size} مورد تأیید شد.`);
      await load();
    } catch {
      // Errors are surfaced globally.
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">صف بررسی محتوا</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-emerald-200">
        آگهی‌ها، پست‌ها، نظرات، بازخوردها و شکایت‌ها در یک صف واحد.
      </p>

      {/* Filters */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-emerald-200">نوع محتوا</span>
          <select
            value={contentType}
            onChange={(event) => setContentType(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
          >
            {CONTENT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-emerald-200">وضعیت</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-emerald-200">جستجو</span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="عنوان، متن یا نام غرفه"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
          />
        </label>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-900/50">
          <span className="text-xs font-bold text-emerald-800 dark:text-lime-200">
            {selected.size} مورد انتخاب شده
          </span>
          <button
            type="button"
            onClick={bulkApprove}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            تأیید گروهی
          </button>
          <button
            type="button"
            onClick={() => {
              setBulkRejecting(true);
              setReason('');
              setReasonError('');
            }}
            disabled={busy}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            رد گروهی
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs font-bold text-slate-500 underline"
          >
            لغو انتخاب
          </button>
        </div>
      )}

      {/* Rows */}
      {loading ? (
        <p role="status" aria-live="polite" className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={15} className="animate-spin" /> در حال دریافت صف بررسی…
        </p>
      ) : error ? (
        <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-6 flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 p-8 text-sm text-slate-400 dark:border-emerald-800">
          <Filter size={15} /> موردی برای بررسی وجود ندارد.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-emerald-100">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={selectableRows.length === 0}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              انتخاب همه موارد قابل بررسی
            </label>
            <span className="text-xs text-slate-400">{count} مورد</span>
          </div>

          <ul className="mt-3 space-y-3">
            {rows.map((row) => (
              <li
                key={rowKey(row)}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/40"
              >
                <div className="flex items-start gap-3">
                  {MODERATABLE.has(row.type) && (
                    <input
                      type="checkbox"
                      checked={selected.has(rowKey(row))}
                      onChange={() => toggleRow(row)}
                      aria-label={`انتخاب ${row.title}`}
                      className="mt-1 h-4 w-4 shrink-0 rounded accent-emerald-600"
                    />
                  )}
                  {row.image_url && (
                    <img
                      src={row.image_url}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-emerald-800 dark:text-lime-200">
                        {CONTENT_TYPES.find((entry) => entry.value === row.type)?.label ?? row.type}
                      </span>
                      <strong className="truncate text-sm text-slate-800 dark:text-white">{row.title}</strong>
                      <span className="text-[10px] text-slate-400">{row.status_label}</span>
                    </div>
                    {row.storefront && (
                      <p className="mt-1 text-[11px] text-emerald-700 dark:text-lime-300">غرفه {row.storefront}</p>
                    )}
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-emerald-100">{row.excerpt}</p>
                    {row.rejection_reason && (
                      <p className="mt-2 rounded-lg bg-rose-50 p-2 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                        دلیل رد: {row.rejection_reason}
                      </p>
                    )}
                  </div>

                  {MODERATABLE.has(row.type) && (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => approveOne(row)}
                        disabled={busy}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                      >
                        <CheckCircle2 size={12} /> تأیید
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejecting(row);
                          setReason('');
                          setReasonError('');
                        }}
                        disabled={busy}
                        className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                      >
                        <XCircle size={12} /> رد
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav aria-label="صفحه‌بندی صف بررسی" className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold disabled:opacity-40 dark:border-emerald-800 dark:text-emerald-100"
              >
                قبلی
              </button>
              <span className="text-xs text-slate-500 dark:text-emerald-200">
                صفحه {page} از {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold disabled:opacity-40 dark:border-emerald-800 dark:text-emerald-100"
              >
                بعدی
              </button>
            </nav>
          )}
        </>
      )}

      {/* Rejection reason dialog */}
      {(rejecting || bulkRejecting) && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="reject-title" className="w-full max-w-md rounded-2xl bg-white p-5 dark:bg-emerald-950">
            <h3 id="reject-title" className="text-base font-extrabold text-slate-800 dark:text-white">
              {bulkRejecting ? `رد ${selected.size} مورد انتخاب‌شده` : `رد «${rejecting?.title}»`}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">
              دلیل رد برای غرفه‌دار نمایش داده می‌شود و در لاگ مدیریتی ثبت می‌گردد.
            </p>
            <label htmlFor="reject-reason" className="mt-3 block text-xs font-bold text-slate-600 dark:text-emerald-100">
              دلیل رد <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? 'reject-reason-error' : undefined}
              className={`mt-1 w-full rounded-xl border p-3 text-sm dark:bg-emerald-900 dark:text-white ${
                reasonError ? 'border-rose-400' : 'border-slate-200 dark:border-emerald-700'
              }`}
            />
            {reasonError && (
              <p id="reject-reason-error" role="alert" className="mt-1 text-[11px] font-semibold text-rose-600">
                {reasonError}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={submitRejection}
                disabled={busy}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? 'در حال ثبت…' : 'ثبت رد'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejecting(null);
                  setBulkRejecting(false);
                }}
                className="rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 dark:border-emerald-700 dark:text-emerald-100"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
