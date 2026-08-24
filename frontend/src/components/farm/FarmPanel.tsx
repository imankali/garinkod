// frontend/src/components/farm/FarmPanel.tsx
//
// The farmer's full profile section inside the account page: every land
// (orchard / cropland / greenhouse) with its own case file, the shared
// calendar and the consultation history. Each land keeps an independent
// identity record — a farmer may own any mix of them.

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Plus, Sprout } from 'lucide-react';

import { farmApi } from '../../api/services';
import { useTranslation } from '../../i18n';
import type { FarmLand } from '../../types';
import ConsultationsPanel from './ConsultationsPanel';
import LandDetailDrawer from './LandDetailDrawer';
import LandFormModal from './LandFormModal';

export default function FarmPanel() {
  const { t } = useTranslation();
  const [lands, setLands] = useState<FarmLand[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FarmLand | null>(null);
  const [selected, setSelected] = useState<FarmLand | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await farmApi.lands();
      setLands(response.data || []);
    } catch {
      setLands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(land: FarmLand) {
    setEditing(land);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Lands section */}
      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800 dark:text-white">
              <Sprout size={19} className="text-emerald-600 dark:text-lime-300" />
              زمین‌ها، باغ‌ها و گلخانه‌های من
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-emerald-200">
              برای هر زمین یک پرونده جدا با شناسنامه و تقویم سم‌پاشی، کوددهی و آبیاری بسازید؛
              می‌توانید چند باغ، چند زمین زراعی یا چند گلخانه داشته باشید.
            </p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700"
          >
            <Plus size={16} />
            افزودن زمین جدید
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-xs text-slate-400">{t('common.loading')}</p>
        ) : lands.length === 0 ? (
          <button
            type="button"
            onClick={openNew}
            className="mt-4 flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-emerald-200 py-10 text-center transition hover:border-emerald-400 dark:border-emerald-800"
          >
            <span className="text-3xl">🌱</span>
            <span className="text-sm font-bold text-slate-600 dark:text-emerald-100">
              هنوز زمینی ثبت نکرده‌اید
            </span>
            <span className="text-xs text-slate-400">برای شروع، اولین زمین یا باغ خود را اضافه کنید.</span>
          </button>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lands.map((land) => (
              <li key={land.id}>
                <button
                  type="button"
                  onClick={() => setSelected(land)}
                  className="group flex w-full flex-col rounded-3xl border border-emerald-100 bg-gradient-to-b from-emerald-50/60 to-white p-4 text-start shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-emerald-900 dark:from-emerald-900/30 dark:to-emerald-950"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm dark:bg-emerald-900">
                      {land.land_type === 'orchard' ? '🌳' : land.land_type === 'greenhouse' ? '🏡' : '🌾'}
                    </span>
                    <span className="rounded-full bg-emerald-600/10 px-2.5 py-1 text-fluid-2xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
                      {land.land_type_label}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-extrabold text-slate-800 transition group-hover:text-emerald-700 dark:text-white dark:group-hover:text-lime-300">
                    {land.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-emerald-200">
                    {land.crop_type}
                    {land.crop_variety ? ` · ${land.crop_variety}` : ''}
                  </p>
                  <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-fluid-2xs text-slate-400 dark:text-emerald-300">
                    <span>{land.area_label}</span>
                    <span>{land.irrigation_type_label}</span>
                    {land.city && <span>{land.city}</span>}
                  </dl>
                  <p className="mt-3 flex items-center gap-1 border-t border-emerald-100 pt-2.5 text-fluid-2xs font-bold text-emerald-600 dark:border-emerald-900 dark:text-lime-300">
                    <CalendarDays size={12} />
                    {land.event_count} رویداد در تقویم — مشاهده پرونده کامل
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Consultations */}
      <ConsultationsPanel lands={lands} onRequested={load} />

      {/* Land form */}
      <LandFormModal
        open={formOpen}
        land={editing}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          await load();
          if (editing) setSelected(null);
        }}
      />

      {/* Land detail (case file) */}
      {selected && (
        <LandDetailDrawer
          land={selected}
          onClose={() => setSelected(null)}
          onEdit={openEdit}
          onChanged={load}
        />
      )}
    </div>
  );
}
