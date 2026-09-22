// frontend/src/components/direct/CustomerProfileCard.tsx
//
// The counterpart dossier inside a chat thread. «میزنیم روی پروفایلش تو چت و
// تمام اطلاعات‌ش رو می‌بینیم»: for an operator the card answers «که هست، با چه
// شماره‌ای، با چه زمینی و چه درخواست‌هایی» — contact details, access level, the
// lands registered in مزرعه من and the service requests they filed. Customers
// tapping their own name get the same card through the same endpoint; the
// server just omits the staff-only view flag.

import { useEffect, useState } from 'react';
import { BadgeCheck, Landmark, Loader2, Phone, X } from 'lucide-react';

import { deskApi, type CustomerCardResponse } from '../../api/services';
import { formatShamsi } from '../../utils/shamsiDate';
import { cn } from '../../utils/cn';

const REQUEST_TONE: Record<string, string> = {
  new: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
  contacted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
  quoted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
  closed: 'bg-slate-100 text-slate-500 dark:bg-emerald-900 dark:text-emerald-200',
};

export default function CustomerProfileCard({
  conversationId,
  onClose,
}: {
  conversationId: number;
  onClose: () => void;
}) {
  const [card, setCard] = useState<CustomerCardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    deskApi
      .customerCard(conversationId)
      .then((response) => {
        if (!cancelled) setCard(response.data);
      })
      .catch(() => {
        if (!cancelled) setError('پروفایل در دسترس نیست.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const customer = card?.customer;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="پروفایل طرف مقابل"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl dark:bg-emerald-950 sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-extrabold text-slate-800 dark:text-white">
            {card?.is_staff_view ? 'پروفایل مشتری' : 'پروفایل شما'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="-me-1 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-emerald-50 hover:text-slate-600 dark:hover:bg-emerald-900 dark:hover:text-emerald-100"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
            <Loader2 size={14} className="animate-spin" />
            در حال بارگذاری…
          </p>
        ) : error || !customer ? (
          <p className="py-10 text-center text-xs text-slate-400">{error}</p>
        ) : (
          <>
            {/* Identity */}
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-900/20">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-600 text-base font-extrabold text-white">
                {customer.avatar_url ? (
                  <img src={customer.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (customer.full_name || '؟').charAt(0)
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-slate-800 dark:text-white">{customer.full_name}</p>
                <p className="truncate text-fluid-2xs text-slate-400" dir="ltr">@{customer.username}</p>
              </div>
            </div>

            {/* Contact facts */}
            <dl className="mt-3 space-y-2 text-fluid-xs">
              <div className="flex items-center gap-2 text-slate-600 dark:text-emerald-100">
                <Phone size={13} className="shrink-0 text-emerald-600 dark:text-lime-300" />
                <span className="font-bold text-slate-700 dark:text-white">تلفن:</span>
                <bdi dir="ltr" className="truncate">{customer.phone || 'ثبت نشده'}</bdi>
                {customer.phone_verified && (
                  <BadgeCheck size={13} className="shrink-0 text-emerald-600 dark:text-lime-300" aria-label="شماره تأیید شده" />
                )}
              </div>
              <div className="text-slate-600 dark:text-emerald-100">
                <span className="font-bold text-slate-700 dark:text-white">ایمیل:</span>{' '}
                <bdi dir="ltr" className="break-all">{customer.email || '—'}</bdi>
              </div>
              {customer.address && (
                <div className="text-slate-600 dark:text-emerald-100">
                  <span className="font-bold text-slate-700 dark:text-white">نشانی:</span> {customer.address}
                </div>
              )}
              <div className="text-slate-600 dark:text-emerald-100">
                <span className="font-bold text-slate-700 dark:text-white">سطح:</span> {customer.level_label || '—'}
              </div>
              {customer.created && (
                <div className="text-slate-600 dark:text-emerald-100">
                  <span className="font-bold text-slate-700 dark:text-white">عضویت:</span> {formatShamsi(customer.created)}
                </div>
              )}
            </dl>

            {/* Lands */}
            <h3 className="mt-4 flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-white">
              <Landmark size={13} className="text-emerald-600 dark:text-lime-300" />
              پرونده‌های زمین ({customer.lands.length})
            </h3>
            {customer.lands.length === 0 ? (
              <p className="mt-1.5 rounded-xl border border-dashed border-emerald-200 p-3 text-center text-fluid-2xs text-slate-400 dark:border-emerald-800">
                زمینی ثبت نشده است.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {customer.lands.map((land) => (
                  <li key={land.id} className="rounded-xl border border-slate-100 p-2.5 text-fluid-2xs dark:border-emerald-900">
                    <p className="font-bold text-slate-700 dark:text-white">{land.name}</p>
                    <p className="mt-0.5 text-slate-500 dark:text-emerald-200">
                      {land.land_type_label} · {land.area_label} · {land.crop_type}
                      {(land.province || land.city) && ` · ${land.province} ${land.city}`.trim()}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {/* Service requests */}
            <h3 className="mt-4 text-xs font-extrabold text-slate-800 dark:text-white">درخواست‌های خدمت</h3>
            {customer.service_requests.length === 0 ? (
              <p className="mt-1.5 rounded-xl border border-dashed border-emerald-200 p-3 text-center text-fluid-2xs text-slate-400 dark:border-emerald-800">
                درخواستی ثبت نشده است.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {customer.service_requests.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-2.5 text-fluid-2xs dark:border-emerald-900">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-700 dark:text-white">{row.service_label}</p>
                      <p className="text-slate-400" dir="ltr">{row.code}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={cn('rounded-full px-2 py-0.5 font-bold', REQUEST_TONE[row.status] || REQUEST_TONE.closed)}>
                        {row.status_label}
                      </span>
                      <span className="text-slate-400">{formatShamsi(row.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
