// frontend/src/pages/storefront/OwnerActions.tsx — split from StorefrontPage.tsx

import {FormEvent, useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {ImageIcon, Pencil, Save, Trash2, X} from 'lucide-react';
import toast from 'react-hot-toast';
import {storefrontPostsApi} from '../../api/services';
import {parseApiError} from '../../api/errors';
import {useTranslation} from '../../i18n';
import type { StorefrontPost } from '@/types/storefront';

/**
 * Edit/delete overlay on an owner's post or story tile.
 *
 * Kept off the tile's own button so the tap targets never overlap: tapping the
 * image still opens the viewer, the corner controls manage the content.
 */
export function OwnerContentActions({
  onEdit,
  onDelete,
  label,
}: {
  onEdit: () => void;
  onDelete: () => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="absolute end-1.5 top-1.5 flex gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${t('common.edit')} ${label}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
      >
        <Pencil size={13} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`حذف ${label}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-rose-200 backdrop-blur-sm transition hover:bg-rose-600 hover:text-white"
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </div>
  );
}


/** Owner edits a published post/story: caption text and optionally the image. */
export function PostEditor({
  post,
  onClose,
  onSaved,
}: {
  post: StorefrontPost | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (post) {
      setCaption(post.caption);
      setImage(null);
    }
  }, [post]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!post || !caption.trim()) return;
    setSaving(true);
    try {
      await storefrontPostsApi.update(post.id, { caption: caption.trim(), image });
      toast.success('محتوا به‌روزرسانی شد.');
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
      {post && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-emerald-950/40 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={post.post_type === 'story' ? 'ویرایش استوری' : 'ویرایش پست'}
        >
          <motion.form
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onSubmit={save}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl dark:border-emerald-800 dark:bg-emerald-950"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">
                {post.post_type === 'story' ? 'ویرایش استوری' : 'ویرایش پست'}
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

            <img src={post.image_url} alt="" className="mt-4 h-40 w-full rounded-xl object-cover" />

            <label className="mt-4 block text-sm font-bold text-slate-700 dark:text-emerald-50">
              متن
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={2200}
                rows={3}
                required
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900"
              />
            </label>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-3 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
            >
              <ImageIcon size={15} />
              {image ? image.name.slice(0, 28) : 'جایگزینی تصویر (اختیاری)'}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
            />

            <button
              type="submit"
              disabled={saving}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

