// frontend/src/components/management/UserLevels.tsx

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ChevronDown, Loader2, ShieldCheck, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';

import { managementApi, type ManagedUser } from '../../api/services';
import type { LevelRank } from '../../types';
import { parseApiError } from '../../api/errors';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { USER_LEVEL } from '../../types';

const PAGE_SIZE = 20;

/**
 * The access ladder: eight ranks, what each one unlocks, and who holds them.
 *
 * The list of levels and their promises come from the server (`/api/levels/`
 * via the management payload), so this screen can never describe a permission
 * the API would refuse. The owner (level 8) is rendered read-only: the server
 * refuses to change or deactivate one, and showing an enabled control that
 * always fails would be worse than showing none.
 */
export default function UserLevels({ viewerLevel }: { viewerLevel: number }) {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 350);
  const [levelFilter, setLevelFilter] = useState('');
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [levels, setLevels] = useState<{ value: number; label: string }[]>([]);
  const [ladder, setLadder] = useState<LevelRank[]>([]);
  const [showLadder, setShowLadder] = useState(false);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingUser, setSavingUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await managementApi.users({
        search: search || undefined,
        level: levelFilter || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setUsers(response.data.results);
      setLevels(response.data.levels);
      setLadder(response.data.ladder ?? []);
      setCount(response.data.count);
      setTotalPages(response.data.total_pages);
    } catch (caught) {
      setError(parseApiError(caught).message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search, levelFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, levelFilter]);

  async function changeLevel(user: ManagedUser, level: number) {
    setSavingUser(user.username);
    try {
      const response = await managementApi.updateUser(user.username, { level });
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? {
                ...item,
                level: response.data.level,
                level_label: levels.find((entry) => entry.value === response.data.level)?.label ?? '',
                is_staff: response.data.is_staff,
              }
            : item,
        ),
      );
      toast.success(`سطح دسترسی ${user.username} تغییر کرد.`);
    } catch {
      // The interceptor explains why (e.g. cannot grant your own level).
    } finally {
      setSavingUser(null);
    }
  }

  async function toggleActive(user: ManagedUser) {
    setSavingUser(user.username);
    try {
      const response = await managementApi.updateUser(user.username, { is_active: !user.is_active });
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? { ...item, is_active: response.data.is_active } : item,
        ),
      );
      toast.success(response.data.is_active ? 'حساب فعال شد.' : 'حساب غیرفعال شد.');
    } catch {
      // Handled globally.
    } finally {
      setSavingUser(null);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-800 dark:text-white">
        <UserCog size={20} className="text-emerald-600" />
        مدیریت کاربران و سطوح دسترسی
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-emerald-200">
        {ladder.length
          ? `${ladder.length} پله: ${ladder.map((row) => row.short_label).join(' ← ')}. هر پله آنچه سرور تعریف کرده باز می‌کند، نه آنچه این صفحه حفظ کرده است.`
          : 'نردبان دسترسی از سرور خوانده می‌شود.'}
      </p>

      {ladder.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-emerald-900 dark:bg-emerald-900/20">
          <button
            type="button"
            onClick={() => setShowLadder((open) => !open)}
            aria-expanded={showLadder}
            className="flex min-h-11 w-full items-center justify-between gap-2 px-4 text-start text-fluid-sm font-extrabold text-slate-700 transition hover:bg-white/70 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600 dark:text-lime-300" aria-hidden="true" />
              آنچه هر پله باز می‌کند
            </span>
            <ChevronDown size={16} className={showLadder ? 'rotate-180 transition' : 'transition'} aria-hidden="true" />
          </button>
          {showLadder && (
            <ol className="space-y-2 border-t border-slate-200 p-3 dark:border-emerald-900">
              {ladder.map((row) => (
                <li
                  key={row.value}
                  className="rounded-xl bg-white p-3 shadow-sm dark:bg-emerald-950 sm:flex sm:items-start sm:gap-3"
                >
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-fluid-2xs font-extrabold text-emerald-700 dark:bg-emerald-800 dark:text-lime-200">
                      {row.value.toLocaleString('fa-IR')}
                    </span>
                    <span className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                      {row.short_label}
                    </span>
                    {row.is_staff && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-fluid-2xs font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                        تیم
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block min-w-0 flex-1 text-fluid-2xs leading-6 text-slate-600 dark:text-emerald-100 sm:mt-0">
                    {row.promise}
                    {row.unlocks.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {row.unlocks.map((capability) => (
                          <span
                            key={capability.key}
                            className="rounded-full bg-emerald-50 px-2 py-0.5 text-fluid-2xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300"
                          >
                            {capability.label}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block shrink-0 text-fluid-2xs text-slate-400 dark:text-emerald-300/70 sm:mt-0">
                    {row.how}
                  </span>
                </li>
              ))}
              <li className="flex items-start gap-2 rounded-xl bg-emerald-50/70 p-3 text-fluid-2xs leading-6 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
                <BadgeCheck size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-lime-300" aria-hidden="true" />
                <span>
                  کسی که خودِ میز خدمات را اداره می‌کند (سطح ۵ به بالا یا عضو صف پشتیبانی/مشاوره) مشتری همان میز نمی‌شود؛
                  پیامش را از صف پیگیری می‌کند تا نوبت کشاورزها جلو نیفتد.
                </span>
              </li>
            </ol>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="جستجوی نام کاربری، ایمیل یا نام"
          aria-label="جستجوی کاربر"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
        />
        <select
          value={levelFilter}
          onChange={(event) => setLevelFilter(event.target.value)}
          aria-label="فیلتر سطح دسترسی"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
        >
          <option value="">همه سطوح</option>
          {levels.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p role="status" aria-live="polite" className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={15} className="animate-spin" /> در حال دریافت کاربران…
        </p>
      ) : error ? (
        <p className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs text-slate-400">{count} کاربر</p>
          <ul className="mt-2 space-y-2">
            {users.map((user) => {
              const isOwner = user.level >= USER_LEVEL.OWNER;
              const saving = savingUser === user.username;
              return (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 p-3 dark:border-emerald-900"
                >
                  <div className="min-w-0 flex-1">
                    <strong className="flex items-center gap-1 text-sm text-slate-800 dark:text-white">
                      {user.username}
                      {isOwner && <ShieldCheck size={14} className="text-amber-500" aria-label="مالک سیستم" />}
                    </strong>
                    <p className="truncate text-fluid-xs text-slate-500 dark:text-emerald-200">
                      {user.full_name || user.email || 'بدون اطلاعات تکمیلی'}
                      {user.groups.length > 0 && ` · ${user.groups.join('، ')}`}
                    </p>
                  </div>

                  {isOwner ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-fluid-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                      مالک سیستم — غیرقابل تغییر
                    </span>
                  ) : (
                    <>
                      <select
                        value={user.level}
                        disabled={saving || viewerLevel < USER_LEVEL.ADMIN}
                        onChange={(event) => changeLevel(user, Number(event.target.value))}
                        aria-label={`سطح دسترسی ${user.username}`}
                        className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
                      >
                        {levels.map((level) => (
                          <option
                            key={level.value}
                            value={level.value}
                            // An admin can never grant a level at or above their own;
                            // only the owner may create another owner.
                            disabled={
                              viewerLevel < USER_LEVEL.OWNER &&
                              level.value >= viewerLevel
                            }
                          >
                            {level.label}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1.5 text-fluid-xs font-bold text-slate-600 dark:text-emerald-100">
                        <input
                          type="checkbox"
                          checked={user.is_active}
                          disabled={saving}
                          onChange={() => toggleActive(user)}
                          className="h-4 w-4 rounded accent-emerald-600"
                        />
                        فعال
                      </label>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <nav aria-label="صفحه‌بندی کاربران" className="mt-5 flex items-center justify-center gap-2">
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
    </section>
  );
}
