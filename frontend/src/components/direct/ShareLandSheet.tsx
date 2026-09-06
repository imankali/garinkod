// frontend/src/components/direct/ShareLandSheet.tsx
//
// «افزودن زمین» inside a desk conversation.
//
// Three states, in the order a farmer actually meets them:
//
// 1. They already have lands on file → pick one and it is shared as a real
//    dossier, no retyping.
// 2. They have none → the desk asked for a land record because the advice
//    depends on it, so the prompt offers to create one *here*, over the chat,
//    with «بله» opening the same identification form the زمین‌ها section uses
//    and «خیر» simply dismissing. Refusing to answer is allowed; being sent to
//    another page and losing the conversation is not.
// 3. A new land is saved → it is selected immediately, because the farmer came
//    here to share it and making them close the sheet and tap again is busywork.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, MapPin, Sprout } from 'lucide-react';
import toast from 'react-hot-toast';

import Modal from '../ui/Modal';
import LandFormModal from '../farm/LandFormModal';
import { farmApi } from '../../api/services';
import { cn } from '../../utils/cn';
import type { FarmLand } from '../../types';

export default function ShareLandSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (land: FarmLand) => void;
}) {
  const [lands, setLands] = useState<FarmLand[]>([]);
  const [loading, setLoading] = useState(false);
  const [askedToAdd, setAskedToAdd] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  /** Returns the fresh list, so a caller can act on it without a second request. */
  const load = useCallback(async (): Promise<FarmLand[]> => {
    setLoading(true);
    try {
      const response = await farmApi.lands();
      const rows = response.data || [];
      setLands(rows);
      return rows;
    } catch {
      setLands([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setAskedToAdd(false);
    void load();
  }, [open, load]);

  async function handleSaved() {
    const rows = await load();
    setFormOpen(false);
    // The API lists a farmer's lands newest first, so the row just created is
    // the first one — and it is the thing the farmer came here to share.
    const newest = rows[0];
    if (newest) {
      onPick(newest);
      toast.success('پرونده زمین اضافه شد و برای میز انتخاب شد.');
    }
  }

  return (
    <>
      <Modal
        open={open && !formOpen}
        onClose={onClose}
        title="افزودن زمین به گفتگو"
        description="پرونده زمین را انتخاب کنید تا کارشناس همان داده‌ای را ببیند که شما ثبت کرده‌اید."
        variant="sheet"
      >
        {loading && lands.length === 0 ? (
          <p className="py-6 text-center text-fluid-xs text-slate-500 dark:text-emerald-200">
            در حال خواندن زمین‌های شما…
          </p>
        ) : lands.length === 0 ? (
          askedToAdd ? (
            <div className="space-y-3">
              <p className="text-fluid-xs leading-6 text-slate-600 dark:text-emerald-100">
                فرم شناسایی زمین چند سؤال کوتاه دارد؛ بعد از ذخیره، همین‌جا برای مشاور ارسال می‌شود.
              </p>
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-fluid-xs font-extrabold text-white transition hover:bg-emerald-700"
              >
                <Sprout size={15} aria-hidden="true" />
                ثبت پرونده زمین
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl px-3 py-2 text-fluid-2xs font-bold text-slate-500 transition hover:bg-slate-50 dark:text-emerald-200 dark:hover:bg-emerald-900"
              >
                بعداً انجام می‌دهم
              </button>
            </div>
          ) : (
            <div className="space-y-4 py-2 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
                <Sprout size={22} aria-hidden="true" />
              </span>
              <p className="text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                برای مشاوره بهتر، پرونده زمینت را اضافه کن
              </p>
              <p className="text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-200">
                نوع زمین، مساحت، خاک و آبیاری باعث می‌شود جواب شما دقیق‌تر باشد. همین‌جا می‌توانید ثبتش کنید.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAskedToAdd(true)}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-fluid-xs font-extrabold text-white transition hover:bg-emerald-700"
                >
                  <CheckCircle2 size={15} aria-hidden="true" />
                  بله، اضافه می‌کنم
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 flex-1 rounded-xl border border-slate-200 text-fluid-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-emerald-800 dark:text-emerald-100 dark:hover:bg-emerald-900"
                >
                  خیر، فقط توضیح می‌دهم
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-3">
            <ul className="max-h-[52dvh] space-y-2 overflow-y-auto overscroll-contain px-0.5">
              {lands.map((land) => (
                <li key={land.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(land);
                      onClose();
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition',
                      'border-emerald-100 bg-white hover:border-emerald-400 hover:bg-emerald-50',
                      'dark:border-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900',
                    )}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300"
                      aria-hidden="true"
                    >
                      <Sprout size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-fluid-xs font-extrabold text-slate-800 dark:text-white">
                        {land.name}
                      </span>
                      <span className="mt-0.5 block truncate text-fluid-2xs text-slate-500 dark:text-emerald-200">
                        {land.land_type_label} · {land.area_label}
                        {land.crop_type ? ` · ${land.crop_type}` : ''}
                      </span>
                      {(land.province || land.city) && (
                        <span className="mt-1 flex items-center gap-1 text-fluid-2xs text-slate-400 dark:text-emerald-300/70">
                          <MapPin size={10} aria-hidden="true" />
                          {[land.province, land.city].filter(Boolean).join(' / ')}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-fluid-2xs font-extrabold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300">
                      ارسال پرونده
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 text-fluid-xs font-extrabold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900"
            >
              <Sprout size={15} aria-hidden="true" />
              ثبت زمین جدید و ارسال آن
            </button>
          </div>
        )}
      </Modal>

      {/* The land form opens over the sheet, keeping the chat underneath: the
          conversation never disappears while the farmer is filling a form. */}
      <LandFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => void handleSaved()} />
    </>
  );
}
