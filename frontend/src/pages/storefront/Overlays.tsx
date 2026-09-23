// frontend/src/pages/storefront/Overlays.tsx — split from StorefrontPage.tsx

import {useCallback, useEffect, useRef, useState} from 'react';
import {motion, useReducedMotion} from 'framer-motion';
import {X} from 'lucide-react';
import {useTranslation} from '../../i18n';

/** Instagram parity: every story lasts exactly 15 seconds site-wide —
 *  the same constant the social StoryViewer runs on. */
const STORY_DURATION_MS = 15_000;

/**
 * The viewer only ever renders an image and a caption, so it takes this
 * minimal shape rather than a full StorefrontPost. That lets highlight items —
 * which are not posts — be shown through the same component without casting.
 */
export interface ViewableStory {
  id: number;
  image_url: string;
  caption: string;
}


export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-emerald-800 dark:text-emerald-300">
      {text}
    </p>
  );
}

/**
 * Full-screen story viewer.
 *
 * Keyboard support is not decoration here: the viewer traps the user in a
 * modal, so arrow keys must move between items and Escape must always get
 * them out.
 */
export function StoryViewer({
  posts,
  index,
  storefrontName,
  onIndexChange,
  onClose,
}: {
  posts: ViewableStory[];
  index: number;
  storefrontName: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { dir } = useTranslation();
  const current = posts[index];

  // The 15-second clock, driven by rAF so the fill moves like Instagram's:
  // previous bars sit full, the active bar grows frame by frame, later bars
  // wait empty. Pauses while the pointer/touch is down and resumes on release.
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const elapsedRef = useRef(0);
  const previousFrameRef = useRef<number | null>(null);

  const advance = useCallback(() => {
    if (index < posts.length - 1) onIndexChange(index + 1);
    else onClose();
  }, [index, posts.length, onIndexChange, onClose]);

  useEffect(() => {
    elapsedRef.current = 0;
    previousFrameRef.current = null;
    setProgress(0);
  }, [current?.id]);

  useEffect(() => {
    if (!current) return undefined;
    let frameId = 0;
    const tick = (timestamp: number) => {
      if (previousFrameRef.current === null) previousFrameRef.current = timestamp;
      const delta = timestamp - previousFrameRef.current;
      previousFrameRef.current = timestamp;
      if (!isPaused) {
        elapsedRef.current = Math.min(elapsedRef.current + delta, STORY_DURATION_MS);
        const next = elapsedRef.current / STORY_DURATION_MS;
        setProgress(next);
        if (next >= 1) {
          advance();
          return;
        }
      }
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [advance, current?.id, current, isPaused]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (dir === 'rtl') {
        if (event.key === 'ArrowLeft' && index < posts.length - 1) onIndexChange(index + 1);
        if (event.key === 'ArrowRight' && index > 0) onIndexChange(index - 1);
      } else {
        if (event.key === 'ArrowRight' && index < posts.length - 1) onIndexChange(index + 1);
        if (event.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, posts.length, onIndexChange, onClose, dir]);

  if (!current) return null;
  const pause = () => setIsPaused(true);
  const resume = () => setIsPaused(false);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`استوری‌های ${storefrontName}`}
      onMouseDown={pause}
      onMouseUp={resume}
      onMouseLeave={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
      onTouchCancel={resume}
      className="fixed inset-0 z-[100] flex select-none items-center justify-center bg-black/90 p-4"
    >
      {/* Progress bars — the animated Instagram strip: done bars full,
          the active bar filling in real time, future bars empty. */}
      <div className="absolute inset-x-4 top-4 flex gap-1" role="group" aria-label="پیشرفت استوری‌ها">
        {posts.map((post, position) => {
          const width = position < index ? 100 : position === index ? progress * 100 : 0;
          return (
            <span key={post.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full rounded-full bg-white"
                style={{ width: `${width}%` }}
              />
            </span>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="بستن استوری"
        className="absolute end-4 top-8 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
      >
        <X size={20} />
      </button>

      <figure className="max-h-full w-full max-w-md">
        <img
          src={current.image_url}
          alt={current.caption || 'استوری'}
          width={400}
          height={600}
          className="max-h-[75dvh] w-full rounded-2xl object-contain"
        />
        {current.caption && (
          <figcaption className="mt-3 text-center text-sm text-white/90">{current.caption}</figcaption>
        )}
      </figure>

      {/* Tap zones: start zone goes back, end zone advances. */}
      <button
        type="button"
        aria-label="استوری قبلی"
        disabled={index === 0}
        onClick={() => onIndexChange(index - 1)}
        className="absolute inset-y-0 start-0 w-1/3 cursor-pointer disabled:cursor-default"
      />
      <button
        type="button"
        aria-label="استوری بعدی"
        onClick={() => (index < posts.length - 1 ? onIndexChange(index + 1) : onClose())}
        className="absolute inset-y-0 end-0 w-1/3 cursor-pointer"
      />
    </motion.div>
  );
}
