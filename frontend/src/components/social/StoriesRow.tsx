// frontend/src/components/social/StoriesRow.tsx
//
// The stories strip: one circular avatar per غرفه, in a horizontal row of its
// own above the posts feed.
//
// Stories used to be rendered as wide landscape cards mixed into the same
// visual language as everything else on the page, so nothing distinguished an
// ephemeral story from a permanent post. They are now a distinct section, and
// the ring carries the state: a gradient ring means unwatched, grey means
// already seen — the convention people already know from Instagram.
//
// Instagram parity in the viewer: swiping past the last story of a غرفه
// slides into the next circle in this strip (and back), instead of closing.

import { useMemo, useState } from 'react';

import { storefrontPostsApi } from '../../api/services';
import type { StorefrontPost } from '@/types/storefront';
import { cn } from '../../utils/cn';
import StoryViewer from './StoryViewer';

/** One غرفه's stories, collapsed into a single circle. */
interface StoryGroup {
  slug: string;
  name: string;
  avatarUrl: string;
  posts: StorefrontPost[];
  /** The circle is grey only when every story in the group has been watched. */
  allSeen: boolean;
}

function groupByStorefront(stories: StorefrontPost[]): StoryGroup[] {
  const groups = new Map<string, StoryGroup>();
  for (const story of stories) {
    const existing = groups.get(story.storefront_slug);
    if (existing) {
      existing.posts.push(story);
      existing.allSeen = existing.allSeen && story.is_seen;
      continue;
    }
    groups.set(story.storefront_slug, {
      slug: story.storefront_slug,
      name: story.storefront_name,
      // The circle shows the غرفه's own avatar, falling back to the story
      // image only when the غرفه has not uploaded one.
      avatarUrl: story.storefront_avatar_url || story.image_url,
      posts: [story],
      allSeen: story.is_seen,
    });
  }
  // Unwatched غرفه‌ها come first: that is the whole point of the ring.
  return [...groups.values()].sort((a, b) => Number(a.allSeen) - Number(b.allSeen));
}

export default function StoriesRow({
  stories,
  title = 'استوری غرفه‌ها',
}: {
  stories: StorefrontPost[];
  title?: string;
}) {
  // Seen state is tracked locally as well as on the server so the ring greys
  // out the moment the viewer closes, without waiting for a refetch.
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set());
  // The open viewer is identified by slug (not by group object) because the
  // groups array is rebuilt whenever a story is marked seen.
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  // Stepping BACK into a group should land on its last story, like Instagram.
  const [enteredBackwards, setEnteredBackwards] = useState(false);

  const groups = useMemo(() => {
    const withLocalSeen = stories.map((story) =>
      seenIds.has(story.id) ? { ...story, is_seen: true } : story,
    );
    return groupByStorefront(withLocalSeen);
  }, [stories, seenIds]);

  if (groups.length === 0) return null;

  const activeIndex = activeSlug === null ? -1 : groups.findIndex((g) => g.slug === activeSlug);
  const activeGroup = activeIndex >= 0 ? groups[activeIndex] : null;

  function markSeen(story: StorefrontPost) {
    if (seenIds.has(story.id)) return;
    setSeenIds((current) => new Set(current).add(story.id));
    // Fire and forget: a failed write only means the ring lights up again on
    // the next page load, which is far better than blocking the viewer.
    void storefrontPostsApi.markSeen(story.id).catch(() => undefined);
  }

  const goNextGroup = (): boolean => {
    if (activeIndex < 0 || activeIndex >= groups.length - 1) return false;
    setActiveSlug(groups[activeIndex + 1]!.slug);
    setEnteredBackwards(false);
    return true;
  };

  const goPrevGroup = (): boolean => {
    if (activeIndex <= 0) return false;
    setActiveSlug(groups[activeIndex - 1]!.slug);
    setEnteredBackwards(true);
    return true;
  };

  return (
    <>
      <section className="mt-6" aria-label={title}>
        <h2 className="mb-3 text-fluid-sm font-extrabold text-slate-800 dark:text-white">{title}</h2>
        <ul className="no-scrollbar flex gap-4 overflow-x-auto pb-1">
          {groups.map((group) => (
            <li key={group.slug}>
              <button
                type="button"
                onClick={() => {
                  setActiveSlug(group.slug);
                  setEnteredBackwards(false);
                }}
                className="flex w-[4.5rem] flex-col items-center gap-1.5"
                aria-label={`استوری‌های ${group.name}${group.allSeen ? '، دیده‌شده' : ''}`}
              >
                <span
                  className={cn(
                    'rounded-full p-[2.5px] transition',
                    group.allSeen
                      ? 'bg-slate-300 dark:bg-emerald-800'
                      : 'bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600',
                  )}
                >
                  <span className="block h-16 w-16 overflow-hidden rounded-full border-2 border-white bg-emerald-100 dark:border-emerald-950">
                    <img
                      src={group.avatarUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </span>
                </span>
                <span
                  className={cn(
                    'w-full min-w-0 truncate text-center text-fluid-2xs',
                    group.allSeen
                      ? 'text-slate-400 dark:text-emerald-400'
                      : 'font-bold text-slate-700 dark:text-emerald-100',
                  )}
                >
                  {group.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {activeGroup && (
        <StoryViewer
          // Remount on group change so the timer and index restart cleanly.
          key={activeGroup.slug}
          stories={activeGroup.posts}
          storefrontName={activeGroup.name}
          storefrontSlug={activeGroup.slug}
          initialIndex={
            enteredBackwards ? Math.max(activeGroup.posts.length - 1, 0) : 0
          }
          onSeen={markSeen}
          onClose={() => setActiveSlug(null)}
          onNextGroup={goNextGroup}
          onPrevGroup={goPrevGroup}
        />
      )}
    </>
  );
}
