// frontend/src/pages/Finance.tsx

import { useCallback, useEffect, useState } from 'react';
import { Download, Landmark, Loader2, ShieldCheck, Store, WalletCards } from 'lucide-react';
import toast from 'react-hot-toast';

import { financeApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { useAuthStore } from '../store/authStore';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { FinancialLedgerEntry, Storefront } from '../types';
import { formatPrice } from '../utils/formatPrice';

interface Option {
  value: string;
  label: string;
}

const PAGE_SIZE = 25;

/**
 * The seller's financial ledger.
 *
 * Balances are always shown for the whole ledger even while a filter is
 * applied — a filtered total would read as "your available balance changed",
 * which is exactly the kind of ambiguity a money screen must avoid.
 */
export default function Finance() {
  const { isAuthenticated } = useAuthStore();
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [entries, setEntries] = useState<FinancialLedgerEntry[]>([]);
  const [entryTypes, setEntryTypes] = useState<Option[]>([]);
  const [statuses, setStatuses] = useState<Option[]>([]);
  const [notice, setNotice] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'no-store'>('loading');

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 350);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setState('no-store');
      return;
    }
    try {
      const response = await financeApi.storefront({
        status: statusFilter || undefined,
        entry_type: typeFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setStorefront(response.data.storefront);
      setBalances(response.data.balances);
      setEntries(response.data.entries);
      setEntryTypes(response.data.entry_types ?? []);
      setStatuses(response.data.statuses ?? []);
      setNotice(response.data.notice);
      setCount(response.data.count ?? response.data.entries.length);
      setTotalPages(response.data.total_pages ?? 1);
      setState('ready');
    } catch {
      setState('no-store');
    }
  }, [isAuthenticated, statusFilter, typeFilter, dateFrom, dateTo, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, dateFrom, dateTo, search]);

  async function handleExport() {
    setExporting(true);
    try {
      const response = await financeApi.exportLedger({
        status: statusFilter || undefined,
        entry_type: typeFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      // The CSV arrives as a blob; trigger a download without leaving the page.
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `garinkood-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('گزارش مالی دانلود شد.');
    } catch (error) {
      const parsed = parseApiError(error);
      if (!parsed.handled) toast.error(parsed.message);
    } finally {
      setExporting(false);
    }
  }

  const hasFilters = Boolean(statusFilter || typeFilter || dateFrom || dateTo || search);

  return (
    <main className="mx-auto max-w-6xl px-[var(--page-gutter)] py-9">
      <section className="rounded-3xl bg-gradient-to-l from-slate-900 via-emerald-900 to-emerald-600 p-6 text-white md:p-8">
        <p className="text-sm font-bold text-lime-200">دفتر مالی فروشنده</p>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">موجودی، کمیسیون و تسویه شفاف</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50">
          هیچ مبلغی بدون رویداد مالی، شناسه، وضعیت و تاریخ در دفتر ثبت نمی‌شود.
        </p>
      </section>

      {state === 'loading' ? (
        <p role="status" aria-live="polite" className="mt-7 flex items-center gap-2 text-slate-500">
          <Loader2 size={16} className="animate-spin" /> در حال دریافت دفتر مالی…
        </p>
      ) : state === 'no-store' ? (
        <section className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <Store size={28} />
          <h2 className="mt-3 text-xl font-extrabold">برای مشاهده دفتر مالی ابتدا غرفه بسازید</h2>
          <p className="mt-2 text-sm leading-7">
            دفتر مالی فقط به غرفه فروشنده متصل است.
          </p>
        </section>
      ) : (
        <>
          <section className="mt-7 grid gap-4 md:grid-cols-3">
            <Balance icon={WalletCards} label="در انتظار تأیید" value={balances.pending || 0} />
            <Balance icon={Landmark} label="قابل تسویه" value={balances.available || 0} />
            <Balance icon={ShieldCheck} label="مسدود برای رسیدگی" value={balances.held || 0} />
          </section>

          <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{storefront?.name}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-emerald-200">{notice}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
                  کمیسیون: {storefront?.commission_rate}٪
                </span>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-60 dark:bg-emerald-700"
                >
                  {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  خروجی CSV
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-bold text-slate-500 dark:text-emerald-200">وضعیت</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
                >
                  <option value="">همه</option>
                  {statuses.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-bold text-slate-500 dark:text-emerald-200">نوع رویداد</span>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
                >
                  <option value="">همه</option>
                  {entryTypes.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-bold text-slate-500 dark:text-emerald-200">از تاریخ</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-bold text-slate-500 dark:text-emerald-200">تا تاریخ</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-bold text-slate-500 dark:text-emerald-200">جستجو</span>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="شرح یا کد سفارش"
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
                />
              </label>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('');
                  setTypeFilter('');
                  setDateFrom('');
                  setDateTo('');
                  setSearchInput('');
                }}
                className="mt-2 text-xs font-bold text-rose-600 underline"
              >
                پاک کردن فیلترها
              </button>
            )}

            {entries.length ? (
              <>
                <p className="mt-4 text-xs text-slate-400">{count} رویداد مالی</p>
                <ul className="mt-2 space-y-3">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-emerald-900/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-slate-800 dark:text-white">{entry.entry_type_label}</strong>
                          <code
                            dir="ltr"
                            className="rounded bg-white px-1.5 py-0.5 text-fluid-2xs font-bold text-slate-500 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            {entry.reference}
                          </code>
                          {entry.order_code && (
                            <span dir="ltr" className="text-fluid-2xs text-slate-400">سفارش {entry.order_code}</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">{entry.description}</p>
                        <p className="mt-1 text-fluid-2xs text-slate-400">
                          {new Date(entry.created_at).toLocaleString('fa-IR')}
                          {entry.available_at && ` · قابل تسویه از ${new Date(entry.available_at).toLocaleDateString('fa-IR')}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="rounded-full bg-white px-2.5 py-1 text-fluid-xs font-bold text-slate-600 dark:bg-emerald-950 dark:text-emerald-200">
                          {entry.status_label}
                        </span>
                        <strong className={entry.amount >= 0 ? 'text-emerald-700 dark:text-lime-300' : 'text-rose-600'}>
                          {entry.amount < 0 && '−'}
                          {formatPrice(Math.abs(entry.amount))}
                        </strong>
                      </div>
                    </li>
                  ))}
                </ul>

                {totalPages > 1 && (
                  <nav aria-label="صفحه‌بندی دفتر مالی" className="mt-5 flex items-center justify-center gap-2">
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
            ) : (
              <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">
                {hasFilters
                  ? 'رویدادی با این فیلترها پیدا نشد.'
                  : 'هنوز رویداد مالی ثبت نشده است. با فروش آگهی و تأیید پرداخت، رکوردها خودکار ساخته می‌شوند.'}
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Balance({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: number }) {
  return (
    <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      <Icon className="text-emerald-600 dark:text-lime-300" />
      <p className="mt-4 text-xl font-extrabold text-slate-800 dark:text-white">{formatPrice(value)}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">{label}</p>
    </article>
  );
}
