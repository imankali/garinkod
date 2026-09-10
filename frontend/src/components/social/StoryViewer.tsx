import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

import { useTranslation } from '../../i18n';
import type { StorefrontPost } from '@/types/storefront';

const STORY_DURATION_MS = 15_000;
const SWIPE_THRESHOLD_PX = 50;

interface StoryViewerProps {
  stories: StorefrontPost[];
  storefrontName: string;
  storefrontSlug: string;
  onSeen: (story: StorefrontPost) => void;
  onClose: () => void;
}

export default function StoryViewer({
  stories,
  storefrontName,
  storefrontSlug,
  onSeen,
  onClose,
}: StoryViewerProps) {
  const { dir } = useTranslation();
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const elapsedRef = useRef(0);
  const previousFrameRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const current = stories[index];

  const advance = useCallback(() => {
    setIndex((position) => {
      if (position < stories.length - 1) return position + 1;
      onClose();
      return position;
    });
  }, [stories.length, onClose]);

  const previous = useCallback(() => {
    setIndex((position) => Math.max(position - 1, 0));
  }, []);

  useEffect(() => {
    elapsedRef.current = 0;
    previousFrameRef.current = null;
    setProgress(0);
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
      if (event.key === 'Escape') onClose();
      if (event.code === 'Space') {
        event.preventDefault();
        setIsPaused(event.type === 'keydown');
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

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    pause();
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartXRef.current = null;
    resume();
    if (startX === null || endX === undefined) return;

    const distance = endX - startX;
    if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;
    if (distance < 0) advance();
    else previous();
  };

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
      onTouchEnd={handleTouchEnd}
      onTouchCancel={resume}
      className="fixed inset-0 z-[100] flex select-none items-center justify-center bg-black/90 p-4"
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

      <figure className="pointer-events-none relative z-10 max-h-full w-full max-w-md">
        <img
          src={current.image_url}
          alt={current.caption || 'استوری'}
          draggable={false}
          className="max-h-[75dvh] w-full rounded-2xl object-contain"
        />
        {current.caption && (
          <figcaption className="mt-3 text-center text-sm text-white/90">
            {current.caption}
          </figcaption>
        )}
        {isPaused && <span className="sr-only" aria-live="polite">پخش استوری متوقف شد</span>}
      </figure>

      <button
        type="button"
        aria-label="استوری قبلی"
        disabled={index === 0}
        onClick={previous}
        className="absolute inset-y-0 left-0 z-[5] w-1/2 cursor-pointer disabled:cursor-default"
      />
      <button
        type="button"
        aria-label="استوری بعدی"
        onClick={advance}
        className="absolute inset-y-0 right-0 z-[5] w-1/2 cursor-pointer"
      />
    </motion.div>
  );
}
