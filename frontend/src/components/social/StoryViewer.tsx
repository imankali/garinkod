import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Heart, Send, X } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { messagesApi, storefrontPostsApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { toPersianDigits } from '../../utils/normalizeDigits';
import { cn } from '../../utils/cn';
import type { StorefrontPost } from '@/types/storefront';

const STORY_DURATION_MS = 15_000;
const SWIPE_THRESHOLD_PX = 50;
const SWIPE_DOWN_THRESHOLD_PX = 80;

interface StoryViewerProps {
  stories: StorefrontPost[];
  storefrontName: string;
  storefrontSlug: string;
  onSeen: (story: StorefrontPost) => void;
  onClose: () => void;
  /**
   * Instagram parity: running out of one غرفه's stories slides into the next
   * circle in the strip instead of closing. The callbacks return false at the
   * ends of the strip, where the viewer closes (next) or stays put (previous).
   */
  onNextGroup?: () => boolean;
  onPrevGroup?: () => boolean;
  /** Enter at the last story — used when stepping back into a group. */
  initialIndex?: number;
}

/**
 * The full-screen story viewer, built to Instagram's gesture contract:
 *  - tap zones + arrows: previous / next story;
 *  - horizontal swipe: previous / next story, and past the edges, the next
 *    or previous غرفه's circle;
 *  - vertical swipe DOWN: closes the viewer (in addition to the X and Esc);
 *  - heart: like / unlike (double-tap also likes), with optimistic state;
 *  - reply bar: send a private message to the غرفه without leaving the story.
 *
 * The story timer pauses while the pointer is down, while the reply input has
 * focus, and while a touch drag is in progress.
 */
export default function StoryViewer({
  stories,
  storefrontName,
  storefrontSlug,
  onSeen,
  onClose,
  onNextGroup,
  onPrevGroup,
  initialIndex = 0,
}: StoryViewerProps) {
  const { dir } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [index, setIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const elapsedRef = useRef(0);
  const previousFrameRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const current = stories[index];

  // Instagram-style social state, per story, held locally so the heart
  // responds instantly; the server call runs in the background.
  const [social, setSocial] = useState<Record<number, { liked: boolean; count: number }>>({});
  const socialFor = (story: StorefrontPost) =>
    social[story.id] ?? { liked: story.is_liked, count: story.like_count };

  const [reply, setReply] = useState('');
  const [replyState, setReplyState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const toggleLike = useCallback(
    (story: StorefrontPost) => {
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
            [story.id]: {
              liked: response.data.is_liked,
              count: response.data.like_count,
            },
          }));
        })
        // Roll back on failure — a heart that lies about the server is worse
        // than one that snaps back.
        .catch(() => {
          setSocial((state) => ({ ...state, [story.id]: now }));
        });
    },
    // socialFor reads `social`; including it keeps the optimistic base fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [social],
  );

  const advance = useCallback(() => {
    if (index < stories.length - 1) {
      setIndex((position) => position + 1);
      return;
    }
    if (onNextGroup && onNextGroup()) return;
    onClose();
  }, [index, stories.length, onNextGroup, onClose]);

  const previous = useCallback(() => {
    if (index > 0) {
      setIndex((position) => position - 1);
      return;
    }
    onPrevGroup?.();
  }, [index, onPrevGroup]);

  useEffect(() => {
    elapsedRef.current = 0;
    previousFrameRef.current = null;
    setProgress(0);
    setReply('');
    setReplyState('idle');
    if (current) onSeen(current);
    // onSeen may be recreated when the parent updates its local seen state.
    // Story identity, not callback identity, controls this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    let frameId = 0;

    const tick = (timestamp: number) => {
      if (previousFrameRef.current === null) previousFrameRef.current = timestamp;
      const delta = timestamp - previousFrameRef.current;
      previousFrameRef.current = timestamp;

      if (!isPaused) {
        elapsedRef.current = Math.min(elapsedRef.current + delta, STORY_DURATION_MS);
        const nextProgress = elapsedRef.current / STORY_DURATION_MS;
        setProgress(nextProgress);
        if (nextProgress >= 1) {
          advance();
          return;
        }
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [advance, current?.id, isPaused]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      // The reply input owns the keyboard while it has focus — otherwise
      // typing "سلام" would pause, skip and close the viewer.
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (event.key === 'Escape') (target as HTMLInputElement).blur();
        return;
      }
      if (event.key === 'Escape') onClose();
      if (event.code === 'Space') {
        event.preventDefault();
        setIsPaused(true);
      }
      if (dir === 'rtl') {
        if (event.key === 'ArrowLeft') advance();
        if (event.key === 'ArrowRight') previous();
      } else {
        if (event.key === 'ArrowRight') advance();
        if (event.key === 'ArrowLeft') previous();
      }
    };
    const resumeFromKeyboard = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsPaused(false);
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', resumeFromKeyboard);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', resumeFromKeyboard);
    };
  }, [advance, previous, onClose, dir]);

  if (!current) return null;

  const pause = () => setIsPaused(true);
  const resume = () => setIsPaused(false);
  const like = socialFor(current);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
    pause();
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    setDragOffset({ x: touch.clientX - start.x, y: touch.clientY - start.y });
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    setDragOffset(null);
    resume();
    if (!start || !touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    // The dominant axis decides: a downward drag closes (Instagram), a
    // horizontal swipe walks the stories.
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy > SWIPE_DOWN_THRESHOLD_PX) onClose();
      return;
    }
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) advance();
    else previous();
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = reply.trim();
    if (!body || replyState === 'sending') return;
    setReplyState('sending');
    try {
      const conversation = (await messagesApi.openStorefrontConversation(storefrontSlug)).data;
      await messagesApi.send(conversation.id, { body });
      setReply('');
      setReplyState('sent');
      window.setTimeout(() => setReplyState('idle'), 2500);
    } catch {
      setReplyState('error');
    }
  };

  // Drag feedback: the story follows the finger down and the backdrop fades,
  // exactly like Instagram's dismiss gesture.
  const dragY = dragOffset && Math.abs(dragOffset.y) > Math.abs(dragOffset.x) ? dragOffset.y : 0;
  const dragFade = Math.max(0.35, 1 - Math.abs(dragY) / 400);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`استوری‌های ${storefrontName}`}
      onMouseDown={pause}
      onMouseUp={resume}
      onMouseLeave={resume}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStartRef.current = null;
        setDragOffset(null);
        resume();
      }}
      onDoubleClick={() => {
        if (!like.liked && current) toggleLike(current);
      }}
      className="fixed inset-0 z-[100] flex select-none items-center justify-center p-4"
      style={{ backgroundColor: `rgba(0,0,0,${0.9 * dragFade})` }}
    >
      <div className="absolute inset-x-4 top-4 z-20 flex gap-1" aria-label="پیشرفت استوری‌ها" role="group">
        {stories.map((story, position) => {
          const width = position < index ? 100 : position === index ? progress * 100 : 0;
          return (
            <span key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full rounded-full bg-white"
                style={{ width: `${width}%` }}
              />
            </span>
          );
        })}
      </div>

      <Link
        to={`/storefronts/${storefrontSlug}`}
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
        <span className="text-fluid-xs font-bold">{storefrontName}</span>
      </Link>

      <button
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onClick={onClose}
        aria-label="بستن استوری"
        className="absolute end-4 top-8 z-30 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
      >
        <X size={20} />
      </button>

      <figure
        className="pointer-events-none relative z-10 w-full max-w-md transition-transform duration-100"
        style={dragY ? { transform: `translateY(${Math.max(dragY, 0)}px)` } : undefined}
      >
        <img
          src={current.image_url}
          alt={current.caption || 'استوری'}
          draggable={false}
          className="max-h-[70dvh] w-full rounded-2xl object-contain"
        />
        {current.caption && (
          <figcaption className="mt-3 text-center text-sm text-white/90">
            {current.caption}
          </figcaption>
        )}
        {isPaused && <span className="sr-only" aria-live="polite">پخش استوری متوقف شد</span>}
      </figure>

      {/* Instagram-style action bar: like + private reply to the غرفه. */}
      <div
        className="absolute inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-md items-center gap-2 px-4 pb-5"
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => toggleLike(current)}
          aria-pressed={like.liked}
          aria-label={like.liked ? 'برداشتن لایک' : 'لایک استوری'}
          className={cn(
            'flex h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-white backdrop-blur-sm transition hover:bg-white/25 active:scale-95',
            like.liked && 'text-rose-400',
          )}
        >
          <Heart size={20} className={like.liked ? 'fill-current' : undefined} />
          <span className="text-fluid-xs font-bold tabular-nums">
            {toPersianDigits(like.count)}
          </span>
        </button>

        {isAuthenticated ? (
          <form onSubmit={sendReply} className="flex min-w-0 flex-1 items-center gap-2">
            <label className="sr-only" htmlFor="story-reply">
              ارسال پیام به {storefrontName}
            </label>
            <input
              id="story-reply"
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
        ) : (
          <Link
            to="/login"
            onClick={onClose}
            className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/25 bg-white/10 px-4 text-fluid-xs font-bold text-white/80 transition hover:bg-white/20"
          >
            برای ارسال پیام وارد حساب شوید
          </Link>
        )}
      </div>

      {/* Tap zones, RTL-aware: in Persian Instagram the strip reads right to
          left, so the LEFT edge advances and the RIGHT edge goes back. */}
      <button
        type="button"
        aria-label={dir === 'rtl' ? 'استوری بعدی' : 'استوری قبلی'}
        onClick={dir === 'rtl' ? advance : previous}
        className="absolute inset-y-0 left-0 z-[5] w-1/3 cursor-pointer"
      />
      <button
        type="button"
        aria-label={dir === 'rtl' ? 'استوری قبلی' : 'استوری بعدی'}
        onClick={dir === 'rtl' ? previous : advance}
        className="absolute inset-y-0 right-0 z-[5] w-1/3 cursor-pointer"
      />
    </motion.div>
  );
}
