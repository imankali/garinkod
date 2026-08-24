// frontend/src/components/HighlightManager.tsx

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Sparkle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { storefrontsApi } from '../api/services';
import { parseApiError } from '../api/errors';
import type { StorefrontHighlight, StorefrontPost } from '../types';

interface HighlightManagerProps {
  storefrontSlug: string;
  /** The seller's own stories, which are what a highlight is built from. */
  stories: StorefrontPost[];
}

/**
 * Create, edit and delete story highlights.
 *
 * Highlights are what let a story outlive its 24-hour window, so this is the
 * seller's only way to keep good content visible on their public page.
 */
export default function HighlightManager({ storefrontSlug, stories }: HighlightManagerProps) {
  const [highlights, setHighlights] = useState<StorefrontHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!storefrontSlug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await storefrontsApi.highlights(storefrontSlug);
      // The endpoint may be paginated or a plain list depending on the query.
      const payload = response.data;
      setHighlights(Array.isArray(payload) ? payload : payload.results);
    } catch {
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  }, [storefrontSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleStory(id: number) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function createHighlight() {
    if (title.trim().length < 2) {
      setError('عنوان هایلایت را بنویسید.');
      return;
    }
    if (selected.length === 0) {
      setError('حداقل یک استوری انتخاب کنید.');
      return;
    }
    setError('');
    setCreating(true);
    try {
      await storefrontsApi.createHighlight({ title: title.trim(), post_ids: selected });
      toast.success('هایلایت ساخته شد.');
      setTitle('');
      setSelected([]);
      await load();
    } catch (caught) {
      const parsed = parseApiError(caught);
      setError(parsed.fields.post_ids ?? parsed.fields.title ?? parsed.message);
    } finally {
      setCreating(false);
    }
  }

  async function removeHighlight(highlight: StorefrontHighlight) {
    if (!window.confirm(`هایلایت «${highlight.title}» حذف شود؟`)) return;
    try {
      await storefrontsApi.deleteHighlight(highlight.id);
      toast.success('هایلایت حذف شد.');
      await load();
    } catch {
      // Reported globally.
    }
  }

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-800 dark:text-white">
        <Sparkle size={19} className="text-violet-600" />
        هایلایت‌های غرفه
      </h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">
        استوری‌ها پس از ۲۴ ساعت پنهان می‌شوند؛ با هایلایت می‌توانید بهترین‌ها را روی صفحه غرفه نگه دارید.
      </p>

      {/* Existing highlights */}
      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" /> در حال دریافت…
        </p>
      ) : highlights.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-4">
          {highlights.map((highlight) => (
            <li key={highlight.id} className="w-20 text-center">
              <div className="relative">
                <img
                  src={highlight.cover_url}
                  alt=""
                  className="h-16 w-16 rounded-full border-2 border-violet-300 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeHighlight(highlight)}
                  aria-label={`حذف هایلایت ${highlight.title}`}
                  className="absolute -bottom-1 -end-1 rounded-full bg-white p-1 text-rose-600 shadow dark:bg-emerald-900"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <p className="mt-1 truncate text-[11px] text-slate-600 dark:text-emerald-100">{highlight.title}</p>
              <p className="text-[10px] text-slate-400">{highlight.items.length} استوری</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-emerald-900/40 dark:text-emerald-200">
          هنوز هایلایتی نساخته‌اید.
        </p>
      )}

      {/* Create */}
      <div className="mt-6 border-t border-slate-100 pt-5 dark:border-emerald-900">
        <label htmlFor="highlight-title" className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
          عنوان هایلایت جدید
        </label>
        <input
          id="highlight-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={60}
          placeholder="مثلاً: برداشت پاییز"
          className="mt-2 w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
        />

        <p className="mt-4 text-sm font-bold text-slate-700 dark:text-emerald-50">
          انتخاب استوری‌ها ({selected.length} انتخاب‌شده)
        </p>
        {stories.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">
            ابتدا یک استوری منتشر کنید تا بتوانید آن را هایلایت کنید.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {stories.map((story) => {
              const isSelected = selected.includes(story.id);
              return (
                <li key={story.id}>
                  <button
                    type="button"
                    onClick={() => toggleStory(story.id)}
                    aria-pressed={isSelected}
                    aria-label={`انتخاب استوری: ${story.caption.slice(0, 40)}`}
                    className={`block h-16 w-16 overflow-hidden rounded-xl border-2 transition ${
                      isSelected ? 'border-violet-600 ring-2 ring-violet-300' : 'border-transparent opacity-70'
                    }`}
                  >
                    <img src={story.image_url} alt="" className="h-full w-full object-cover" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p role="alert" className="mt-2 text-[11px] font-semibold text-rose-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={createHighlight}
          disabled={creating || stories.length === 0}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          ساخت هایلایت
        </button>
      </div>
    </section>
  );
}
