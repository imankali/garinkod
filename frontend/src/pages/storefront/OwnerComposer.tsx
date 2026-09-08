// frontend/src/pages/storefront/OwnerComposer.tsx — split from StorefrontPage.tsx

import {FormEvent, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {Camera, ImageIcon, Pencil, Send, X} from 'lucide-react';
import toast from 'react-hot-toast';
import {storefrontPostsApi} from '../../api/services';
import {useTranslation} from '../../i18n';

/** Owner-only composer: publish a post or story with an image from this page. */
export function OwnerComposer({ onPublished }: { onPublished: () => void | Promise<void> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [postType, setPostType] = useState<'post' | 'story'>('post');
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [publishing, setPublishing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function choose(file: File | null) {
    setImage(file);
    setPreview(file ? URL.createObjectURL(file) : '');
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!caption.trim() || !image) return;
    setPublishing(true);
    try {
      await storefrontPostsApi.create({ post_type: postType, caption: caption.trim(), image });
      toast.success(t('storefront.postPublished'));
      setCaption('');
      setImage(null);
      setPreview('');
      setOpen(false);
      await onPublished();
    } catch {
      // The API client reports the failure.
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800 dark:text-white">
            <Camera size={15} className="text-emerald-600 dark:text-lime-300" />
            {t('storefront.newPost')} / {t('storefront.newStory')}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">{t('storefront.composerHint')}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-700"
        >
          <Pencil size={14} />
          {t('storefront.newPost')}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-emerald-950/40 p-3 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label={t('storefront.newPost')}
          >
            <motion.form
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onSubmit={publish}
              className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl dark:border-emerald-800 dark:bg-emerald-950"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">
                  {postType === 'story' ? t('storefront.newStory') : t('storefront.newPost')}
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

              <div className="mt-4 flex gap-2" role="radiogroup" aria-label={t('common.status')}>
                {(['post', 'story'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={postType === kind}
                    onClick={() => setPostType(kind)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      postType === kind
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 text-slate-600 dark:border-emerald-800 dark:text-emerald-100'
                    }`}
                  >
                    {kind === 'story' ? t('storefront.newStory') : t('storefront.newPost')}
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-sm font-bold text-slate-700 dark:text-emerald-50">
                {t('storefront.newPost')}
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
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-6 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
              >
                <ImageIcon size={16} />
                {image ? image.name : t('storefront.storeCover')}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => choose(event.target.files?.[0] ?? null)}
              />
              {preview && (
                <img
                  src={preview}
                  alt=""
                  className="mt-3 h-40 w-full rounded-xl object-cover"
                />
              )}

              <button
                type="submit"
                disabled={publishing || !image}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <Send size={15} />
                {publishing ? t('common.loading') : t('common.send')}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

