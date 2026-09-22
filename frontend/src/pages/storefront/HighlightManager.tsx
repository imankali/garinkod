// frontend/src/pages/storefront/HighlightManager.tsx
//
// هایلایت‌های غرفه — همان دایره‌های اینستاگرامی، با ابزارهای صاحب غرفه:
//
// * هر استوری تازه (فعال) یک چیپ «افزودن به هایلایت» دارد؛ با کلیک،
//   هایلایت‌های موجود به‌صورت چندانتخابی می‌آیند و «هایلایت جدید…» هم هست.
// * استوری‌ای که ۲۴ ساعتش گذشت یا حذف شد سخت پاک نمی‌شود؛ به «آرشیو»
//   می‌رود و از همان‌جا هم قابل هایلایت‌کردن است.
// * دایره‌ی خط‌چین با «+» یک هایلایت تازه می‌سازد: اسم + کاور + انتخاب
//   استوری‌ها (فعال و آرشیو) به هر تعداد و به هر ترتیب.
// * هر هایلایت با ✏️ ویرایش می‌شود: اسم، کاور، حذف/افزودن استوری‌ها.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Pencil, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { storefrontsApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import type { StorefrontHighlight, StorefrontPost } from '@/types/storefront';

type ArchiveStory = StorefrontPost & { highlight_ids?: number[] };

export interface HighlightManagerProps {
  storefrontSlug: string;
  highlights: StorefrontHighlight[];
  /** استوری‌های زندهٔ غرفه — فقط برای صاحب غرفه پر می‌شود. */
  liveStories: StorefrontPost[];
  isOwner: boolean;
  /** بعد از هر تغییر، صفحه پروفایل را دوباره بخواند. */
  onChanged: () => void;
  /** نمایش استوری‌های یک هایلایت در نمایشگر تمام‌صفحه. */
  onOpenHighlight: (highlight: StorefrontHighlight) => void;
}

