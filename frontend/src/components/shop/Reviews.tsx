// frontend/src/components/shop/Reviews.tsx
//
// The reviews section of a product page.
//
// Why it exists: the API has been serving a full review model all along — star
// scores, a per-star distribution, verified-purchase flags, replies, a helpful
// vote with a toggle, attachments — and the product page showed a single line,
// «۴٫۵ از ۵ · ۲ نظر». A buyer could not read a single review on the product they
// were about to put in a basket.
//
// Decisions:
//   • The distribution is a bar per star, because «۴٫۵» hides whether a product
//     has ninety five-star reviews or one, and the shape is the useful part.
//   • Reviews are read, not ranked by an algorithm: the server's order is kept.
//   • The helpful button is a toggle and shows the server's answer, never its
//     own optimistic count — two readers' votes must not be able to disagree.
//   • Writing is a form behind a disclosure. A review box at the top of a page is
//     a demand, and most visitors came to read a spec sheet.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Flag, Star, ThumbsUp } from 'lucide-react';
import { Link } from 'react-router';

import { commentsApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { parseApiError } from '../../api/errors';
import type { Comment } from '@/types/content';
import { date } from '../../lib/date';
import { nums } from '../../lib/price';
import { cn } from '../../lib/cn';
import Button from '../ui/Button';
import { TextArea, TextField } from '../ui/Field';
import { Skeleton } from '../ui/Skeleton';

const STARS = ['5', '4', '3', '2', '1'] as const;

function Stars({ score, size = 13 }: { score: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${score} از ۵`} dir="ltr">
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          size={size}
          aria-hidden="true"
          className={cn(
            step <= Math.round(score)
              ? 'fill-gold-600 text-gold-600'
              : 'text-line dark:text-night-line',
          )}
        />
      ))}
    </span>
  );
}

export default function Reviews({ slug, productId }: { slug: string; productId: number }) {
  const queryClient = useQueryClient();
  // Writing a review is a signed-in action on the server, so the form is only
  // offered to a visitor who is signed in. Showing it to everyone meant a guest
  // filled in a name, an opinion and a score, pressed «ثبت نظر», and got a 401
  // after the work was done.
  const signedIn = useAuthStore((state) => state.isAuthenticated);
  const [writing, setWriting] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // The list endpoint does not carry the visitor's own vote, so the answer to a
  // click is remembered here. Seeding it from the server would need a per-row
  // lookup the list query does not do; a clicked button that cannot show it was
  // clicked is worse than one that forgets after a reload.
  const [myVotes, setMyVotes] = useState<Record<number, { my_value: 1 | -1 | null; helpful_count: number }>>({});
  // Locally remembered so the button can say «گزارش شد»; the server accepts a
  // duplicate but the reader should not be able to send one.
  const [reported, setReported] = useState<Set<number>>(new Set());

  const summary = useQuery({
    queryKey: ['rating-summary', slug],
    queryFn: async () => (await commentsApi.getRatingSummary(slug)).data,
    staleTime: 5 * 60 * 1000,
  });

  const list = useQuery({
    queryKey: ['reviews', slug],
    queryFn: async () => (await commentsApi.getByProduct(slug)).data,
    staleTime: 2 * 60 * 1000,
  });

  const vote = useMutation({
    mutationFn: async ({ id }: { id: number }) =>
      (await commentsApi.toggleHelpful(id, 1)).data,
    // The server is the only place the tally is true: it recomputes from rows.
    onSuccess: (answer, { id }) => {
      setMyVotes((current) => ({
        ...current,
        [id]: { my_value: answer.my_value, helpful_count: answer.helpful_count },
      }));
    },
  });

  const report = useMutation({
    mutationFn: async (id: number) => (await commentsApi.report(id)).data,
    onSuccess: (_answer, id) => setReported((current) => new Set(current).add(id)),
  });

  const create = useMutation({
    mutationFn: async () =>
      commentsApi.create({ product: productId, name: name.trim(), body: body.trim(), rating }),
    onSuccess: () => {
      setSent(true);
      setWriting(false);
      setName('');
      setBody('');
      setRating(5);
      void queryClient.invalidateQueries({ queryKey: ['reviews', slug] });
      void queryClient.invalidateQueries({ queryKey: ['rating-summary', slug] });
    },
    onError: (caught) => setError(parseApiError(caught).message),
  });

  const reviews: Comment[] = list.data ?? [];
  const total = summary.data?.reviews_count ?? reviews.length;
  /**
   * Reviews the shop's editors marked as worth reading, across the catalogue.
   *
   * `commentsApi.getAll` was served and uncalled. A product page can only show
   * opinions about the thing on it — the buyer who is still deciding what to
   * buy had nothing. These are taken from the server with `is_featured` set, so
   * nothing here is the page's own opinion of itself; they are skipped when the
   * list is empty rather than padded.
   */
  const highlighted = useQuery({
    queryKey: ['comments-featured'],
    queryFn: async () => (await commentsApi.getAll()).data.results,
    staleTime: 10 * 60 * 1000,
  });

  const featured = useMemo(
    () =>
      (highlighted.data ?? [])
        .filter((item) => item.is_featured && item.body.trim().length > 0)
        .slice(0, 3),
    [highlighted.data],
  );

  const distribution = summary.data?.distribution;
  const highest = Math.max(1, ...Object.values(distribution ?? {}).map((count) => count));

  return (
    <section
      id="reviews"
      className="mt-10 scroll-mt-24 border-t border-line pt-6 dark:border-night-line"
      aria-labelledby="reviews-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="reviews-title" className="text-base font-extrabold text-ink dark:text-white">
          نظرات خریداران
          <span className="dateline ms-2 text-2xs font-bold text-ink-mute dark:text-white/45">
            {nums(total)} نظر
          </span>
        </h2>
        {signedIn ? (
          <Button variant="secondary" size="sm" onClick={() => setWriting((open) => !open)} aria-expanded={writing}>
            {writing ? 'بستن فرم' : 'نوشتن نظر'}
          </Button>
        ) : (
          <Link
            to="/login"
            className="inline-flex min-h-9 items-center rounded-sm border border-line px-3 text-2xs font-bold text-ink-soft transition-colors hover:border-brand-600 hover:text-brand-800 dark:border-night-line dark:text-white/60 dark:hover:text-brand-300"
          >
            برای نوشتن نظر وارد شوید
          </Link>
        )}
      </div>

      {total > 0 && summary.data && (
        <div className="mt-4 grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start">
          <div>
            <p className="dateline text-3xl font-extrabold text-ink dark:text-white">
              {summary.data.average.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}
            </p>
            <Stars score={summary.data.average} />
            <p className="mt-1 text-2xs text-ink-mute dark:text-white/45">
              از {nums(summary.data.reviews_count)} نظر
            </p>
          </div>

          <ul className="space-y-1">
            {STARS.map((star) => {
              const count = distribution?.[star] ?? 0;
              return (
                <li key={star} className="flex items-center gap-2 text-2xs">
                  <span className="dateline w-6 shrink-0 text-ink-mute dark:text-white/45">{star}</span>
                  <Star size={11} aria-hidden="true" className="shrink-0 fill-gold-600 text-gold-600" />
                  <span
                    aria-hidden="true"
                    className="h-1.5 flex-1 overflow-hidden rounded-pill bg-line dark:bg-night-line"
                  >
                    <span
                      className="block h-full rounded-pill bg-gold-600"
                      style={{ width: `${Math.round((count / highest) * 100)}%` }}
                    />
                  </span>
                  <span className="dateline w-8 shrink-0 text-end text-ink-mute dark:text-white/45">
                    {nums(count)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {featured.length > 0 && (
        <div className="mt-5 rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
          <h3 className="text-2xs font-extrabold text-ink dark:text-white">از میان نظرهای دیگر کالاها</h3>
          <ul className="mt-2 divide-y divide-line dark:divide-night-line">
            {featured.map((comment) => (
              <li key={comment.id} className="py-2">
                {comment.rating !== null && <Stars score={comment.rating} />}
                <p className="mt-1 whitespace-pre-line text-2xs leading-6 text-ink-soft dark:text-white/65">
                  {comment.body}
                </p>
                <p className="mt-1 text-[11px] text-ink-mute dark:text-white/40">
                  {comment.name}
                  {comment.is_verified_purchase && ' · خرید تأییدشده'}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {writing && (
        <form
          className="mt-5 flex flex-col gap-3 rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || !body.trim() || create.isPending) return;
            setError(null);
            create.mutate();
          }}
        >
          <p className="text-2xs text-ink-mute dark:text-white/50">
            نظر شما پس از بررسی منتشر می‌شود. اگر این کالا را خریداری کرده‌اید، نشان «خرید تأییدشده» روی
            نظرتان می‌نشیند.
          </p>
          <fieldset>
            <legend className="text-2xs font-bold text-ink dark:text-white">امتیاز</legend>
            <div className="mt-1 flex items-center gap-1" dir="ltr">
              {[1, 2, 3, 4, 5].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setRating(step)}
                  aria-label={`${step} ستاره`}
                  aria-pressed={rating === step}
                  className="flex h-9 w-9 items-center justify-center rounded-sm hover:bg-brand-50 dark:hover:bg-night"
                >
                  <Star
                    size={20}
                    aria-hidden="true"
                    className={cn(
                      step <= rating ? 'fill-gold-600 text-gold-600' : 'text-line dark:text-night-line',
                    )}
                  />
                </button>
              ))}
            </div>
          </fieldset>
          <TextField label="نام" required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          <TextArea
            label="نظر شما"
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="چه تجربه‌ای با این کالا داشتید؟ مقدار مصرف، زمان اثر، یا کیفیت بسته‌بندی."
          />
          {error && (
            <p role="alert" className="text-2xs font-bold text-danger-700">
              {error}
            </p>
          )}
          <div>
            <Button type="submit" loading={create.isPending}>
              ثبت نظر
            </Button>
          </div>
        </form>
      )}

      {sent && !writing && (
        <p className="mt-4 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-2xs font-bold text-brand-900 dark:border-brand-800 dark:bg-night dark:text-brand-100">
          نظرتان ثبت شد و پس از بررسی منتشر می‌شود.
        </p>
      )}

      {!signedIn && (
        <p className="mt-2 text-2xs text-ink-mute dark:text-white/45">
          خواندن نظرها برای همه آزاد است؛ ثبت نظر نیاز به حساب کاربری دارد.
        </p>
      )}

      {list.isLoading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="mt-4 text-2xs text-ink-mute dark:text-white/45">
          هنوز نظری برای این کالا ثبت نشده است. اولین تجربه را شما بنویسید.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line dark:divide-night-line">
          {reviews.map((review) => (
            <li key={review.id} className="py-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-extrabold text-ink dark:text-white">{review.name}</span>
                {review.is_verified_purchase && (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-800 dark:bg-night-soft dark:text-brand-300">
                    <BadgeCheck size={11} aria-hidden="true" />
                    خرید تأییدشده
                  </span>
                )}
                {review.rating != null && <Stars score={review.rating} size={12} />}
                <span className="dateline ms-auto text-[11px] text-ink-mute dark:text-white/40">
                  {date(review.created)}
                </span>
              </div>

              <p className="mt-1.5 whitespace-pre-line text-xs leading-7 text-ink-soft dark:text-white/70">
                {review.body}
              </p>

              {review.image && (
                <img
                  src={review.image}
                  alt=""
                  width={96}
                  height={96}
                  loading="lazy"
                  className="mt-2 h-24 w-24 rounded-sm object-cover"
                />
              )}

              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  disabled={vote.isPending && vote.variables?.id === review.id}
                  aria-pressed={myVotes[review.id]?.my_value === 1}
                  onClick={() => vote.mutate({ id: review.id })}
                  className={cn(
                    'inline-flex min-h-8 items-center gap-1.5 rounded-sm px-1.5 text-2xs font-bold transition-colors disabled:opacity-50',
                    myVotes[review.id]?.my_value === 1
                      ? 'bg-brand-50 text-brand-800 dark:bg-night-soft dark:text-brand-300'
                      : 'text-ink-mute hover:bg-brand-50 hover:text-brand-800 dark:text-white/50 dark:hover:bg-night-soft',
                  )}
                >
                  <ThumbsUp size={12} aria-hidden="true" />
                  مفید بود
                  {(myVotes[review.id]?.helpful_count ?? review.helpful_count ?? 0) > 0 && (
                    <span className="dateline">
                      ({nums(myVotes[review.id]?.helpful_count ?? review.helpful_count ?? 0)})
                    </span>
                  )}
                </button>

                {/* Reporting is the only recourse a reader has against a review
                    that is abusive or is really an advert. `commentsApi.report`
                    existed and nothing called it, so the button did not exist
                    either. It stays a quiet text button: the main action on a
                    review is «مفید بود», not a moderation queue. */}
                <button
                  type="button"
                  disabled={report.isPending}
                  onClick={() => report.mutate(review.id)}
                  aria-label={`گزارش دیدگاه ${review.name}`}
                  className="inline-flex min-h-8 items-center gap-1 rounded-sm px-1.5 text-[11px] font-bold text-ink-mute transition-colors hover:text-danger-700 disabled:opacity-50 dark:text-white/40"
                >
                  <Flag size={11} aria-hidden="true" />
                  {reported.has(review.id) ? 'گزارش شد' : 'گزارش'}
                </button>
              </div>

              {(review.replies ?? []).length > 0 && (
                <ul className="mt-2 space-y-2 border-s-2 border-line ps-3 dark:border-night-line">
                  {(review.replies ?? []).map((reply) => (
                    <li key={reply.id}>
                      <p className="text-2xs font-bold text-ink dark:text-white">{reply.name}</p>
                      <p className="whitespace-pre-line text-2xs leading-6 text-ink-soft dark:text-white/65">
                        {reply.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
