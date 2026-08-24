import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BadgeDollarSign, ClipboardCheck, FileClock, Landmark, ShieldAlert, UserCog, UsersRound, Warehouse } from "lucide-react";
import toast from "react-hot-toast";

import { managementApi } from "../api/services";
import ModerationQueue from "../components/management/ModerationQueue";
import UserLevels from "../components/management/UserLevels";
import { USER_LEVEL } from "../types";
import type { ManagementAuditLog, ManagementDashboard, ManagementStaffMember, Order } from "../types";
import { formatPrice } from "../utils/formatPrice";

type Tab = 'overview' | 'moderation' | 'orders' | 'users' | 'team' | 'audit';

export default function Management() {
  const [tab, setTab] = useState<Tab>('overview');
  const [staff, setStaff] = useState<ManagementStaffMember[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [audit, setAudit] = useState<ManagementAuditLog[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['management-dashboard'], queryFn: async () => (await managementApi.dashboard()).data, retry: false, staleTime: 20_000 });

  const loadTeam = useCallback(async () => {
    if (!data?.viewer.is_superuser) return;
    setLoadingTeam(true);
    try {
      const response = await managementApi.staff();
      setStaff(response.data.staff);
      setRoles(response.data.roles);
    } catch { toast.error('دریافت نقش‌های کارمندان ممکن نشد.'); } finally { setLoadingTeam(false); }
  }, [data?.viewer.is_superuser]);
  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    try { setAudit((await managementApi.audit()).data); } catch { toast.error('دریافت لاگ مدیریتی ممکن نشد.'); } finally { setLoadingAudit(false); }
  }, []);
  useEffect(() => { if (tab === 'team') loadTeam(); if (tab === 'audit') loadAudit(); }, [tab, loadTeam, loadAudit]);

  async function markPaid(order: Order) {
    if (!window.confirm(`پرداخت سفارش ${order.code} تأیید شود؟ پاداش خرید بعدی صادر خواهد شد.`)) return;
    try {
      await managementApi.markOrderPaid(order.code);
      toast.success('پرداخت تأیید و پاداش ثبت شد.');
      await refetch();
    } catch { /* detailed API error is shown globally */ }
  }
  async function saveStaff(member: ManagementStaffMember, groups: string[], isActive: boolean) {
    try {
      const response = await managementApi.updateStaff(member.username, groups, isActive);
      setStaff((items) => items.map((item) => item.id === member.id ? { ...item, groups: response.data.groups, is_active: response.data.is_active } : item));
      toast.success('دسترسی کارمند به‌روزرسانی شد.');
    } catch { /* API error is shown globally */ }
  }

  if (isLoading) return <main className="flex min-h-[60vh] items-center justify-center"><div className="text-center text-slate-500"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" /> <p className="mt-4">در حال بارگذاری مرکز مدیریت...</p></div></main>;
  if (isError || !data) return <main className="mx-auto max-w-3xl px-[var(--page-gutter)] py-12"><section className="rounded-3xl border border-rose-200 bg-rose-50 p-7 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"><ShieldAlert size={30} /><h1 className="mt-4 text-2xl font-extrabold">دسترسی مدیریتی ندارید</h1><p className="mt-2 leading-7">این بخش فقط برای کاربران staff فعال است. مالک سایت می‌تواند از Django Admin یا نقش‌های مدیریتی، دسترسی کارمندان را تعیین کند.</p></section></main>;

  const viewerLevel = data.viewer_level ?? (data.viewer.is_superuser ? USER_LEVEL.OWNER : USER_LEVEL.MODERATOR);
  const nav = [
    { id: 'overview' as Tab, label: 'نمای کلی', icon: Activity },
    { id: 'moderation' as Tab, label: 'صف بررسی', icon: ClipboardCheck },
    { id: 'orders' as Tab, label: 'سفارش و درآمد', icon: Landmark },
    // Changing another user's level requires level 4; the tab is hidden below it.
    ...(viewerLevel >= USER_LEVEL.ADMIN
      ? [{ id: 'users' as Tab, label: 'کاربران و سطوح', icon: UserCog }]
      : []),
    { id: 'team' as Tab, label: 'کارمندان و نقش‌ها', icon: UsersRound },
    { id: 'audit' as Tab, label: 'لاگ مدیریتی', icon: FileClock },
  ];
  return <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-[#052e22]"><div className="mx-auto max-w-7xl"><section className="rounded-3xl bg-gradient-to-l from-slate-950 via-emerald-950 to-emerald-700 p-7 text-white shadow-xl"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-bold text-lime-300">مرکز فرماندهی گرین کود</p><h1 className="mt-2 text-3xl font-extrabold">مدیریت عملیات، مالی و اعتماد</h1><p className="mt-3 text-sm text-emerald-100">کاربر فعلی: {data.viewer.username} · نقش‌ها: {data.viewer.is_superuser ? 'مالک سیستم' : data.viewer.groups.join('، ') || 'کارمند'}</p></div><button onClick={() => refetch()} className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold hover:bg-white/25">به‌روزرسانی داده‌ها</button></div></section><div className="mt-6 grid gap-6 lg:grid-cols-[230px_1fr]"><aside className="h-fit rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 lg:sticky lg:top-5"><nav className="flex gap-2 overflow-x-auto lg:flex-col">{nav.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${tab === id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/50'}`}><Icon size={18} />{label}</button>)}</nav></aside><section>{tab === 'overview' && <Overview data={data} onOpenModeration={() => setTab('moderation')} />}{tab === 'moderation' && <ModerationQueue />}{tab === 'orders' && <Orders data={data.recent_orders} onMarkPaid={markPaid} />}{tab === 'users' && <UserLevels viewerLevel={viewerLevel} />}{tab === 'team' && <Team owner={data.viewer.is_superuser} staff={staff} roles={roles} loading={loadingTeam} onSave={saveStaff} />}{tab === 'audit' && <Audit audit={audit} loading={loadingAudit} />}</section></div></div></main>;
}

