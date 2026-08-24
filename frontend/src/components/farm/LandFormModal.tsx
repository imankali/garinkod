// frontend/src/components/farm/LandFormModal.tsx
//
// Create or edit a land (باغ / زمین زراعی / گلخانه) — the identification
// record a consultant later works on. Presented as a bottom sheet on mobile.

import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Save, Sprout, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { farmApi, type FarmLandPayload } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useTranslation } from '../../i18n';
import type { FarmLand } from '../../types';
import { AREA_UNITS, IRRIGATION_TYPES, LAND_TYPES, SOIL_TYPES } from './farmOptions';

const EMPTY: FarmLandPayload = {
  name: '',
  land_type: 'orchard',
  area: '',
  area_unit: 'hectare',
  crop_type: '',
  crop_variety: '',
  province: '',
  city: '',
  soil_type: 'loam',
  irrigation_type: 'drip',
  planting_date: '',
  notes: '',
};

export default function LandFormModal({
  open,
  land,
  onClose,
  onSaved,
}: {
  open: boolean;
  land?: FarmLand | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FarmLandPayload>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      land
        ? {
            name: land.name,
            land_type: land.land_type,
            area: land.area,
            area_unit: land.area_unit,
            crop_type: land.crop_type,
            crop_variety: land.crop_variety,
            province: land.province,
            city: land.city,
            soil_type: land.soil_type,
            irrigation_type: land.irrigation_type,
            planting_date: land.planting_date || '',
            notes: land.notes,
          }
        : EMPTY,
    );
  }, [open, land]);

  function update<Key extends keyof FarmLandPayload>(key: Key, value: FarmLandPayload[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.crop_type.trim() || !form.area) return;
    setSaving(true);
    try {
      const payload: FarmLandPayload = {
        ...form,
        name: form.name.trim(),
        crop_type: form.crop_type.trim(),
        planting_date: form.planting_date || null,
      };
      if (land) {
        await farmApi.updateLand(land.id, payload);
      } else {
        await farmApi.createLand(payload);
      }
      toast.success(land ? 'شناسنامه زمین به‌روزرسانی شد.' : 'زمین جدید به پروفایل شما اضافه شد.');
      onClose();
      await onSaved();
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label={t('common.close')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-emerald-950/40 backdrop-blur-sm"
          />
          <motion.form
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            onSubmit={submit}
            role="dialog"
            aria-modal="true"
            aria-label={land ? 'ویرایش زمین' : 'افزودن زمین جدید'}
            className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 dark:bg-emerald-950"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800 dark:text-white">
                <Sprout size={19} className="text-emerald-600 dark:text-lime-300" />
                {land ? 'ویرایش شناسنامه زمین' : 'افزودن زمین جدید'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-emerald-900"
                aria-label={t('common.close')}
              >
                <X size={17} />
              </button>
            </div>

            {/* نوع زمین */}
            <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="نوع زمین">
              {LAND_TYPES.map(({ value, label, emoji }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={form.land_type === value}
                  onClick={() => update('land_type', value)}
                  className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 text-sm font-bold transition ${
                    form.land_type === value
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/50 dark:text-lime-200'
                      : 'border-slate-100 text-slate-500 hover:border-emerald-300 dark:border-emerald-900 dark:text-emerald-100'
                  }`}
                >
                  <span className="text-xl leading-none">{emoji}</span>
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="نام زمین" required>
                <input
                  value={form.name}
                  onChange={(event) => update('name', event.target.value)}
                  required
                  maxLength={120}
                  placeholder="مثلاً باغ پسته شمالی"
                  className={inputClass}
                />
              </Field>
              <Field label="نوع محصول" required>
                <input
                  value={form.crop_type}
                  onChange={(event) => update('crop_type', event.target.value)}
                  required
                  maxLength={150}
                  placeholder="مثلاً پسته، گندم، گوجه"
                  className={inputClass}
                />
              </Field>
              <Field label="رقم/واریته (اختیاری)">
                <input
                  value={form.crop_variety}
                  onChange={(event) => update('crop_variety', event.target.value)}
                  maxLength={150}
                  placeholder="مثلاً اکبری"
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="مساحت" required>
                  <input
                    value={form.area}
                    onChange={(event) => update('area', event.target.value)}
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    className={inputClass}
                  />
                </Field>
                <Field label="واحد">
                  <select
                    value={form.area_unit}
                    onChange={(event) => update('area_unit', event.target.value)}
                    className={inputClass}
                  >
                    {AREA_UNITS.map((unit) => (
                      <option key={unit.value} value={unit.value}>{unit.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="استان">
                <input
                  value={form.province}
                  onChange={(event) => update('province', event.target.value)}
                  maxLength={80}
                  placeholder="مثلاً کرمان"
                  className={inputClass}
                />
              </Field>
              <Field label="شهر">
                <input
                  value={form.city}
                  onChange={(event) => update('city', event.target.value)}
                  maxLength={80}
                  placeholder="مثلاً رفسنجان"
                  className={inputClass}
                />
              </Field>
              <Field label="نوع خاک">
                <select
                  value={form.soil_type}
                  onChange={(event) => update('soil_type', event.target.value)}
                  className={inputClass}
                >
                  {SOIL_TYPES.map((soil) => (
                    <option key={soil.value} value={soil.value}>{soil.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="نوع آبیاری">
                <select
                  value={form.irrigation_type}
                  onChange={(event) => update('irrigation_type', event.target.value)}
                  className={inputClass}
                >
                  {IRRIGATION_TYPES.map((irrigation) => (
                    <option key={irrigation.value} value={irrigation.value}>{irrigation.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="تاریخ کاشت (اختیاری)">
                <input
                  type="date"
                  value={form.planting_date || ''}
                  onChange={(event) => update('planting_date', event.target.value)}
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="یادداشت‌های شناسنامه (اختیاری)">
                  <textarea
                    value={form.notes}
                    onChange={(event) => update('notes', event.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="شرایط خاص زمین، تاریخچه آفات و…"
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
      {label} {required && <span className="text-rose-500">*</span>}
      {children}
    </label>
  );
}
