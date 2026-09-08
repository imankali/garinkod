import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { BadgeCheck, MapPin, Star, Store, Users } from 'lucide-react';

import { storefrontPostsApi } from '../api/services';
import type { Storefront, StorefrontPost } from '@/types/storefront';
import { cn } from '../utils/cn';
import StoryViewer from './social/StoryViewer';

export default function StorefrontCard({ storefront }: { storefront: Storefront }) {
  const [stories, setStories] = useState<StorefrontPost[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [loadingStories, setLoadingStories] = useState(false);
  const [allSeen, setAllSeen] = useState(
    storefront.has_active_stories && !storefront.has_unseen_stories,
  );

  async function openStories(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!storefront.has_active_stories || loadingStories) return;

    setLoadingStories(true);
    try {
      const response = await storefrontPostsApi.list({
        post_type: 'story',
        storefront: storefront.slug,
      });
      if (response.data.results.length > 0) {
        setStories(response.data.results);
        setViewerOpen(true);
      }
    } finally {
      setLoadingStories(false);
    }
  }

  function markSeen(story: StorefrontPost) {
    setStories((current) => {
      const updated = current.map((item) =>
        item.id === story.id ? { ...item, is_seen: true } : item,
      );
      setAllSeen(updated.every((item) => item.is_seen));
      return updated;
    });
    if (!story.is_seen) {
      void storefrontPostsApi.markSeen(story.id).catch(() => undefined);
    }
  }

  return (
    <>
      <article className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openStories}
            disabled={!storefront.has_active_stories || loadingStories}
            aria-label={
              storefront.has_active_stories
                ? `مشاهده استوری‌های ${storefront.name}`
                : `${storefront.name} استوری فعال ندارد`
            }
            className={cn(
              'shrink-0 rounded-full p-[3px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 disabled:cursor-default',
              storefront.has_active_stories && !allSeen &&
                'bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600',
              storefront.has_active_stories && allSeen && 'bg-slate-300 dark:bg-emerald-700',
              !storefront.has_active_stories && 'bg-transparent p-0',
            )}
          >
            <span
              className={cn(
                'block h-14 w-14 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900',
                storefront.has_active_stories && 'border-2 border-white dark:border-emerald-950',
                loadingStories && 'animate-pulse',
              )}
            >
              {storefront.avatar_url ? (
                <img
                  src={storefront.avatar_url}
                  alt=""
                  width={56}
                  height={56}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-extrabold text-emerald-700 dark:text-lime-300">
                  {storefront.name.slice(0, 2)}
                </span>
              )}
            </span>
          </button>

          <Link
            to={`/storefronts/${storefront.slug}`}
            className="min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
            aria-label={`رفتن به غرفه ${storefront.name}`}
          >
            <h3 className="flex min-w-0 items-center gap-1 text-sm font-extrabold text-slate-800 dark:text-white">
              <span className="truncate">{storefront.name}</span>
              {storefront.is_verified && (
                <BadgeCheck size={14} className="shrink-0 text-emerald-500" />
              )}
            </h3>
            <p className="mt-0.5 truncate text-fluid-xs text-slate-500 dark:text-emerald-200">
              {storefront.seller_type_label}
              {storefront.city && (
                <>
                  {' · '}
                  <MapPin size={10} className="inline" /> {storefront.city}
                </>
              )}
            </p>
          </Link>
        </div>

        <Link
          to={`/storefronts/${storefront.slug}`}
          className="mt-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
          aria-label={`جزئیات غرفه ${storefront.name}`}
        >
          <dl className="flex flex-wrap items-center gap-3 text-fluid-xs text-slate-500 dark:text-emerald-200">
            <div className="flex items-center gap-1">
              <Store size={12} />
              <dt className="sr-only">تعداد آگهی</dt>
              <dd>{storefront.listing_count} آگهی</dd>
            </div>
            <div className="flex items-center gap-1">
              <Users size={12} />
              <dt className="sr-only">دنبال‌کننده</dt>
              <dd>{storefront.followers_count}</dd>
            </div>
            {Number(storefront.rating) > 0 && (
              <div className="flex items-center gap-1">
                <Star size={12} className="text-amber-400" />
                <dt className="sr-only">امتیاز</dt>
                <dd>{storefront.rating}</dd>
              </div>
            )}
          </dl>
        </Link>
      </article>

      {viewerOpen && stories.length > 0 && (
        <StoryViewer
          stories={stories}
          storefrontName={storefront.name}
          storefrontSlug={storefront.slug}
          onSeen={markSeen}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
