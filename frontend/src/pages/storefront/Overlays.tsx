// frontend/src/pages/storefront/Overlays.tsx — split from StorefrontPage.tsx

import {useCallback, useEffect, useRef, useState} from 'react';
import {Link} from 'react-router';
import {motion, useReducedMotion} from 'framer-motion';
import {Heart, Send, X} from 'lucide-react';
import {useTranslation} from '../../i18n';
import {messagesApi, storefrontPostsApi} from '../../api/services';
import {useAuthStore} from '../../store/authStore';
import {toPersianDigits} from '../../utils/normalizeDigits';
import {cn} from '../../utils/cn';

/** Instagram parity: every story lasts exactly 15 seconds site-wide —
 *  the same constant the social StoryViewer runs on. */
const STORY_DURATION_MS = 15_000;

/**
 * The social fields are what separates this viewer from a bare image
 * carousel: highlights carry them via their source post, live stories carry
 * them natively. Where a highlight item's source post was deleted, the
 * optional fields render a passive viewer — the same graceful degrade the
 * image-only shape used to force on everything.
 */
export interface ViewableStory {
  id: number;
  image_url: string;
  caption: string;
  storefront_slug?: string;
  storefront_name?: string;
  storefront_avatar_url?: string;
  is_liked?: boolean;
  like_count?: number;
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const current = posts[index];

  // Social state per story, optimistic like the social viewer: the heart
  // flips instantly, the server confirms in the background, failures roll
  // back. Stories without social fields (deleted highlight source) never
  // enter this map and render a passive heart with no count.
  const [social, setSocial] = useState<Record<number, { liked: boolean; count: number }>>({});
  const socialFor = (story: ViewableStory) => {
    const base = social[story.id];
    if (base) return base;
    return { liked: Boolean(story.is_liked), count: story.like_count ?? 0 };
  };
  const hasSocial = Boolean(current?.is_liked !== undefined || current?.like_count !== undefined);

  const [reply, setReply] = useState('');
  const [replyState, setReplyState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const toggleLike = (story: ViewableStory) => {
    if (!story.is_liked && story.like_count === undefined) return;
    const now = socialFor(story);
    const next = { liked: !now.liked, count: now.count + (now.liked ? -1 : 1) };
    setSocial((state) => ({ ...state, [story.id]: next }));
    const request = next.liked
      ? storefrontPostsApi.like(story.id)
      : storefrontPostsApi.unlike(story.id);
    request
      .then((response) => {
        setSocial((state) => ({
          ...state,
          [story.id]: { liked: response.data.is_liked, count: response.data.like_count },
        }));
      })
      .catch(() => {
        setSocial((state) => ({ ...state, [story.id]: now }));
      });
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    const slug = current?.storefront_slug;
    const body = reply.trim();
    if (!slug || !body || replyState === 'sending') return;
    setReplyState('sending');
    try {
      const conversation = (await messagesApi.openStorefrontConversation(slug)).data;
      await messagesApi.send(conversation.id, { body });
      setReply('');
      setReplyState('sent');
      window.setTimeout(() => setReplyState('idle'), 2500);
    } catch {
      setReplyState('error');
    }
  };

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
      onDoubleClick={() => {
        if (current && hasSocial && !socialFor(current).liked) toggleLike(current);
      }}
      className="fixed inset-0 z-[100] flex select-none items-center justify-center bg-black/90 p-4"
    >
      {/* Identity chip, Instagram parity with the social viewer: avatar +
          name link to the غرفه so a viewer can jump to the stall mid-story. */}
      {current?.storefront_slug && (
        <Link
          to={`/storefronts/${current.storefront_slug}`}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={onClose}
          className="absolute start-4 top-8 z-30 flex items-center gap-2 rounded-full bg-white/15 py-1 pe-3 ps-1 text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          <span className="block h-8 w-8 overflow-hidden rounded-full">
            <img
              src={current.storefront_avatar_url || current.image_url}
              alt=""
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          </span>
          <span className="text-fluid-xs font-bold">
            {current.storefront_name || storefrontName}
          </span>
        </Link>
      )}
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

      <figure className="pointer-events-none relative z-10 max-h-full w-full max-w-md">
        <img
          src={current.image_url}
          alt={current.caption || 'استوری'}
          draggable={false}
          className="max-h-[70dvh] w-full rounded-2xl object-contain"
        />
        {current.caption && (
          <figcaption className="mt-3 text-center text-sm text-white/90">{current.caption}</figcaption>
        )}
      </figure>

      {/* Instagram-style action bar: like + private reply — the same contract
          as the home feed's viewer, so a story behaves identically no matter
          which surface opened it. */}
      <div
        className="absolute inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-md items-center gap-2 px-4 pb-5"
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        {hasSocial ? (
          <button
            type="button"
            onClick={() => toggleLike(current)}
            aria-pressed={socialFor(current).liked}
            aria-label={socialFor(current).liked ? 'برداشتن لایک' : 'لایک استوری'}
            className={cn(
              'flex h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-white backdrop-blur-sm transition hover:bg-white/25 active:scale-95',
              socialFor(current).liked && 'text-rose-400',
            )}
          >
            <Heart size={20} className={socialFor(current).liked ? 'fill-current' : undefined} />
            <span className="text-fluid-xs font-bold tabular-nums">
              {toPersianDigits(socialFor(current).count)}
            </span>
          </button>
        ) : null}

        {current?.storefront_slug && isAuthenticated ? (
          <form onSubmit={sendReply} className="flex min-w-0 flex-1 items-center gap-2">
            <label className="sr-only" htmlFor="storefront-story-reply">
              ارسال پیام به {storefrontName}
            </label>
            <input
              id="storefront-story-reply"
              type="text"
              value={reply}
              maxLength={500}
              placeholder={
                replyState === 'sent'
                  ? 'پیام ارسال شد ✓'
                  : replyState === 'error'
                    ? 'ارسال ناموفق — دوباره تلاش کنید'
                    : `پیام بده به ${storefrontName}...`
              }
              onChange={(event) => {
                setReply(event.target.value);
                if (replyState !== 'idle') setReplyState('idle');
              }}
              onFocus={pause}
              onBlur={resume}
              className="min-h-11 min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-4 text-fluid-xs text-white placeholder:text-white/60 focus:border-white/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!reply.trim() || replyState === 'sending'}
              aria-label="ارسال پیام"
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-40',
                replyState === 'sent' && 'bg-emerald-500/80 text-white',
              )}
            >
              <Send size={18} />
            </button>
          </form>
        ) : current?.storefront_slug ? (
          <Link
            to="/login"
            onClick={onClose}
            className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/25 bg-white/10 px-4 text-fluid-xs font-bold text-white/80 transition hover:bg-white/20"
          >
            برای ارسال پیام وارد حساب شوید
          </Link>
        ) : null}
      </div>

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
