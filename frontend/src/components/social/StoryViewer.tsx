// frontend/src/components/social/StoryViewer.tsx
//
// Full-screen story viewer for one غرفه's stories, with progress bars, tap
// zones and keyboard control. Each story is reported as watched the moment it
// is displayed, which is what turns its ring grey in the strip.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

import type { StorefrontPost } from '../../types';

export default function StoryViewer({
  stories,
  storefrontName,
  storefrontSlug,
  onSeen,
  onClose,
}: {
  stories: StorefrontPost[];
  storefrontName: string;
  storefrontSlug: string;
  onSeen: (story: StorefrontPost) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const current = stories[index];

  const advance = useCallback(() => {
    setIndex((position) => {
      if (position < stories.length - 1) return position + 1;
      onClose();
      return position;
    });
  }, [stories.length, onClose]);

  // Report each story as watched as it appears, not on close: leaving halfway
  // through should still grey out the ones actually seen.
  useEffect(() => {
    if (current) onSeen(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      // The layout is RTL, so ArrowLeft advances and ArrowRight goes back.
      if (event.key === 'ArrowLeft') advance();
      if (event.key === 'ArrowRight') setIndex((position) => Math.max(position - 1, 0));
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [advance, onClose]);

  if (!current) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`استوری‌های ${storefrontName}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
    >
      <div className="absolute inset-x-4 top-4 flex gap-1">
        {stories.map((story, position) => (
          <span
            key={story.id}
            className={`h-1 flex-1 rounded-full ${position <= index ? 'bg-white' : 'bg-white/30'}`}
          />
        ))}
      </div>

      <Link
        to={`/storefronts/${storefrontSlug}`}
        onClick={onClose}
        className="absolute start-4 top-8 z-10 flex items-center gap-2 rounded-full bg-white/15 py-1 pe-3 ps-1 text-white backdrop-blur-sm transition hover:bg-white/25"
      >
        <span className="block h-8 w-8 overflow-hidden rounded-full">
          <img
            src={current.storefront_avatar_url || current.image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        </span>
        <span className="text-fluid-xs font-bold">{storefrontName}</span>
      </Link>

      <button
        type="button"
        onClick={onClose}
        aria-label="بستن استوری"
        className="absolute end-4 top-8 z-10 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
      >
        <X size={20} />
      </button>

      <figure className="max-h-full w-full max-w-md">
        <img
          src={current.image_url}
          alt={current.caption || 'استوری'}
          className="max-h-[75vh] w-full rounded-2xl object-contain"
        />
        {current.caption && (
          <figcaption className="mt-3 text-center text-sm text-white/90">{current.caption}</figcaption>
        )}
      </figure>

      {/* Tap zones: right goes back, left advances (RTL). */}
      <button
        type="button"
        aria-label="استوری قبلی"
        disabled={index === 0}
        onClick={() => setIndex((position) => Math.max(position - 1, 0))}
        className="absolute inset-y-0 start-0 w-1/3 cursor-pointer disabled:cursor-default"
      />
      <button
        type="button"
        aria-label="استوری بعدی"
        onClick={advance}
        className="absolute inset-y-0 end-0 w-1/3 cursor-pointer"
      />
    </motion.div>
  );
}
