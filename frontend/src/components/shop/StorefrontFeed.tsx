// frontend/src/components/shop/StorefrontFeed.tsx
//
// A storefront's own posts and stories, on its public page.
//
// `storefrontsApi.profile()` has always returned `posts`, `stories` and
// `highlights` — the Sprout feed, the story rings, the pinned highlights — and
// the page printed only listings and two counters. A farmer photographed this
// season's fruit, the seller posted «به غرفه خوش آمدید», and none of it reached
// a buyer. The service file even documents two consumers for this data
// («پست‌های غرفه‌داران» and «کاوش») and neither page exists.
//
// Decisions:
//   • Posts first, as a vertical reading order, not a grid: a caption plus a
//     photo is meant to be read, and a grid turns text into confetti.
//   • Stories are a strip while they are alive. The server already expires them
//     and marks them seen; marking on open is one request for the batch, not one
//     per ring, because the page is still painting.
//   • Likes and comments are wired to the real endpoints, and every count shown
//     comes back from the server rather than being incremented locally — the
//     same rule the review votes follow.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Play } from 'lucide-react';

import { storefrontPostsApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import type { StorefrontPost, StorefrontPostComment } from '@/types/storefront';
import { date } from '../../lib/date';
import { nums } from '../../lib/price';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../store/authStore';
import Button from '../ui/Button';
import { TextField } from '../ui/Field';

function StoryStrip({ stories }: { stories: StorefrontPost[] }) {
  const [open, setOpen] = useState<StorefrontPost | null>(null);
  const queryClient = useQueryClient();

  // Opening the strip is what counts as watching, and one request records the
  // whole batch: a ring-by-ring fan-out would fight the page's paint.
  const markSeen = useMutation({
    mutationFn: async (ids: number[]) => storefrontPostsApi.markManySeen(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storefront'] }),
  });

  if (stories.length === 0) return null;

  return (
    <section aria-labelledby="stories-title" className="mb-6">
      <h2 id="stories-title" className="text-2xs font-extrabold text-ink-mute dark:text-white/50">
        استوری‌ها
      </h2>
      <ul className="mt-2 flex gap-3 overflow-x-auto pb-1">
        {stories.map((story) => (
          <li key={story.id} className="shrink-0">
            <button
              type="button"
              onClick={() => {
                setOpen(story);
                if (!story.is_seen) markSeen.mutate([story.id]);
              }}
              className="flex w-20 flex-col items-center gap-1.5"
              aria-label={`استوری ${date(story.created_at)}`}
            >
              <span
                className={cn(
                  'grid h-16 w-16 place-items-center overflow-hidden rounded-full p-[2px]',
                  story.is_seen ? 'bg-line dark:bg-night-line' : 'bg-brand-600',
                )}
              >
                {story.image_url ? (
                  <img
                    src={story.image_url}
                    alt=""
                    width={64}
                    height={64}
                    loading="lazy"
                    className="h-full w-full rounded-full object-cover ring-2 ring-paper dark:ring-night-soft"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center rounded-full bg-brand-50 text-brand-700 ring-2 ring-paper dark:bg-night dark:text-brand-300 dark:ring-night-soft">
                    <Play size={16} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="dateline text-[10px] text-ink-mute dark:text-white/40">
                {story.caption.slice(0, 18) || 'استوری'}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="استوری غرفه"
          onClick={() => setOpen(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-sm overflow-hidden rounded-lg bg-paper dark:bg-night-soft"
            onClick={(event) => event.stopPropagation()}
          >
            {open.image_url && (
              <img src={open.image_url} alt="" className="max-h-[60vh] w-full object-cover" />
            )}
            <div className="flex items-start justify-between gap-3 p-3">
              <p className="text-xs leading-6 text-ink dark:text-white">{open.caption}</p>
              <Button variant="quiet" size="sm" onClick={() => setOpen(null)}>
                بستن
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PostCard({ post }: { post: StorefrontPost }) {
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((state) => state.isAuthenticated);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const comments = useQuery({
    queryKey: ['post-comments', post.id],
    queryFn: async () => (await storefrontPostsApi.comments(post.id)).data,
    enabled: showComments,
  });

  const like = useMutation({
    mutationFn: async () =>
      post.is_liked ? storefrontPostsApi.unlike(post.id) : storefrontPostsApi.like(post.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storefront'] }),
  });

  const comment = useMutation({
    mutationFn: async () => storefrontPostsApi.addComment(post.id, draft.trim()),
    onSuccess: () => {
      setDraft('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['post-comments', post.id] });
      void queryClient.invalidateQueries({ queryKey: ['storefront'] });
    },
    onError: (caught) => setError(parseApiError(caught).message),
  });

  return (
    <li className="rounded-lg border border-line bg-paper dark:border-night-line dark:bg-night-soft">
      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          loading="lazy"
          className="max-h-96 w-full rounded-t-lg object-cover"
        />
      )}

      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="dateline text-[11px] text-ink-mute dark:text-white/40">
            {date(post.created_at)}
          </span>
          {post.listing && (
            <span className="rounded-sm bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-800 dark:bg-night dark:text-brand-300">
              آگهی مرتبط
            </span>
          )}
        </div>

        {post.caption && (
          <p className="mt-1.5 whitespace-pre-line text-xs leading-7 text-ink dark:text-white/85">
            {post.caption}
          </p>
        )}

        <div className="mt-3 flex items-center gap-4 border-t border-line pt-2 dark:border-night-line">
          <button
            type="button"
            onClick={() => like.mutate()}
            disabled={like.isPending}
            aria-pressed={post.is_liked}
            aria-label={post.is_liked ? 'برداشتن لایک' : 'لایک'}
            className={cn(
              'inline-flex min-h-8 items-center gap-1.5 rounded-sm px-1.5 text-2xs font-bold disabled:opacity-50',
              post.is_liked
                ? 'text-danger-700 dark:text-danger-600'
                : 'text-ink-mute hover:text-danger-700 dark:text-white/50',
            )}
          >
            <Heart size={13} aria-hidden="true" className={post.is_liked ? 'fill-current' : undefined} />
            {post.like_count > 0 && <span className="dateline">{nums(post.like_count)}</span>}
          </button>

          <button
            type="button"
            onClick={() => setShowComments((open) => !open)}
            aria-expanded={showComments}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-sm px-1.5 text-2xs font-bold text-ink-mute hover:text-brand-800 dark:text-white/50"
          >
            <MessageCircle size={13} aria-hidden="true" />
            {post.comment_count > 0 ? <span className="dateline">{nums(post.comment_count)}</span> : 'نظر'}
          </button>
        </div>

        {showComments && (
          <div className="mt-2 border-t border-line pt-2 dark:border-night-line">
            {comments.isLoading ? (
              <p className="text-2xs text-ink-mute dark:text-white/40">در حال بارگیری…</p>
            ) : (comments.data?.results ?? []).length === 0 ? (
              <p className="text-2xs text-ink-mute dark:text-white/40">هنوز نظری نیست.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(comments.data?.results ?? []).map((item: StorefrontPostComment) => (
                  <li key={item.id}>
                    <p className="text-2xs font-bold text-ink dark:text-white">{item.author_name}</p>
                    <p className="whitespace-pre-line text-2xs leading-6 text-ink-soft dark:text-white/65">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {signedIn ? (
              <form
                className="mt-2 flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draft.trim() || comment.isPending) return;
                  comment.mutate();
                }}
              >
                <div className="flex-1">
                  <TextField
                    label="نظر شما"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="یک سؤال یا تجربه بنویسید."
                  />
                </div>
                <Button type="submit" size="sm" loading={comment.isPending}>
                  ثبت
                </Button>
              </form>
            ) : (
              <p className="mt-2 text-2xs text-ink-mute dark:text-white/40">
                برای نوشتن نظر وارد حساب خود شوید.
              </p>
            )}

            {error && (
              <p role="alert" className="mt-1 text-2xs font-bold text-danger-700">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export default function StorefrontFeed({
  posts,
  stories,
}: {
  posts: StorefrontPost[];
  stories: StorefrontPost[];
}) {
  return (
    <div>
      <StoryStrip stories={stories} />

      {posts.length > 0 && (
        <section aria-labelledby="feed-title" className="mt-8 border-t border-line pt-5 dark:border-night-line">
          <h2 id="feed-title" className="text-base font-extrabold text-ink dark:text-white">
            از این غرفه
          </h2>
          <p className="mt-1 text-2xs text-ink-mute dark:text-white/45">
            آنچه فروشنده از مزرعه، محصول و کارگاه خود منتشر کرده است.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
