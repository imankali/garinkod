// frontend/src/pages/StorefrontExplore.tsx
//
// Explore — everything the stalls have posted, the way Instagram does it.
//
// The marketplace page shows five posts, which is a teaser, not a feed: once
// someone wants to browse, the thing they want is an endless wall of tiles and
// a way to open one without losing their place. Tiles are square and dense
// because that is how a photo grid is scanned; the post itself opens over the
// grid, so the back gesture returns to the exact same scroll position.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Compass, Heart, MessageCircle, X } from 'lucide-react';

import { storefrontPostsApi } from '../api/services';
import PostCard from '../components/social/PostCard';
import { cn } from '../utils/cn';
import type { StorefrontPost } from '@/types/storefront';

const PAGE_SIZE = 24;

export default function StorefrontExplore() {
  const reduceMotion = useReducedMotion();
  const [posts, setPosts] = useState<StorefrontPost[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openPost, setOpenPost] = useState<StorefrontPost | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (nextPage: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const response = await storefrontPostsApi.list({
        post_type: 'post',
        ordering: '-likes_total',
        page: nextPage,
        page_size: PAGE_SIZE,
      });
      setTotal(response.data.count);
      setPosts((previous) => (append ? [...previous, ...response.data.results] : response.data.results));
      setPage(nextPage);
    } catch {
      // A failed page must not clear what is already on screen — the reader
      // loses their place for a network blip they cannot see.
      if (!append) setPosts([]);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1, false);
  }, [load]);

  const hasMore = posts.length < total;

  // IntersectionObserver rather than a scroll listener: the grid is long, and
  // measuring it on every frame is exactly how these pages get janky.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && !loadingMore) {
          void load(page + 1, true);
        }
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, load]);

  return (
    <div className="mx-auto max-w-6xl px-[var(--page-gutter)] py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-fluid-xl font-extrabold text-slate-800 dark:text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 to-rose-500 text-white">
            <Compass size={18} aria-hidden="true" />
          </span>
          کاوش پست‌های غرفه‌ها
        </h1>
        <p className="text-fluid-xs font-bold text-slate-500 dark:text-emerald-200">
          {total.toLocaleString('fa-IR')} پست — پربازدیدترین‌ها در ابتدا
        </p>
      </header>

      {loading ? (
        <p role="status" className="py-16 text-center text-sm text-slate-500">
          در حال بارگذاری…
        </p>
      ) : posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400 dark:border-emerald-800">
          هنوز پستی منتشر نشده است.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:grid-cols-4">
          {posts.map((post, index) => (
            <li key={post.id}>
              <button
                type="button"
                onClick={() => setOpenPost(post)}
                className={cn(
                  'group relative block aspect-square w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-emerald-950',
                  // A slightly taller every-third tile is the only thing that
                  // keeps a dense grid from reading as a spreadsheet.
                  index % 5 === 2 && 'sm:row-span-2 sm:aspect-[1/1.4]',
                )}
                aria-label={`پست ${post.storefront_name}`}
              >
                {post.image_url ? (
                  <img
                    src={post.image_url}
                    alt={post.caption || post.storefront_name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center p-3 text-center text-xs font-bold leading-6 text-slate-600 dark:text-emerald-100">
                    {post.caption || post.storefront_name}
                  </span>
                )}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-fluid-2xs font-bold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span className="truncate">{post.storefront_name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="flex items-center gap-0.5">
                      <Heart size={11} aria-hidden="true" />
                      {post.like_count.toLocaleString('fa-IR')}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <MessageCircle size={11} aria-hidden="true" />
                      {post.comment_count.toLocaleString('fa-IR')}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div ref={sentinel} className="py-8 text-center">
          <button
            type="button"
            onClick={() => void load(page + 1, true)}
            disabled={loadingMore}
            className="min-h-11 rounded-xl border border-slate-200 px-4 text-fluid-xs font-bold text-slate-600 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-100"
          >
            {loadingMore ? 'در حال بارگذاری…' : 'پست‌های بیشتر'}
          </button>
        </div>
      )}

      <AnimatePresence>
        {openPost && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-emerald-950/60 p-3 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="پست غرفه"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpenPost(null);
            }}
          >
            <motion.div
              initial={reduceMotion ? false : { scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduceMotion ? undefined : { scale: 0.96, opacity: 0 }}
              className="w-full max-w-xl"
            >
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpenPost(null)}
                  aria-label="بستن"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white/90 text-slate-600 shadow dark:bg-emerald-900 dark:text-emerald-100"
                >
                  <X size={17} />
                </button>
              </div>
              <div className="rounded-3xl bg-white shadow-2xl dark:bg-emerald-950">
                <PostCard post={openPost} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
