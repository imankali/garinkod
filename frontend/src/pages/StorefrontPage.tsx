// frontend/src/pages/StorefrontPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  Grid3x3,
  Heart,
  ImageIcon,
  MapPin,
  ShoppingBasket,
  Star,
  UserPlus,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { storefrontsApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { formatPrice } from '../utils/formatPrice';
import type { StorefrontProfile } from '../types';

/**
 * The viewer only ever renders an image and a caption, so it takes this
 * minimal shape rather than a full StorefrontPost. That lets highlight items —
 * which are not posts — be shown through the same component without casting.
 */
interface ViewableStory {
  id: number;
  image_url: string;
  caption: string;
}

type TabKey = 'listings' | 'posts' | 'stories';

const TABS: { key: TabKey; label: string; icon: typeof Grid3x3 }[] = [
  { key: 'listings', label: 'آگهی‌ها', icon: ShoppingBasket },
  { key: 'posts', label: 'پست‌ها', icon: Grid3x3 },
  { key: 'stories', label: 'استوری‌ها', icon: ImageIcon },
];

/**
 * The public page for one storefront: avatar, name, follow button, highlights
 * and tabbed listings/posts/stories, plus an Instagram-style story viewer.
 */
export default function StorefrontPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<StorefrontProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<TabKey>('listings');
  const [followBusy, setFollowBusy] = useState(false);
  const [viewer, setViewer] = useState<{ posts: ViewableStory[]; index: number } | null>(null);

  const { isAuthenticated } = useAuthStore();
  const addListingToCart = useCartStore((state) => state.addListingToCart);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setLoadError('');
    try {
      const response = await storefrontsApi.profile(slug);
      setProfile(response.data);
    } catch (error) {
      setLoadError(parseApiError(error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!profile) return;
    if (!isAuthenticated) {
      toast.error('برای دنبال کردن غرفه ابتدا وارد حساب خود شوید.');
      return;
    }
    setFollowBusy(true);
    const wasFollowing = profile.storefront.is_following;
    try {
      const response = wasFollowing
        ? await storefrontsApi.unfollow(profile.storefront.slug)
        : await storefrontsApi.follow(profile.storefront.slug);
      setProfile({
        ...profile,
        storefront: {
          ...profile.storefront,
          is_following: response.data.is_following,
          followers_count: response.data.followers_count,
        },
        counts: { ...profile.counts, followers: response.data.followers_count },
      });
    } catch {
      // The interceptor has already explained the failure.
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center" role="status" aria-live="polite">
        <p className="text-sm font-semibold text-slate-500 dark:text-emerald-200">
          در حال بارگذاری غرفه…
        </p>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-extrabold text-slate-800 dark:text-white">غرفه پیدا نشد</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">
          {loadError || 'این غرفه در دسترس نیست.'}
        </p>
        <Link
          to="/storefronts"
          className="mt-5 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white"
        >
          مشاهده همه غرفه‌ها
        </Link>
      </div>
    );
  }

  const { storefront, listings, posts, stories, highlights, counts } = profile;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Cover */}
      <div className="relative h-36 overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-600 to-lime-500 sm:h-48">
        {storefront.cover_url && (
          <img src={storefront.cover_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      {/* Identity */}
      <header className="-mt-12 flex flex-col items-center gap-3 px-4 sm:-mt-14 sm:flex-row sm:items-end sm:gap-5">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-emerald-100 shadow-lg dark:border-emerald-950 sm:h-28 sm:w-28">
          {storefront.avatar_url ? (
            <img
              src={storefront.avatar_url}
              alt={`تصویر غرفه ${storefront.name}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-emerald-700">
              {storefront.name.slice(0, 2)}
            </div>
          )}
        </div>

        <div className="flex-1 text-center sm:pb-2 sm:text-start">
          <h1 className="flex items-center justify-center gap-1.5 text-xl font-extrabold text-slate-800 dark:text-white sm:justify-start">
            {storefront.name}
            {storefront.is_verified && (
              <BadgeCheck size={18} className="text-emerald-500" aria-label="غرفه تأییدشده" />
            )}
          </h1>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-emerald-200 sm:justify-start">
            <span>{storefront.seller_type_label}</span>
            {(storefront.province || storefront.city) && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {[storefront.province, storefront.city].filter(Boolean).join('، ')}
              </span>
            )}
            {Number(storefront.rating) > 0 && (
              <span className="flex items-center gap-1">
                <Star size={12} className="text-amber-400" />
                {storefront.rating}
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={toggleFollow}
          disabled={followBusy}
          aria-pressed={storefront.is_following}
          className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold transition disabled:opacity-60 ${
            storefront.is_following
              ? 'border border-emerald-300 bg-white text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-lime-300'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {storefront.is_following ? <Heart size={15} fill="currentColor" /> : <UserPlus size={15} />}
          {storefront.is_following ? 'دنبال می‌کنید' : 'دنبال کردن'}
        </button>
      </header>

      {/* Counters */}
      <dl className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
        {[
          { label: 'آگهی', value: counts.listings },
          { label: 'پست', value: counts.posts },
          { label: 'دنبال‌کننده', value: counts.followers },
        ].map((entry) => (
          <div key={entry.label}>
            <dt className="text-[11px] text-slate-400 dark:text-emerald-300">{entry.label}</dt>
            <dd className="text-base font-extrabold text-slate-800 dark:text-white">{entry.value}</dd>
          </div>
        ))}
      </dl>

      {storefront.bio && (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:bg-emerald-950/40 dark:text-emerald-100">
          {storefront.bio}
        </p>
      )}

      {/* Live stories + highlights */}
      {(stories.length > 0 || highlights.length > 0) && (
        <section className="mt-5" aria-label="استوری‌ها و هایلایت‌ها">
          <ul className="flex gap-4 overflow-x-auto pb-2">
            {stories.length > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => setViewer({ posts: stories, index: 0 })}
                  className="flex w-16 flex-col items-center gap-1"
                >
                  <span className="rounded-full bg-gradient-to-tr from-amber-400 to-rose-500 p-[3px]">
                    <span className="block h-14 w-14 overflow-hidden rounded-full border-2 border-white dark:border-emerald-950">
                      <img src={stories[0]?.image_url} alt="" className="h-full w-full object-cover" />
                    </span>
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-slate-600 dark:text-emerald-100">
                    استوری‌ها
                  </span>
                </button>
              </li>
            )}
            {highlights.map((highlight) => (
              <li key={highlight.id}>
                <button
                  type="button"
                  disabled={highlight.items.length === 0}
                  onClick={() =>
                    setViewer({
                      posts: highlight.items.map((item) => ({
                        id: item.post,
                        image_url: item.image_url,
                        caption: item.caption,
                      })),
                      index: 0,
                    })
                  }
                  className="flex w-16 flex-col items-center gap-1 disabled:opacity-50"
                >
                  <span className="block h-14 w-14 overflow-hidden rounded-full border-2 border-slate-200 dark:border-emerald-800">
                    <img src={highlight.cover_url} alt="" className="h-full w-full object-cover" />
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-slate-600 dark:text-emerald-100">
                    {highlight.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tabs */}
      <div role="tablist" aria-label="محتوای غرفه" className="mt-6 flex border-b border-slate-200 dark:border-emerald-900">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-3 text-sm font-bold transition ${
              tab === key
                ? 'border-emerald-600 text-emerald-700 dark:border-lime-400 dark:text-lime-300'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-emerald-200'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Listings */}
      {tab === 'listings' && (
        <div role="tabpanel" id="panel-listings" aria-labelledby="tab-listings" className="mt-5">
          {listings.length === 0 ? (
            <EmptyState text="این غرفه هنوز آگهی منتشرشده‌ای ندارد." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <li
                  key={listing.id}
                  className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40"
                >
                  <img src={listing.image_url} alt="" className="h-32 w-full object-cover" />
                  <div className="p-3">
                    <h3 className="truncate text-sm font-bold text-slate-800 dark:text-white">
                      {listing.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">
                      {formatPrice(listing.price)} / {listing.unit}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      موجودی {listing.quantity_available} {listing.unit}
                      {listing.minimum_order > 1 && ` · حداقل ${listing.minimum_order}`}
                    </p>
                    <button
                      type="button"
                      disabled={!listing.is_purchasable}
                      onClick={() => addListingToCart(listing.id).catch(() => undefined)}
                      className="mt-2 w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {listing.is_purchasable ? 'افزودن به سبد' : 'ناموجود'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Posts */}
      {tab === 'posts' && (
        <div role="tabpanel" id="panel-posts" aria-labelledby="tab-posts" className="mt-5">
          {posts.length === 0 ? (
            <EmptyState text="هنوز پستی منتشر نشده است." />
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {posts.map((post, index) => (
                <li key={post.id}>
                  <button
                    type="button"
                    onClick={() => setViewer({ posts, index })}
                    className="group relative block aspect-square w-full overflow-hidden rounded-xl"
                  >
                    <img
                      src={post.image_url}
                      alt={post.caption.slice(0, 60)}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Stories */}
      {tab === 'stories' && (
        <div role="tabpanel" id="panel-stories" aria-labelledby="tab-stories" className="mt-5">
          {stories.length === 0 ? (
            <EmptyState text="در حال حاضر استوری فعالی وجود ندارد." />
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {stories.map((story, index) => (
                <li key={story.id}>
                  <button
                    type="button"
                    onClick={() => setViewer({ posts: stories, index })}
                    className="block aspect-[9/16] w-full overflow-hidden rounded-xl"
                  >
                    <img
                      src={story.image_url}
                      alt={story.caption.slice(0, 60)}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AnimatePresence>
        {viewer && (
          <StoryViewer
            posts={viewer.posts}
            index={viewer.index}
            storefrontName={storefront.name}
            onIndexChange={(index) => setViewer({ ...viewer, index })}
            onClose={() => setViewer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-emerald-800 dark:text-emerald-300">
      {text}
    </p>
  );
}

/**
 * Full-screen story viewer.
 *
 * Keyboard support is not decoration here: the viewer traps the user in a
 * modal, so arrow keys must move between items and Escape must always get
 * them out.
 */
function StoryViewer({
  posts,
  index,
  storefrontName,
  onIndexChange,
  onClose,
}: {
  posts: ViewableStory[];
  index: number;
  storefrontName: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const current = posts[index];

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      // The layout is RTL, so ArrowLeft advances and ArrowRight goes back.
      if (event.key === 'ArrowLeft' && index < posts.length - 1) onIndexChange(index + 1);
      if (event.key === 'ArrowRight' && index > 0) onIndexChange(index - 1);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, posts.length, onIndexChange, onClose]);

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
      {/* Progress bars */}
      <div className="absolute inset-x-4 top-4 flex gap-1">
        {posts.map((post, position) => (
          <span
            key={post.id}
            className={`h-1 flex-1 rounded-full ${position <= index ? 'bg-white' : 'bg-white/30'}`}
          />
        ))}
      </div>

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
        onClick={() => onIndexChange(index - 1)}
        className="absolute inset-y-0 start-0 w-1/3 cursor-pointer disabled:cursor-default"
      />
      <button
        type="button"
        aria-label="استوری بعدی"
        onClick={() => (index < posts.length - 1 ? onIndexChange(index + 1) : onClose())}
        className="absolute inset-y-0 end-0 w-1/3 cursor-pointer"
      />
    </motion.div>
  );
}
