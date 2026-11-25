// frontend/src/pages/StorefrontPage.tsx

import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, MapPin, Store, UserPlus, UserMinus } from 'lucide-react';

import { storefrontsApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { useAuthStore } from '../store/authStore';
import type { MarketplaceListing, StorefrontProfile } from '@/types/storefront';
import { money, nums } from '../lib/price';
import Button from '../components/ui/Button';
import { ProseSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import StorefrontChat from '../components/shop/StorefrontChat';
import StorefrontFeed from '../components/shop/StorefrontFeed';
import { TextField } from '../components/ui/Field';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { useTitle } from '../lib/useTitle';

/**
 * One stall.
 *
 * The page leads with who the seller is (name, kind, place, verified badge),
 * then their live listings as a grid of price-per-unit rows. The one action
 * that matters on a marketplace page is «گفتگو با غرفه» — a buyer who is
 * unsure about a harvest date should not have to hunt for a contact form, so
 * it sits next to the name, not at the bottom.
 */
/**
 * «دنبال کردن» — the one social action a marketplace page cannot do without.
 *
 * The page printed «۱۴ دنبال‌کننده» with no way to become one of them, and
 * `storefrontsApi.follow`/`unfollow` had no caller at all; the count was a
 * number the reader could only watch. Both endpoints return the fresh
 * `is_following` and `followers_count`, so the button shows the server's answer
 * rather than incrementing a local counter that the next page load would
 * contradict.
 *
 * A signed-out reader gets the button too, pointing at the login page — the
 * public profile already says whether this reader follows the stall, so the
 * only thing missing was a session.
 */
function FollowButton({
  slug,
  isFollowing,
}: {
  slug: string;
  isFollowing: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const toggle = useMutation({
    mutationFn: async () =>
      (isFollowing ? await storefrontsApi.unfollow(slug) : await storefrontsApi.follow(slug)).data,
    onSuccess: (answer) => {
      setError(null);
      // Write the server's numbers straight into the cached profile. This is
      // deliberately *not* a refetch: the toggle already returns the new
      // `is_following` and `followers_count`, and an invalidate here would
      // immediately overwrite that answer with a second read of the profile.
      // It would also redraw the whole page for one counter.
      queryClient.setQueryData<StorefrontProfile>(['storefront', slug], (cached) =>
        cached
          ? {
              ...cached,
              storefront: { ...cached.storefront, is_following: answer.is_following },
              counts: { ...cached.counts, followers: answer.followers_count },
            }
          : cached,
      );
    },
    onError: (caught) => setError(parseApiError(caught).message),
  });

  if (!user) {
    return (
      <Button to="/login" variant="secondary" size="sm" icon={UserPlus}>
        دنبال کردن
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={isFollowing ? 'quiet' : 'secondary'}
        size="sm"
        icon={isFollowing ? UserMinus : UserPlus}
        loading={toggle.isPending}
        onClick={() => toggle.mutate()}
      >
        {isFollowing ? 'دنبال می‌کنید' : 'دنبال کردن'}
      </Button>
      {error && (
        <p role="alert" className="text-[11px] font-bold text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}

export default function StorefrontPage() {
  const { slug = '' } = useParams();

  // A stall with eight listings and a month of posts has no way to answer
  // «پرتقال دارید؟» other than scrolling. `searchContent` covers the three
  // things a stall publishes — listings, posts, stories — in one read.
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 350);

  const search = useQuery({
    queryKey: ['storefront-search', slug, debouncedQuery],
    queryFn: async () => (await storefrontsApi.searchContent(slug, debouncedQuery)).data,
    enabled: debouncedQuery.length >= 2,
    staleTime: 2 * 60 * 1000,
  });

  const searchRows = useMemo(() => search.data ?? null, [search.data]);
  const searching = debouncedQuery.length >= 2;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['storefront', slug],
    queryFn: async () => (await storefrontsApi.profile(slug)).data,
    staleTime: 3 * 60 * 1000,
  });

  useTitle(data?.storefront.name);

  if (isLoading) {
    return (
      <div className="shell py-8">
        <ProseSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="shell py-16">
        <EmptyState
          icon={Store}
          title="این غرفه پیدا نشد"
          description="ممکن است غرفه هنوز تأیید نشده یا آدرس آن تغییر کرده باشد."
          action={<Button to="/storefronts" variant="secondary" size="sm">همهٔ غرفه‌ها</Button>}
        />
      </div>
    );
  }

  const { storefront, listings, counts, posts, stories, highlights } = data;

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <header className="flex flex-wrap items-start gap-4 rounded-lg border border-line bg-paper p-5 dark:border-night-line dark:bg-night-soft">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-100 text-base font-extrabold text-brand-800 dark:bg-night dark:text-brand-300">
          {storefront.avatar_url ? (
            <img src={storefront.avatar_url} alt="" width={64} height={64} className="h-full w-full object-cover" />
          ) : (
            storefront.name.slice(0, 2)
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-extrabold tracking-[-0.02em] text-ink dark:text-white">
            {storefront.name}
            {storefront.is_verified && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-brand-50 px-1.5 py-0.5 text-2xs font-bold text-brand-800 dark:bg-night dark:text-brand-300">
                <BadgeCheck size={13} aria-hidden="true" /> تأییدشده
              </span>
            )}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-mute dark:text-white/50">
            <span>{storefront.seller_type_label || 'فروشنده'}</span>
            {(storefront.city || storefront.province) && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} aria-hidden="true" />
                {[storefront.province, storefront.city].filter(Boolean).join('، ')}
              </span>
            )}
            <span className="dateline">{nums(counts.listings)} آگهی فعال</span>
            <span className="dateline">{nums(counts.followers)} دنبال‌کننده</span>
          </p>
          {storefront.bio && <p className="mt-2 max-w-[65ch] text-xs leading-7 text-ink-soft dark:text-white/65">{storefront.bio}</p>}
        </div>

        <div className="flex flex-col items-end gap-2">
          <StorefrontChat slug={storefront.slug} name={storefront.name} />
          {!storefront.is_owner && (
            <FollowButton slug={storefront.slug} isFollowing={storefront.is_following} />
          )}
        </div>
      </header>

      {/*
        Highlights. The profile has always carried them — `highlights` sits in the
        same response as the posts — and the page dropped the field on the floor,
        so a seller's curated «برداشت» collection existed for nobody. Each item is
        a post that was already published; the strip opens them in the same
        viewer the story ring uses.
      */}
      {(highlights ?? []).length > 0 && (
        <section aria-labelledby="highlights-title">
          <h2 id="highlights-title" className="text-base font-extrabold text-ink dark:text-white">
            مجموعه‌ها
          </h2>
          <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {(highlights ?? []).map((highlight) => (
              <li key={highlight.id} className="w-40 shrink-0">
                <div className="overflow-hidden rounded-lg border border-line dark:border-night-line">
                  {highlight.cover_url ? (
                    <img
                      src={highlight.cover_url}
                      alt=""
                      loading="lazy"
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div className="h-24 w-full bg-brand-50 dark:bg-night-soft" />
                  )}
                  <div className="p-2">
                    <p className="truncate text-2xs font-extrabold text-ink dark:text-white">
                      {highlight.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-mute dark:text-white/45">
                      {nums(highlight.items.length)} مورد
                    </p>
                  </div>
                </div>
                {highlight.items.length > 0 && (
                  <ul className="mt-1.5 flex gap-1 overflow-x-auto">
                    {highlight.items.slice(0, 6).map((item) => (
                      <li key={item.id} className="shrink-0">
                        <Link
                          to={`/storefront/${storefront.slug}`}
                          aria-label={item.caption || highlight.title}
                          className="block h-12 w-12 overflow-hidden rounded-sm border border-line dark:border-night-line"
                        >
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="block h-full w-full bg-brand-50 dark:bg-night-soft" />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="listings-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="listings-title" className="text-base font-extrabold text-ink dark:text-white">
            محصولات این غرفه
          </h2>
          <div className="w-full sm:w-64">
            <TextField
              label="جست‌وجو در این غرفه"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="مثلاً پرتقال"
            />
          </div>
        </div>

        {searching ? (
          <div className="mt-3" aria-live="polite">
            {search.isLoading || !searchRows ? (
              <p className="text-2xs text-ink-mute dark:text-white/45">در حال جست‌وجو…</p>
            ) : (
              <>
                {searchRows.listings.length === 0 && searchRows.posts.length === 0 && searchRows.stories.length === 0 ? (
                  <p className="text-2xs text-ink-mute dark:text-white/45">
                    چیزی با «{searchRows.query}» در این غرفه پیدا نشد. می‌توانید با نام دیگری
                    امتحان کنید یا از غرفه‌دار در گفتگو بپرسید.
                  </p>
                ) : (
                  <>
                    {searchRows.listings.length > 0 && (
                      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {searchRows.listings.map((listing: MarketplaceListing) => (
                          <li key={listing.id}>
                            <Link
                              to={`/listing/${listing.slug}`}
                              className="flex h-full items-center justify-between gap-3 rounded-lg border border-line bg-paper p-3 text-2xs hover:border-brand-300 dark:border-night-line dark:bg-night-soft dark:hover:border-brand-600"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-extrabold text-ink dark:text-white">
                                  {listing.title}
                                </span>
                                <span className="mt-0.5 block text-ink-mute dark:text-white/45">
                                  {listing.crop_name || listing.category_label}
                                </span>
                              </span>
                              <span className="dateline shrink-0 font-extrabold text-brand-800 dark:text-brand-300">
                                {money(listing.discounted_price)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    {searchRows.posts.length > 0 && (
                      <p className="mt-3 text-2xs text-ink-mute dark:text-white/45">
                        {nums(searchRows.posts.length)} پست و {nums(searchRows.stories.length)} استوری هم
                        با همین واژه در فید این غرفه هست — پایین‌تر.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        ) : listings.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="این غرفه الان آگهی فعالی ندارد"
              description="غرفه‌های فصلی بین دو برداشت خالی می‌شوند. می‌توانید غرفه‌های دیگر را ببینید."
              action={<Button to="/storefronts" variant="secondary" size="sm">غرفه‌های دیگر</Button>}
            />
          </div>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing: MarketplaceListing) => (
              <li key={listing.id}>
                <Link
                  to={`/listing/${listing.slug}`}
                  className="group flex h-full gap-3 rounded-lg border border-line bg-paper p-3 transition-[border-color,box-shadow] duration-[var(--dur-state)] ease-[var(--ease-out)] hover:border-brand-300 hover:shadow-[var(--shadow-card)] dark:border-night-line dark:bg-night-soft dark:hover:border-brand-700"
                >
                  <span className="h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-brand-50 dark:bg-night">
                    {listing.image_url && (
                      <img
                        src={listing.image_url}
                        alt=""
                        width={80}
                        height={80}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-[var(--dur-image)] ease-[var(--ease-out)] group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-extrabold text-ink dark:text-white">{listing.title}</span>
                    <span className="mt-0.5 block text-2xs text-ink-mute dark:text-white/45">
                      {listing.crop_name || listing.category_label} · {listing.quantity_available} {listing.unit} موجود
                    </span>
                    <span className="dateline mt-1.5 block text-xs font-extrabold text-brand-800 dark:text-brand-300">
                      {money(listing.discounted_price)}
                      <span className="font-medium text-ink-mute dark:text-white/45"> / {listing.unit}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StorefrontFeed
        posts={(searching && searchRows ? searchRows.posts : posts) ?? []}
        stories={(searching && searchRows ? searchRows.stories : stories) ?? []}
      />
    </div>
  );
}
