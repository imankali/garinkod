// frontend/src/components/social/PostCard.tsx
//
// One post in the بازار کشاورزان feed, in the Instagram idiom people already
// know: avatar and handle in a header, the photo, then like / comment / share
// actions, the like count, the caption and the comment thread.
//
// The feed previously rendered posts as anonymous image tiles — no author, no
// way to react, no way to reply. Everything a post needs to be a social object
// rather than a thumbnail lives here.

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Heart, MessageCircle, Pencil, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { storefrontPostsApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useAuthStore } from '../../store/authStore';
import { useDirectStore } from '../../store/directStore';
import type { StorefrontPost, StorefrontPostComment } from '../../types';
import { cn } from '../../utils/cn';

/** Relative time in Persian, e.g. «۳ ساعت پیش». Older than a week: a date. */
function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'لحظاتی پیش';
  if (seconds < 3600) return `${Math.floor(seconds / 60).toLocaleString('fa-IR')} دقیقه پیش`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600).toLocaleString('fa-IR')} ساعت پیش`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400).toLocaleString('fa-IR')} روز پیش`;
  return new Date(iso).toLocaleDateString('fa-IR');
}

export default function PostCard({
  post,
  onEdit,
  onDelete,
}: {
  post: StorefrontPost;
  /** Owner affordances; omitted where the feed does not manage content. */
  onEdit?: (post: StorefrontPost) => void;
  onDelete?: (post: StorefrontPost) => void;
}) {
  const { isAuthenticated } = useAuthStore();
  const openDirect = useDirectStore((state) => state.openDirect);

  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [comments, setComments] = useState<StorefrontPostComment[] | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyTo, setReplyTo] = useState<StorefrontPostComment | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep local state in step when the parent refetches the feed.
  useEffect(() => {
    setIsLiked(post.is_liked);
    setLikeCount(post.like_count);
    setCommentCount(post.comment_count);
  }, [post.is_liked, post.like_count, post.comment_count]);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const response = await storefrontPostsApi.comments(post.id);
      setComments(response.data.results);
      setCommentCount(response.data.count);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, [post.id]);

  async function toggleLike() {
    if (!isAuthenticated) {
      toast.error('برای پسندیدن ابتدا وارد حساب خود شوید.');
      return;
    }
    // Optimistic: the heart must respond instantly, and the server's counts
    // overwrite the guess as soon as they arrive.
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((count) => count + (wasLiked ? -1 : 1));
    try {
      const response = wasLiked
        ? await storefrontPostsApi.unlike(post.id)
        : await storefrontPostsApi.like(post.id);
      setIsLiked(response.data.is_liked);
      setLikeCount(response.data.like_count);
    } catch (error) {
      setIsLiked(wasLiked);
      setLikeCount((count) => count + (wasLiked ? 1 : -1));
      toast.error(parseApiError(error).message);
    }
  }

  function openCommentsPanel() {
    setShowComments(true);
    if (comments === null) void loadComments();
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    if (!isAuthenticated) {
      toast.error('برای ثبت دیدگاه ابتدا وارد حساب خود شوید.');
      return;
    }
    setSending(true);
    try {
      await storefrontPostsApi.addComment(post.id, body, replyTo?.id);
      setDraft('');
      setReplyTo(null);
      await loadComments();
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setSending(false);
    }
  }

  async function removeComment(comment: StorefrontPostComment) {
    if (!window.confirm('این دیدگاه حذف شود؟')) return;
    try {
      await storefrontPostsApi.deleteComment(comment.id);
      await loadComments();
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  }

  /** Share/send: hand the post to the غرفه thread, or copy its link. */
  async function share() {
    const url = `${window.location.origin}/storefronts/${post.storefront_slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.storefront_name, text: post.caption, url });
        return;
      } catch {
        // The user dismissed the sheet; fall through to the copy path.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('نشانی پست کپی شد.');
    } catch {
      toast.error('کپی نشانی ممکن نشد.');
    }
  }

  const storeUrl = `/storefronts/${post.storefront_slug}`;
  const captionIsLong = post.caption.length > 140;

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
      {/* Author */}
      <header className="flex items-center gap-3 p-3">
        <Link to={storeUrl} className="shrink-0">
          <span className="block h-10 w-10 overflow-hidden rounded-full bg-emerald-100 ring-2 ring-emerald-100 dark:ring-emerald-800">
            <img
              src={post.storefront_avatar_url || post.image_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to={storeUrl}
            className="flex items-center gap-1 text-fluid-sm font-extrabold text-slate-800 hover:underline dark:text-white"
          >
            <span className="truncate">{post.storefront_name}</span>
            {post.storefront_is_verified && (
              <BadgeCheck size={14} className="shrink-0 text-emerald-500" aria-label="غرفه تأییدشده" />
            )}
          </Link>
          {/* The handle: the غرفه's unique address, the stable identifier. */}
          <p className="truncate text-fluid-2xs text-slate-400 dark:text-emerald-300">
            <bdi>@{post.storefront_slug}</bdi> · {timeAgo(post.created_at)}
          </p>
        </div>

        {post.is_owner && (onEdit || onDelete) && (
          <div className="flex shrink-0 gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(post)}
                aria-label="ویرایش پست"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 dark:hover:bg-emerald-900"
              >
                <Pencil size={15} aria-hidden="true" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(post)}
                aria-label="حذف پست"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </header>

      <img
        src={post.image_url}
        alt={post.caption.slice(0, 80)}
        loading="lazy"
        className="aspect-square w-full bg-slate-100 object-cover dark:bg-emerald-900"
      />

      {/* Actions */}
      <div className="flex items-center gap-1 px-2 pt-2">
        <button
          type="button"
          onClick={() => void toggleLike()}
          aria-pressed={isLiked}
          aria-label={isLiked ? 'برداشتن پسند' : 'پسندیدن'}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl transition',
            isLiked
              ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              : 'text-slate-600 hover:bg-slate-100 dark:text-emerald-100 dark:hover:bg-emerald-900',
          )}
        >
          <Heart size={21} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={openCommentsPanel}
          aria-label="دیدگاه‌ها"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-emerald-100 dark:hover:bg-emerald-900"
        >
          <MessageCircle size={21} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => void share()}
          aria-label="هم‌رسانی پست"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-emerald-100 dark:hover:bg-emerald-900"
        >
          <Send size={20} className="-scale-x-100" aria-hidden="true" />
        </button>

        {/* Direct message the غرفه about this post. */}
        <button
          type="button"
          onClick={() => openDirect({ storefrontSlug: post.storefront_slug })}
          className="ms-auto me-1 flex min-h-9 items-center gap-1.5 rounded-xl border border-emerald-200 px-3 text-fluid-2xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:text-lime-300 dark:hover:bg-emerald-900/50"
        >
          گفتگو با غرفه‌دار
        </button>
      </div>

      <div className="px-4 pb-3">
        {likeCount > 0 && (
          <p className="text-fluid-xs font-extrabold text-slate-800 dark:text-white">
            {likeCount.toLocaleString('fa-IR')} پسند
          </p>
        )}

        {post.caption && (
          <p className="mt-1 text-fluid-sm leading-6 text-slate-700 dark:text-emerald-50">
            <Link to={storeUrl} className="font-extrabold text-slate-900 hover:underline dark:text-white">
              {post.storefront_name}
            </Link>{' '}
            {captionIsLong && !expanded ? `${post.caption.slice(0, 140)}… ` : post.caption}
            {captionIsLong && !expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-slate-400 hover:underline"
              >
                بیشتر
              </button>
            )}
          </p>
        )}

        {commentCount > 0 && !showComments && (
          <button
            type="button"
            onClick={openCommentsPanel}
            className="mt-1.5 text-fluid-xs text-slate-400 hover:underline dark:text-emerald-300"
          >
            مشاهده {commentCount.toLocaleString('fa-IR')} دیدگاه
          </button>
        )}

        {showComments && (
          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-emerald-900">
            {loadingComments ? (
              <p className="py-3 text-center text-fluid-xs text-slate-400">در حال بارگذاری…</p>
            ) : comments && comments.length > 0 ? (
              <ul className="space-y-3">
                {comments.map((comment) => (
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    onReply={(target) => {
                      setReplyTo(target);
                      inputRef.current?.focus();
                    }}
                    onDelete={removeComment}
                  />
                ))}
              </ul>
            ) : (
              <p className="py-2 text-fluid-xs text-slate-400">
                هنوز دیدگاهی ثبت نشده؛ اولین نفر باشید.
              </p>
            )}

            <form onSubmit={submitComment} className="mt-3">
              {replyTo && (
                <p className="mb-1.5 flex items-center gap-2 text-fluid-2xs text-slate-500 dark:text-emerald-200">
                  در پاسخ به <strong>{replyTo.author_name}</strong>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="text-slate-400 underline"
                  >
                    لغو
                  </button>
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={1000}
                  placeholder="دیدگاه خود را بنویسید…"
                  aria-label="نوشتن دیدگاه"
                  className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-fluid-xs outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-40"
                  aria-label="ارسال دیدگاه"
                >
                  <Send size={16} className="-scale-x-100" aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}

/** One comment and its one level of replies. */
function CommentRow({
  comment,
  onReply,
  onDelete,
}: {
  comment: StorefrontPostComment;
  onReply: (comment: StorefrontPostComment) => void;
  onDelete: (comment: StorefrontPostComment) => void;
}) {
  return (
    <li>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 block h-7 w-7 shrink-0 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900">
          {comment.author_avatar_url ? (
            <img src={comment.author_avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-fluid-2xs font-bold text-emerald-700 dark:text-lime-300">
              {comment.author_name.charAt(0)}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-fluid-xs leading-6 text-slate-700 dark:text-emerald-50">
            <strong className="text-slate-900 dark:text-white">{comment.author_name}</strong>{' '}
            {comment.body}
          </p>
          <p className="mt-0.5 flex items-center gap-3 text-fluid-2xs text-slate-400">
            <span>{timeAgo(comment.created_at)}</span>
            <button type="button" onClick={() => onReply(comment)} className="font-bold hover:underline">
              پاسخ
            </button>
            {comment.can_moderate && (
              <button
                type="button"
                onClick={() => onDelete(comment)}
                className="font-bold text-rose-500 hover:underline"
              >
                حذف
              </button>
            )}
          </p>
        </div>
      </div>

      {comment.replies.length > 0 && (
        <ul className="mt-2 space-y-2 ps-9">
          {comment.replies.map((reply) => (
            <CommentRow key={reply.id} comment={reply} onReply={onReply} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </li>
  );
}
