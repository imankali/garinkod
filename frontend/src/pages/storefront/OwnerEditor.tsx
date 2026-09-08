// frontend/src/pages/storefront/OwnerEditor.tsx — split from StorefrontPage.tsx

import {FormEvent, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {Camera, ImageIcon, Pencil, Save, X} from 'lucide-react';
import toast from 'react-hot-toast';
import {agricultureApi} from '../../api/services';
import {useTranslation} from '../../i18n';
import type { StorefrontProfile } from '@/types/storefront';

/** Inline editor for the owner: name, bio, avatar and cover. */
export function OwnerEditor({
  storefront,
  onSaved,
}: {
  storefront: StorefrontProfile['storefront'];
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(storefront.name);
  const [bio, setBio] = useState(storefront.bio);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('bio', bio.trim());
    if (avatar) formData.append('avatar', avatar);
    if (cover) formData.append('cover', cover);
    try {
      await agricultureApi.updateStorefront(formData);
      toast.success(t('storefront.updated'));
      setOpen(false);
      await onSaved();
    } catch {
      // The API client reports the failure.
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-lime-300"
      >
        <Pencil size={15} />
        {t('storefront.editStore')}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-emerald-950/40 p-3 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label={t('storefront.editStore')}
          >
            <motion.form
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onSubmit={save}
              className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl dark:border-emerald-800 dark:bg-emerald-950 sm:p-6"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">
                  {t('storefront.myStore')}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-emerald-900"
                  aria-label={t('common.close')}
                >
                  <X size={17} />
                </button>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-emerald-200">
                {t('storefront.editHint')}
              </p>

              <div className="mt-4 space-y-4">
                <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
                  {t('storefront.storeName')}
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={150}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
                  {t('storefront.storeBio')}
                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    maxLength={1000}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-sm font-bold text-slate-700 dark:text-emerald-50">
                      {t('storefront.storeAvatar')}
                    </span>
                    <button
                      type="button"
                      onClick={() => avatarInput.current?.click()}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-4 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
                    >
                      <Camera size={15} />
                      {avatar ? avatar.name.slice(0, 24) : t('storefront.storeAvatar')}
                    </button>
                    <input
                      ref={avatarInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-700 dark:text-emerald-50">
                      {t('storefront.storeCover')}
                    </span>
                    <button
                      type="button"
                      onClick={() => coverInput.current?.click()}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-4 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
                    >
                      <ImageIcon size={15} />
                      {cover ? cover.name.slice(0, 24) : t('storefront.storeCover')}
                    </button>
                    <input
                      ref={coverInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => setCover(event.target.files?.[0] ?? null)}
                    />
                  </div>
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

