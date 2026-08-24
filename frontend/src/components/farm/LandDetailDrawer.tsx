// frontend/src/components/farm/LandDetailDrawer.tsx
//
// One land's complete case file: identification record, calendar, and the
// consultation form for this specific land. Slides in as a drawer on mobile,
// a centered dialog on larger screens.

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Droplets, MapPin, Pencil, Ruler, Sprout, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { farmApi } from '../../api/services';
import { useTranslation } from '../../i18n';
import type { FarmCalendarEvent, FarmLand } from '../../types';
import { formatFaDate } from './farmOptions';
import LandCalendar from './LandCalendar';

type TabKey = 'id' | 'calendar';

export default function LandDetailDrawer({
  land,
  onClose,
  onEdit,
  onChanged,
}: {
  land: FarmLand;
  onClose: () => void;
  onEdit: (land: FarmLand) => void;
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>('id');
  const [events, setEvents] = useState<FarmCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await farmApi.landDetail(land.id);
      setEvents(response.data.events || []);
    } catch {
      toast.error('دریافت تقویم زمین با خطا روبه‌رو شد.');
    } finally {
      setLoading(false);
    }
  }, [land.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-label={land.name}
      >
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          className="absolute inset-0 bg-emerald-950/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-emerald-50 dark:bg-emerald-950 sm:rounded-3xl"
        >
          {/* Header */}
          <header className="border-b border-emerald-100 bg-white p-4 dark:border-emerald-900 dark:bg-emerald-950">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-xl text-white">
                  {land.land_type === 'orchard' ? '🌳' : land.land_type === 'greenhouse' ? '🏡' : '🌾'}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-extrabold text-slate-800 dark:text-white">{land.name}</h2>
                  <p className="truncate text-fluid-xs text-slate-400">
                    {land.land_type_label} · {land.crop_type}
                    {land.crop_variety ? ` (${land.crop_variety})` : ''}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => onEdit(land)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900"
                  aria-label={t('common.edit')}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-emerald-900"
                  aria-label={t('common.close')}
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="mt-3 flex" role="tablist" aria-label="بخش‌های پرونده زمین">
              {(
                [
                  { key: 'id', label: 'شناسنامه زمین' },
                  { key: 'calendar', label: 'تقویم کشاورزی' },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`flex-1 border-b-2 px-2 py-2 text-xs font-bold transition ${
                    tab === key
                      ? 'border-emerald-600 text-emerald-700 dark:border-lime-400 dark:text-lime-300'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'id' ? (
              <section className="rounded-3xl border border-emerald-100 bg-white p-4 dark:border-emerald-900 dark:bg-emerald-950">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <IdentityCell icon={<Ruler size={14} />} label="مساحت" value={land.area_label} />
                  <IdentityCell icon={<Sprout size={14} />} label="نوع خاک" value={land.soil_type_label} />
                  <IdentityCell icon={<Droplets size={14} />} label="آبیاری" value={land.irrigation_type_label} />
                  {(land.province || land.city) && (
                    <IdentityCell
                      icon={<MapPin size={14} />}
                      label="موقعیت"
                      value={[land.province, land.city].filter(Boolean).join('، ')}
                    />
                  )}
                  {land.planting_date && (
                    <IdentityCell icon={<Sprout size={14} />} label="تاریخ کاشت" value={formatFaDate(land.planting_date)} />
                  )}
                  <IdentityCell icon={<Ruler size={14} />} label="رویدادهای تقویم" value={`${land.event_count} مورد`} />
                </dl>
                {land.notes && (
                  <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-xs leading-6 text-slate-600 dark:bg-emerald-900/40 dark:text-emerald-100">
                    <p className="mb-1 font-extrabold text-emerald-700 dark:text-lime-300">یادداشت‌های شناسنامه</p>
                    {land.notes}
                  </div>
                )}
              </section>
            ) : loading ? (
              <p className="py-10 text-center text-xs text-slate-400">{t('common.loading')}</p>
            ) : (
              <LandCalendar events={events} landId={land.id} onChanged={async () => { await load(); await onChanged(); }} />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function IdentityCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-emerald-50/70 p-3 dark:bg-emerald-900/30">
      <dt className="flex items-center gap-1 text-fluid-2xs font-bold text-slate-400 dark:text-emerald-300">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-xs font-extrabold text-slate-700 dark:text-white">{value}</dd>
    </div>
  );
}