function Overview({ data, onOpenModeration }: { data: ManagementDashboard; onOpenModeration: () => void }) {
  const value = (amount: number | null, currency = false) => amount === null ? 'محدود' : currency ? formatPrice(amount) : amount.toLocaleString('fa-IR');
  const pendingListings = data.pending_review?.listings ?? [];
  const pendingPosts = data.pending_review?.posts ?? [];
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={BadgeDollarSign} label="فروش پرداخت‌شده" value={value(data.metrics.paid_revenue, true)} /><Metric icon={ClipboardCheck} label="سفارش در انتظار بررسی" value={value(data.metrics.pending_orders)} /><Metric icon={ShieldAlert} label="شکایت باز" value={value(data.metrics.open_complaints)} /><Metric icon={Warehouse} label="موجودی کم" value={value(data.metrics.low_stock_products)} /></div>

    {/* The review queue is visible on the landing tab, not hidden behind another click. */}
    {(pendingListings.length > 0 || pendingPosts.length > 0) && (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-amber-900 dark:text-amber-100">در انتظار بررسی شما</h2>
          <button type="button" onClick={onOpenModeration} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white">
            رفتن به صف بررسی
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {pendingListings.slice(0, 5).map((listing) => (
            <li key={`listing-${listing.id}`} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 dark:bg-emerald-950/40">
              <img src={listing.image_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-slate-800 dark:text-white">{listing.title}</strong>
                <span className="text-fluid-xs text-slate-500 dark:text-emerald-200">آگهی · غرفه {listing.storefront.name}</span>
              </div>
            </li>
          ))}
          {pendingPosts.slice(0, 5).map((post) => (
            <li key={`post-${post.id}`} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 dark:bg-emerald-950/40">
              <img src={post.image_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-slate-800 dark:text-white">{post.caption}</strong>
                <span className="text-fluid-xs text-slate-500 dark:text-emerald-200">{post.post_type_label} · غرفه {post.storefront_name}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    )}
<section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">هشدارهای عملیاتی</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{data.alerts.map((alert) => <div key={alert.type} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 dark:bg-emerald-900/40"><span className="text-sm text-slate-600 dark:text-emerald-100">{alert.label}</span><strong className={alert.count === null ? 'text-slate-400' : alert.count ? 'text-rose-600' : 'text-emerald-600'}>{value(alert.count)}</strong></div>)}</div></section></div>;
}
function Orders({ data, onMarkPaid }: { data: Order[]; onMarkPaid: (order: Order) => void }) { return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">آخرین سفارش‌ها</h2>{data.length ? <div className="mt-5 space-y-3">{data.map((order) => <article key={order.id} className="flex flex-col justify-between gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center dark:bg-emerald-900/40"><div><strong dir="ltr" className="text-slate-800 dark:text-white">{order.code}</strong><p className="mt-1 text-xs text-slate-500">{order.customer_name} · {formatPrice(order.total_price)}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{order.status_label}</span>{order.payment_status !== 'paid' && order.status !== 'cancelled' && <button onClick={() => onMarkPaid(order)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">تأیید پرداخت</button>}</div></article>)}</div> : <p className="mt-5 text-slate-500">سفارشی وجود ندارد.</p>}</section>; }
function Team({ owner, staff, roles, loading, onSave }: { owner: boolean; staff: ManagementStaffMember[]; roles: string[]; loading: boolean; onSave: (member: ManagementStaffMember, groups: string[], active: boolean) => void }) { if (!owner) return <section className="rounded-3xl bg-amber-50 p-6 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">فقط مالک سیستم می‌تواند نقش و وضعیت کارمندان را تغییر دهد.</section>; if (loading) return <p className="text-slate-500">در حال دریافت کارکنان...</p>; return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">کارمندان و نقش‌ها</h2><p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">فقط نقش لازم را اعطا کنید؛ دسترسی مالی، سفارش و moderation را برای یک کاربر بدون نیاز تجمیع نکنید.</p><div className="mt-5 space-y-4">{staff.map((member) => <StaffRow key={member.id} member={member} roles={roles} onSave={onSave} />)}</div></section>; }
function StaffRow({ member, roles, onSave }: { member: ManagementStaffMember; roles: string[]; onSave: (member: ManagementStaffMember, groups: string[], active: boolean) => void }) { const [groups, setGroups] = useState(member.groups); const [active, setActive] = useState(member.is_active); return <article className="rounded-2xl border border-slate-100 p-4 dark:border-emerald-900"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="text-slate-800 dark:text-white">{member.username}</strong><p className="text-xs text-slate-500">{member.email || 'بدون ایمیل'} {member.is_superuser ? '· مالک سیستم' : ''}</p></div><label className="text-xs font-bold"><input type="checkbox" checked={active} disabled={member.is_superuser} onChange={(event) => setActive(event.target.checked)} className="me-2 accent-emerald-600" />فعال</label></div>{!member.is_superuser && <><div className="mt-4 flex flex-wrap gap-2">{roles.map((role) => <label key={role} className={`rounded-full px-3 py-1.5 text-xs font-bold ${groups.includes(role) ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-lime-100' : 'bg-slate-100 text-slate-600 dark:bg-emerald-900/40 dark:text-emerald-100'}`}><input type="checkbox" checked={groups.includes(role)} onChange={(event) => setGroups(event.target.checked ? [...groups, role] : groups.filter((item) => item !== role))} className="me-1 accent-emerald-600" />{role}</label>)}</div><button onClick={() => onSave(member, groups, active)} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white">ذخیره نقش‌ها</button></>}</article>; }
function Audit({ audit, loading }: { audit: ManagementAuditLog[]; loading: boolean }) { if (loading) return <p className="text-slate-500">در حال دریافت لاگ‌ها...</p>; return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><h2 className="text-xl font-extrabold text-slate-800 dark:text-white">ردپای اقدامات مدیریتی</h2>{audit.length ? <div className="mt-5 space-y-3">{audit.map((item) => <article key={item.id} className="rounded-2xl bg-slate-50 p-4 text-sm dark:bg-emerald-900/40"><div className="flex flex-wrap justify-between gap-2"><strong>{item.action}</strong><time className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString('fa-IR')}</time></div><p className="mt-2 text-slate-600 dark:text-emerald-100">{item.summary}</p><p className="mt-1 text-xs text-slate-400">کاربر: {item.actor_username} · مقصد: {item.target_type} #{item.target_id}</p></article>)}</div> : <p className="mt-5 text-slate-500">هنوز لاگ مدیریتی ثبت نشده است.</p>}</section>; }
function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) { return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"><Icon size={20} className="text-emerald-600 dark:text-lime-300" /><p className="mt-4 text-xl font-extrabold text-slate-800 dark:text-white">{value}</p><p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">{label}</p></article>; }