export default function HighlightManager({
  storefrontSlug,
  highlights,
  liveStories,
  isOwner,
  onChanged,
  onOpenHighlight,
}: HighlightManagerProps) {
  const [archive, setArchive] = useState<ArchiveStory[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [formState, setFormState] = useState<
    | { kind: 'closed' }
    | { kind: 'create' }
    | { kind: 'edit'; highlight: StorefrontHighlight }
  >({ kind: 'closed' });
  const [pickerStory, setPickerStory] = useState<StorefrontPost | null>(null);

  const loadArchive = useCallback(async () => {
    if (!isOwner) return;
    setArchiveBusy(true);
    try {
      const response = await storefrontsApi.storyArchive();
      setArchive(response.data);
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setArchiveBusy(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (isOwner) void loadArchive();
  }, [isOwner, loadArchive]);

  const openForm = (highlight: StorefrontHighlight | null) => {
    if (highlight) setFormState({ kind: 'edit', highlight });
    else setFormState({ kind: 'create' });
  };

  return (
    <section className="mt-5" aria-label="هایلایت‌های غرفه">
      <ul className="flex items-start gap-4 overflow-x-auto pb-2">
        {highlights.map((highlight) => (
          <li key={highlight.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => onOpenHighlight(highlight)}
              className="group flex w-16 flex-col items-center gap-1"
              aria-label={`مشاهده هایلایت ${highlight.title}`}
            >
              <span className="block h-14 w-14 overflow-hidden rounded-full border-2 border-emerald-500/70 transition group-hover:scale-105">
                <img src={highlight.cover_url} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="w-full min-w-0 truncate text-center text-fluid-2xs text-slate-600 dark:text-emerald-100">
                {highlight.title}
              </span>
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => openForm(highlight)}
                aria-label={`ویرایش هایلایت ${highlight.title}`}
                className="absolute -top-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm transition hover:bg-emerald-50 dark:bg-emerald-950 dark:text-lime-300"
              >
                <Pencil size={10} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}

        {/* استوری‌های زندهٔ خود صاحب غرفه: با چیپ «هایلایت» کنارشان */}
        {isOwner &&
          liveStories
            .filter((story) => story.status === 'published')
            .map((story) => (
              <li key={story.id} className="relative shrink-0">
                <span className="flex w-16 flex-col items-center gap-1">
                  <span className="block h-14 w-14 overflow-hidden rounded-full border-2 border-dashed border-emerald-300 dark:border-emerald-700">
                    <img src={story.image_url} alt="" className="h-full w-full object-cover" />
                  </span>
                  <span className="w-full min-w-0 truncate text-center text-fluid-2xs text-slate-400">
                    استوری فعال
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setPickerStory(story)}
                  title="افزودن این استوری به هایلایت"
                  aria-label="افزودن استوری به هایلایت"
                  className="absolute -top-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Plus size={11} aria-hidden="true" />
                </button>
              </li>
            ))}

        {isOwner && (
          <>
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => openForm(null)}
                className="flex w-16 flex-col items-center gap-1"
                aria-label="ساخت هایلایت جدید"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-emerald-500 hover:text-emerald-600 dark:border-emerald-800 dark:text-emerald-300">
                  <Plus size={20} aria-hidden="true" />
                </span>
                <span className="text-fluid-2xs text-slate-400">جدید</span>
              </button>
            </li>
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => setArchiveOpen((value) => !value)}
                className="flex w-16 flex-col items-center gap-1"
                aria-expanded={archiveOpen}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-50 text-fluid-2xs font-bold text-slate-500 transition hover:border-emerald-400 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  {archive.length > 0 ? archive.length.toLocaleString('fa-IR') : '🗂'}
                </span>
                <span className="text-fluid-2xs text-slate-400">آرشیو</span>
              </button>
            </li>
          </>
        )}
      </ul>

      {isOwner && archiveOpen && (
        <div className="mt-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-900/20">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold text-slate-700 dark:text-white">
              آرشیو استوری‌ها — منقضی‌شده یا حذف‌شده؛ از این‌جا هم قابل هایلایت‌کردن است
            </h3>
            <button
              type="button"
              onClick={() => void loadArchive()}
              className="rounded-lg px-2 py-1 text-fluid-2xs font-bold text-emerald-700 hover:bg-emerald-100 dark:text-lime-300 dark:hover:bg-emerald-900/60"
            >
              تازه‌سازی
            </button>
          </div>
          {archiveBusy ? (
            <p className="py-3 text-center text-fluid-2xs text-slate-400">در حال بارگذاری…</p>
          ) : archive.length === 0 ? (
            <p className="py-3 text-center text-fluid-2xs text-slate-400">
              آرشیو خالی است؛ استوری‌های منقضی یا حذف‌شده همین‌جا می‌آیند.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
              {archive.map((story) => (
                <li key={story.id} className="relative">
                  <img
                    src={story.image_url}
                    alt={story.caption.slice(0, 40)}
                    className="aspect-[9/16] w-full rounded-lg object-cover"
                  />
                  {(story.highlight_ids?.length ?? 0) > 0 && (
                    <span className="absolute start-1 top-1 rounded-full bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      در هایلایت
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPickerStory(story)}
                    className="mt-1 w-full rounded-lg bg-emerald-600 py-1.5 text-[10px] font-bold text-white transition hover:bg-emerald-700"
                  >
                    افزودن به هایلایت
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {formState.kind !== 'closed' && (
        <HighlightFormModal
          storefrontSlug={storefrontSlug}
          highlight={formState.kind === 'edit' ? formState.highlight : null}
          liveStories={liveStories}
          archive={archive}
          onClose={() => setFormState({ kind: 'closed' })}
          onSaved={() => {
            setFormState({ kind: 'closed' });
            onChanged();
            void loadArchive();
          }}
        />
      )}

      {pickerStory && (
        <AddToHighlightModal
          story={pickerStory}
          highlights={highlights}
          onClose={() => setPickerStory(null)}
          onSaved={() => {
            setPickerStory(null);
            onChanged();
            void loadArchive();
          }}
          onCreateNew={() => {
            setPickerStory(null);
            openForm(null);
          }}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

interface PickerStory {
  id: number;
  image_url: string;
  caption: string;
  badge?: string;
}

function StoryPickerGrid({
  label,
  stories,
  selected,
  onToggle,
}: {
  label: string;
  stories: PickerStory[];
  selected: number[];
  onToggle: (id: number) => void;
}) {
  if (stories.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-fluid-2xs font-bold text-slate-400">{label}</p>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {stories.map((story) => {
          const index = selected.indexOf(story.id);
          const order = index >= 0 ? index + 1 : null;
          return (
            <li key={story.id}>
              <button
                type="button"
                onClick={() => onToggle(story.id)}
                aria-pressed={index >= 0}
                className={`relative block w-full overflow-hidden rounded-xl border-2 transition ${
                  index >= 0
                    ? 'border-emerald-500'
                    : 'border-transparent hover:border-emerald-300'
                }`}
              >
                <img src={story.image_url} alt={story.caption.slice(0, 40)} className="aspect-[9/16] w-full object-cover" />
                {index >= 0 ? (
                  <span className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                    {order?.toLocaleString('fa-IR')}
                  </span>
                ) : (
                  <span className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white">
                    <Check size={11} aria-hidden="true" />
                  </span>
                )}
                {story.badge && (
                  <span className="absolute start-1 top-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {story.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HighlightFormModal({
  storefrontSlug,
  highlight,
  liveStories,
  archive,
  onClose,
  onSaved,
}: {
  storefrontSlug: string;
  highlight: StorefrontHighlight | null;
  liveStories: StorefrontPost[];
  archive: ArchiveStory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(highlight?.title ?? '');
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>(highlight?.cover_url ?? '');
  const [selected, setSelected] = useState<number[]>(
    highlight ? highlight.items.map((item) => item.post) : [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const motionSafe = useMemo(() => true, []);

  const highlightedEverywhere = useMemo(() => {
    // استوری‌هایی که در «این» هایلایت نیستند ولی در هایلایت دیگری‌اند،
    // تا فروشنده بداند بازنشرشان دو جا می‌افتد.
    const map = new Map<number, number>();
    archive.forEach((story) => {
      (story.highlight_ids ?? []).forEach((id) => map.set(story.id, id));
    });
    return map;
  }, [archive]);

  const toggle = (id: number) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const pickCover = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCover(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!title.trim()) {
      setError('برای هایلایت یک نام بنویسید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (highlight) {
        await storefrontsApi.updateHighlight(highlight.id, { title: title.trim(), post_ids: selected, cover });
      } else {
        await storefrontsApi.createHighlight({ title: title.trim(), post_ids: selected, cover });
      }
      toast.success(highlight ? 'هایلایت ویرایش شد.' : 'هایلایت ساخته شد.');
      onSaved();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!highlight) return;
    if (!window.confirm(`هایلایت «${highlight.title}» حذف شود؟ (استوری‌ها در آرشیو می‌مانند)`)) return;
    setBusy(true);
    try {
      await storefrontsApi.deleteHighlight(highlight.id);
      toast.success('هایلایت حذف شد.');
      onSaved();
    } catch (err) {
      setError(parseApiError(err).message);
      setBusy(false);
    }
  };

  const picker = (story: StorefrontPost): PickerStory => ({
    id: story.id,
    image_url: story.image_url,
    caption: story.caption,
  });

  const archivePicker = (story: ArchiveStory): PickerStory => ({
    id: story.id,
    image_url: story.image_url,
    caption: story.caption,
    badge: (story.highlight_ids?.length ?? 0) > 0 ? 'در هایلایت' : undefined,
  });

  return (
    <motion.div
      initial={motionSafe ? { opacity: 0 } : undefined}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={highlight ? `ویرایش هایلایت ${highlight.title}` : 'ساخت هایلایت جدید'}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl sm:rounded-3xl dark:bg-emerald-950">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">
            {highlight ? 'ویرایش هایلایت' : 'هایلایت جدید'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-emerald-900"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-slate-300 dark:border-emerald-800"
            aria-label="انتخاب کاور هایلایت"
          >
            {coverPreview ? (
              <img src={coverPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-slate-400">
                <Plus size={18} aria-hidden="true" />
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickCover} />
          <label className="flex-1 text-xs font-bold text-slate-600 dark:text-emerald-100">
            نام هایلایت
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="مثلاً: رضایت مشتری"
              maxLength={60}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
            />
          </label>
        </div>
        <p className="mt-1 text-fluid-2xs text-slate-400">
          کاور: عکس انتخاب کنید؛ اگر نه، تصویر اولین استوری خودکار می‌شود.
        </p>

        <StoryPickerGrid label="استوری‌های فعال (۲۴ ساعت گذشته)" stories={liveStories.filter((s) => s.status === 'published').map(picker)} selected={selected} onToggle={toggle} />
        <StoryPickerGrid label="آرشیو (منقضی یا حذف‌شده)" stories={archive.map(archivePicker)} selected={selected} onToggle={toggle} />

        {(liveStories.length === 0 && archive.length === 0) && (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-fluid-2xs text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">
            هنوز استوری‌ای ندارید؛ اول با دکمه «استوری» یک استوری منتشر کنید، بعد به هایلایت اضافه‌اش کنید.
          </p>
        )}
        <p className="mt-2 text-fluid-2xs text-slate-400">
          ترتیب انتخاب، ترتیب نمایش داخل هایلایت است ({selected.length.toLocaleString('fa-IR')} استوری انتخاب شده)
          {highlightedEverywhere.size > 0 ? ' · برخی از آرشیو در هایلایت دیگری هم هستند' : ''}.
        </p>

        {error && (
          <p role="alert" className="mt-2 rounded-xl bg-rose-50 p-2 text-fluid-2xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? 'در حال ذخیره…' : highlight ? 'ذخیره تغییرات' : 'ساخت هایلایت'}
          </button>
          {highlight && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="rounded-xl border border-rose-200 px-3 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              حذف هایلایت
            </button>
          )}
        </div>
        <span className="sr-only">{storefrontSlug}</span>
      </div>
    </motion.div>
  );
}

function AddToHighlightModal({
  story,
  highlights,
  onClose,
  onSaved,
  onCreateNew,
}: {
  story: StorefrontPost;
  highlights: StorefrontHighlight[];
  onClose: () => void;
  onSaved: () => void;
  onCreateNew: () => void;
}) {
  const current = useMemo(
    () => new Set(highlights.filter((h) => h.items.some((item) => item.post === story.id)).map((h) => h.id)),
    [highlights, story.id],
  );
  const [selected, setSelected] = useState<Set<number>>(() => new Set(current));
  const [busy, setBusy] = useState(false);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setBusy(true);
    try {
      const additions = [...selected].filter((id) => !current.has(id));
      const removals = [...current].filter((id) => !selected.has(id));
      for (const id of additions) {
        const target = highlights.find((h) => h.id === id);
        if (!target) continue;
        await storefrontsApi.updateHighlight(id, {
          post_ids: [...target.items.map((item) => item.post), story.id],
        });
      }
      for (const id of removals) {
        const target = highlights.find((h) => h.id === id);
        if (!target) continue;
        await storefrontsApi.updateHighlight(id, {
          post_ids: target.items.map((item) => item.post).filter((pid) => pid !== story.id),
        });
      }
      toast.success('هایلایت‌های این استوری به‌روز شد.');
      onSaved();
    } catch (error) {
      toast.error(parseApiError(error).message);
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="افزودن استوری به هایلایت"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-t-3xl bg-white p-4 shadow-xl sm:rounded-3xl dark:bg-emerald-950">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">افزودن به هایلایت</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-emerald-900"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {highlights.length === 0 ? (
          <p className="mt-3 text-fluid-xs text-slate-500 dark:text-emerald-200">
            هنوز هایلایتی ندارید؛ اول یک هایلایت بسازید.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {highlights.map((highlight) => {
              const checked = selected.has(highlight.id);
              return (
                <li key={highlight.id}>
                  <button
                    type="button"
                    onClick={() => toggle(highlight.id)}
                    aria-pressed={checked}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-2 text-start transition hover:border-emerald-300 dark:border-emerald-900"
                  >
                    <img src={highlight.cover_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    <span className="flex-1 truncate text-xs font-bold text-slate-700 dark:text-emerald-50">
                      {highlight.title}
                    </span>
                    {checked && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Check size={12} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy || highlights.length === 0}
            onClick={() => void save()}
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? 'در حال ذخیره…' : 'ذخیره'}
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className="rounded-xl border border-emerald-300 px-3 py-2.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
          >
            هایلایت جدید…
          </button>
        </div>
      </div>
    </motion.div>
  );
}
