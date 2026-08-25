// frontend/src/pages/StorefrontPage.tsx

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  Camera,
  Grid3x3,
  Heart,
  ImageIcon,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  ShoppingBasket,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { agricultureApi, messagesApi, storefrontPostsApi, storefrontsApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useDirectStore } from '../store/directStore';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useTranslation } from '../i18n';
import { formatPrice } from '../utils/formatPrice';
import { cn } from '../utils/cn';
import ListingComposer from '../components/storefront/ListingComposer';
import type { MarketplaceListing, StorefrontPost, StorefrontProfile } from '../types';

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

type TabKey = 'listings' | 'posts' | 'stories' | 'messages';

const TABS: { key: TabKey; labelKey: string; icon: typeof Grid3x3 }[] = [
  { key: 'listings', labelKey: 'storefront.tab.listings', icon: ShoppingBasket },
  { key: 'posts', labelKey: 'storefront.tab.posts', icon: Grid3x3 },
  { key: 'stories', labelKey: 'storefront.tab.stories', icon: ImageIcon },
];

/**
 * The public page for one storefront: avatar, name, follow button, highlights
 * and tabbed listings/posts/stories, plus an Instagram-style story viewer.
 *
 * For the owner the same page doubles as the management surface: name, bio,
 * avatar and cover are editable inline, posts/stories can be published from a
 * composer, and the direct-message inbox lives on the same page. Buyers get a
 * "گفتگو با غرفه‌دار" button and can send any listing straight to the direct
 * messages to ask for advice.
 */
export default function StorefrontPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<StorefrontProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<TabKey>('listings');
  const [followBusy, setFollowBusy] = useState(false);
  const [viewer, setViewer] = useState<{ posts: ViewableStory[]; index: number } | null>(null);
  const [unread, setUnread] = useState(0);
  // Owner CRUD: which آگهی the composer is editing (null = creating a new one).
  const [listingEditor, setListingEditor] = useState<
    { open: false } | { open: true; listing: MarketplaceListing | null }
  >({ open: false });
  // Which post/story the owner is editing the caption of.
  const [postEditor, setPostEditor] = useState<StorefrontPost | null>(null);

  // جستجو داخل محتوای غرفه (پست‌ها و استوری‌ها)
  const [contentQuery, setContentQuery] = useState('');
  const debouncedContentQuery = useDebouncedValue(contentQuery, 350);
  const [contentResults, setContentResults] = useState<StorefrontPost[] | null>(null);
  const [contentBusy, setContentBusy] = useState(false);

  const { isAuthenticated } = useAuthStore();
  const addListingToCart = useCartStore((state) => state.addListingToCart);
  const openDirect = useDirectStore((state) => state.openDirect);

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

  // Owners see a live unread badge for the storefront inbox.
  // Live content search inside this storefront.
  useEffect(() => {
    const query = debouncedContentQuery.trim();
    if (!query) {
      setContentResults(null);
      return undefined;
    }
    let cancelled = false;
    setContentBusy(true);
    storefrontsApi
      .searchContent(slug, query)
      .then((response) => {
        if (cancelled) return;
        setContentResults([...response.data.posts, ...response.data.stories]);
      })
      .catch(() => {
        if (!cancelled) setContentResults([]);
      })
      .finally(() => {
        if (!cancelled) setContentBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedContentQuery, slug]);

  useEffect(() => {
    if (!profile?.storefront.is_owner) return;
    let cancelled = false;
    const refresh = () =>
      messagesApi
        .conversations()
        .then((response) => {
          if (!cancelled) setUnread(response.data.unread_total || 0);
        })
        .catch(() => undefined);
    void refresh();
    const interval = setInterval(() => void refresh(), 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [profile?.storefront.is_owner]);

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

  function sendListingToDirect(listing: StorefrontProfile['listings'][number]) {
    openDirect({
      storefrontSlug: listing.storefront.slug,
      listing: {
        id: listing.id,
        title: listing.title,
        slug: listing.slug,
        price: listing.price,
        discounted_price: listing.discounted_price,
        unit: listing.unit,
        image_url: listing.image_url,
        storefront_name: listing.storefront.name,
        storefront_slug: listing.storefront.slug,
      },
    });
  }

  /**
   * Delete a post or story.
   *
   * Publishing was one-way before: a mistaken caption or an out-of-date story
   * stayed on the غرفه forever. The confirm is deliberate — deletion is not
   * reversible and the content may be linked from elsewhere.
   */
  async function deletePost(post: StorefrontPost) {
    const kind = post.post_type === 'story' ? 'استوری' : 'پست';
    if (!window.confirm(`این ${kind} برای همیشه حذف شود؟`)) return;
    try {
      await storefrontPostsApi.remove(post.id);
      toast.success(`${kind} حذف شد.`);
      await load();
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  }

  async function deleteListing(listing: MarketplaceListing) {
    if (!window.confirm(`آگهی «${listing.title}» حذف شود؟`)) return;
    try {
      await agricultureApi.deleteListing(listing.slug);
      toast.success('آگهی حذف شد.');
      await load();
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-[var(--page-gutter)] py-16 text-center" role="status" aria-live="polite">
        <p className="text-sm font-semibold text-slate-500 dark:text-emerald-200">
          در حال بارگذاری غرفه…
        </p>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-[var(--page-gutter)] py-16 text-center">
        <h1 className="text-xl font-extrabold text-slate-800 dark:text-white">غرفه پیدا نشد</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-emerald-200">
          {loadError || 'این غرفه در دسترس نیست.'}
        </p>
        <Link
          to="/storefronts"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white"
        >
          مشاهده همه غرفه‌ها
        </Link>
      </div>
    );
  }

  const { storefront, listings, posts, stories, highlights, counts } = profile;
  const isOwner = storefront.is_owner;

  return (
    <div className="mx-auto max-w-5xl px-[var(--page-gutter)] py-6">
      {/* Cover */}
      <div className="relative h-36 overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-600 to-lime-500 sm:h-48">
        {storefront.cover_url && (
          <img src={storefront.cover_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      {/*
        Identity. `relative z-10` is load-bearing: the header is pulled up over
        the cover with a negative margin, and without its own stacking context
        the cover (which paints later in DOM order within the same layer) drew
        on top of the avatar and clipped it.
      */}
      <header className="relative z-10 -mt-12 flex flex-col items-center gap-3 px-4 sm:-mt-14 sm:flex-row sm:items-end sm:gap-5">
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

        <div className="flex flex-wrap items-center justify-center gap-2">
          {isOwner ? (
            <>
              <button
                type="button"
                onClick={() => openDirect()}
                className="relative flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-lime-300"
              >
                <MessageCircle size={15} />
                {t('direct.title')}
                {unread > 0 && (
                  <span className="absolute -top-2 -end-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-fluid-2xs font-bold text-white">
                    {unread.toLocaleString('fa-IR')}
                  </span>
                )}
              </button>
              <OwnerEditor storefront={storefront} onSaved={load} />
            </>
          ) : (
            <>
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
                {storefront.is_following ? t('storefront.unfollow') : t('storefront.follow')}
              </button>
              <button
                type="button"
                onClick={() => openDirect({ storefrontSlug: storefront.slug })}
                className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700"
              >
                <MessageCircle size={15} />
                {t('storefront.message')}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Counters */}
      <dl className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
        {[
          { label: t('storefronts.listings'), value: counts.listings },
          { label: t('storefront.tab.posts'), value: counts.posts },
          { label: t('storefronts.followers'), value: counts.followers },
        ].map((entry) => (
          <div key={entry.label}>
            <dt className="text-fluid-xs text-slate-400 dark:text-emerald-300">{entry.label}</dt>
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
                  <span className="w-full truncate text-center text-fluid-2xs text-slate-600 dark:text-emerald-100">
                    {t('storefront.tab.stories')}
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
                  <span className="w-full truncate text-center text-fluid-2xs text-slate-600 dark:text-emerald-100">
                    {highlight.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* جستجو داخل محتوای غرفه: پست، استوری، فیلم و مقاله */}
      <section className="mt-5" aria-label="جستجو در محتوای غرفه">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={contentQuery}
            onChange={(event) => setContentQuery(event.target.value)}
            placeholder="جستجو در پست‌ها و استوری‌های این غرفه… (مثلاً اصلاح درخت)"
            className="w-full rounded-2xl border border-emerald-100 bg-white py-3 ps-10 pe-4 text-sm text-slate-700 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
            aria-label="جستجو در محتوای غرفه"
          />
          {contentQuery && (
            <button
              type="button"
              onClick={() => setContentQuery('')}
              className="absolute end-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-emerald-900"
              aria-label={t('common.close')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {contentResults !== null && (
          <div className="mt-3">
            <p className="mb-2 text-fluid-xs font-bold text-slate-500 dark:text-emerald-200">
              {contentBusy
                ? t('common.loading')
                : contentResults.length > 0
                  ? `${contentResults.length} نتیجه برای «${debouncedContentQuery.trim()}»`
                  : 'نتیجه‌ای پیدا نشد؛ عبارت دیگری را امتحان کنید.'}
            </p>
            {!contentBusy && contentResults.length > 0 && (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {contentResults.map((post, index) => (
                  <li key={post.id}>
                    <button
                      type="button"
                      onClick={() => setViewer({ posts: contentResults, index })}
                      className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl"
                    >
                      <img
                        src={post.image_url}
                        alt={post.caption.slice(0, 60)}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                      <span
                        className={`absolute start-2 top-2 rounded-full px-2 py-0.5 text-fluid-2xs font-bold text-white ${
                          post.post_type === 'story' ? 'bg-rose-500/90' : 'bg-emerald-600/90'
                        }`}
                      >
                        {post.post_type === 'story' ? t('storefront.tab.stories') : t('storefront.tab.posts')}
                      </span>
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-start text-fluid-2xs font-bold text-white line-clamp-1">
                        {post.caption}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Owner composer: publish a post or story from this page */}
      {isOwner && <OwnerComposer onPublished={load} />}

      {/* Tabs */}
      <div role="tablist" aria-label="محتوای غرفه" className="mt-6 flex border-b border-slate-200 dark:border-emerald-900">
        {TABS.map(({ key, labelKey, icon: Icon }) => (
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
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Listings */}
      {tab === 'listings' && contentResults === null && (
        <div role="tabpanel" id="panel-listings" aria-labelledby="tab-listings" className="mt-5">
          {/* آگهی‌گذاری داخل غرفه خود فروشنده انجام می‌شود، نه در حساب من. */}
          {isOwner && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
              <div>
                <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">
                  {t('account.createListing')}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">
                  آگهی‌های شما — از جمله در انتظار بررسی و ردشده — همین‌جا مدیریت می‌شوند.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setListingEditor({ open: true, listing: null })}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-700"
              >
                <Plus size={14} />
                {t('account.createListing')}
              </button>
            </div>
          )}

          {listings.length === 0 ? (
            <EmptyState text={isOwner ? 'هنوز آگهی‌ای ثبت نکرده‌اید؛ اولین آگهی را از دکمه بالا اضافه کنید.' : 'این غرفه هنوز آگهی منتشرشده‌ای ندارد.'} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <li
                  key={listing.id}
                  className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40"
                >
                  <div className="relative">
                    <img src={listing.image_url} alt="" className="h-32 w-full object-cover" />
                    {listing.discount_percent > 0 && (
                      <span className="absolute start-2 top-2 rounded-full bg-brand-orange px-2 py-0.5 text-fluid-2xs font-bold text-white">
                        {listing.discount_percent.toLocaleString('fa-IR')}{t('shop.discount')}
                      </span>
                    )}
                    {/* Only the owner sees moderation state; buyers only ever
                        get published آگهی‌ها from the API. */}
                    {isOwner && listing.status !== 'published' && (
                      <span
                        className={cn(
                          'absolute end-2 top-2 rounded-full px-2 py-0.5 text-fluid-2xs font-bold',
                          listing.status === 'rejected'
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-500 text-white',
                        )}
                      >
                        {listing.status_label}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="truncate text-sm font-bold text-slate-800 dark:text-white">
                      {listing.title}
                    </h3>
                    <p className="mt-1 flex items-baseline gap-1.5 text-xs text-slate-500 dark:text-emerald-200">
                      <strong className="text-emerald-700 dark:text-lime-300">
                        {formatPrice(listing.discounted_price)}
                      </strong>
                      {listing.discount_percent > 0 && (
                        <del className="text-fluid-2xs text-slate-400">{formatPrice(listing.price)}</del>
                      )}
                      / {listing.unit}
                    </p>
                    <p className="mt-0.5 text-fluid-xs text-slate-400">
                      موجودی {listing.quantity_available} {listing.unit}
                      {listing.minimum_order > 1 && ` · حداقل ${listing.minimum_order}`}
                    </p>
                    {isOwner && listing.status === 'rejected' && listing.rejection_reason && (
                      <p role="alert" className="mt-2 rounded-xl bg-rose-50 p-2 text-fluid-2xs leading-5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                        <strong className="block">دلیل رد آگهی</strong>
                        {listing.rejection_reason}
                      </p>
                    )}

                    <div className="mt-2 flex gap-2">
                      {isOwner ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setListingEditor({ open: true, listing })}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
                          >
                            <Pencil size={13} />
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteListing(listing)}
                            className="flex w-10 items-center justify-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                            aria-label={`حذف آگهی ${listing.title}`}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </>
                      ) : (
                        <>
                      <button
                        type="button"
                        disabled={!listing.is_purchasable}
                        onClick={() => addListingToCart(listing.id).catch(() => undefined)}
                        className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {listing.is_purchasable ? t('shop.buy') : 'ناموجود'}
                      </button>
                      {(
                        <button
                          type="button"
                          title={t('storefront.sendToDirectHint')}
                          onClick={() => sendListingToDirect(listing)}
                          className="flex w-10 items-center justify-center rounded-xl border border-sky-200 text-sky-600 transition hover:bg-sky-50 dark:border-sky-900 dark:text-sky-300 dark:hover:bg-sky-950"
                          aria-label={t('storefront.sendToDirect')}
                        >
                          <Send size={14} aria-hidden="true" />
                        </button>
                      )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Posts */}
      {tab === 'posts' && contentResults === null && (
        <div role="tabpanel" id="panel-posts" aria-labelledby="tab-posts" className="mt-5">
          {posts.length === 0 ? (
            <EmptyState text="هنوز پستی منتشر نشده است." />
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {posts.map((post, index) => (
                <li key={post.id} className="relative">
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
                    {isOwner && post.status !== 'published' && (
                      <span className="absolute start-1.5 top-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-fluid-2xs font-bold text-white">
                        {post.status_label}
                      </span>
                    )}
                  </button>
                  {isOwner && (
                    <OwnerContentActions
                      onEdit={() => setPostEditor(post)}
                      onDelete={() => void deletePost(post)}
                      label={post.caption.slice(0, 30) || 'پست'}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Stories */}
      {tab === 'stories' && contentResults === null && (
        <div role="tabpanel" id="panel-stories" aria-labelledby="tab-stories" className="mt-5">
          {stories.length === 0 ? (
            <EmptyState text="در حال حاضر استوری فعالی وجود ندارد." />
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {stories.map((story, index) => (
                <li key={story.id} className="relative">
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
                  {isOwner && (
                    <OwnerContentActions
                      onEdit={() => setPostEditor(story)}
                      onDelete={() => void deletePost(story)}
                      label={story.caption.slice(0, 30) || 'استوری'}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Owner dialogs: آگهی composer/editor and post caption editor. */}
      {isOwner && (
        <>
          <ListingComposer
            open={listingEditor.open}
            listing={listingEditor.open ? listingEditor.listing : null}
            onClose={() => setListingEditor({ open: false })}
            onSaved={load}
          />
          <PostEditor post={postEditor} onClose={() => setPostEditor(null)} onSaved={load} />
        </>
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

/** Inline editor for the owner: name, bio, avatar and cover. */
function OwnerEditor({
  storefront,
  onSaved,
}: {
  storefront: StorefrontProfile['storefront'];
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(storefront.name);
  const [bio, setBio] = useState(storefront.bio);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('bio', bio.trim());
    if (avatar) formData.append('avatar', avatar);
    if (cover) formData.append('cover', cover);
    try {
      await agricultureApi.updateStorefront(formData);
      toast.success(t('storefront.updated'));
      setOpen(false);
      await onSaved();
    } catch {
      // The API client reports the failure.
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-lime-300"
      >
        <Pencil size={15} />
        {t('storefront.editStore')}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-emerald-950/40 p-3 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label={t('storefront.editStore')}
          >
            <motion.form
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onSubmit={save}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl dark:border-emerald-800 dark:bg-emerald-950 sm:p-6"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">
                  {t('storefront.myStore')}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-emerald-900"
                  aria-label={t('common.close')}
                >
                  <X size={17} />
                </button>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-emerald-200">
                {t('storefront.editHint')}
              </p>

              <div className="mt-4 space-y-4">
                <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
                  {t('storefront.storeName')}
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={150}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700 dark:text-emerald-50">
                  {t('storefront.storeBio')}
                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    maxLength={1000}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-sm font-bold text-slate-700 dark:text-emerald-50">
                      {t('storefront.storeAvatar')}
                    </span>
                    <button
                      type="button"
                      onClick={() => avatarInput.current?.click()}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-4 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
                    >
                      <Camera size={15} />
                      {avatar ? avatar.name.slice(0, 24) : t('storefront.storeAvatar')}
                    </button>
                    <input
                      ref={avatarInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
                    />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-700 dark:text-emerald-50">
                      {t('storefront.storeCover')}
                    </span>
                    <button
                      type="button"
                      onClick={() => coverInput.current?.click()}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-4 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
                    >
                      <ImageIcon size={15} />
                      {cover ? cover.name.slice(0, 24) : t('storefront.storeCover')}
                    </button>
                    <input
                      ref={coverInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => setCover(event.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Owner-only composer: publish a post or story with an image from this page. */
function OwnerComposer({ onPublished }: { onPublished: () => void | Promise<void> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [postType, setPostType] = useState<'post' | 'story'>('post');
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [publishing, setPublishing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function choose(file: File | null) {
    setImage(file);
    setPreview(file ? URL.createObjectURL(file) : '');
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!caption.trim() || !image) return;
    setPublishing(true);
    try {
      await storefrontPostsApi.create({ post_type: postType, caption: caption.trim(), image });
      toast.success(t('storefront.postPublished'));
      setCaption('');
      setImage(null);
      setPreview('');
      setOpen(false);
      await onPublished();
    } catch {
      // The API client reports the failure.
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800 dark:text-white">
            <Camera size={15} className="text-emerald-600 dark:text-lime-300" />
            {t('storefront.newPost')} / {t('storefront.newStory')}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">{t('storefront.composerHint')}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-700"
        >
          <Pencil size={14} />
          {t('storefront.newPost')}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-emerald-950/40 p-3 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label={t('storefront.newPost')}
          >
            <motion.form
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onSubmit={publish}
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl dark:border-emerald-800 dark:bg-emerald-950"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">
                  {postType === 'story' ? t('storefront.newStory') : t('storefront.newPost')}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-emerald-900"
                  aria-label={t('common.close')}
                >
                  <X size={17} />
                </button>
              </div>

              <div className="mt-4 flex gap-2" role="radiogroup" aria-label={t('common.status')}>
                {(['post', 'story'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={postType === kind}
                    onClick={() => setPostType(kind)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      postType === kind
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 text-slate-600 dark:border-emerald-800 dark:text-emerald-100'
                    }`}
                  >
                    {kind === 'story' ? t('storefront.newStory') : t('storefront.newPost')}
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-sm font-bold text-slate-700 dark:text-emerald-50">
                {t('storefront.newPost')}
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  maxLength={2200}
                  rows={3}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900"
                />
              </label>

              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-6 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
              >
                <ImageIcon size={16} />
                {image ? image.name : t('storefront.storeCover')}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => choose(event.target.files?.[0] ?? null)}
              />
              {preview && (
                <img
                  src={preview}
                  alt=""
                  className="mt-3 h-40 w-full rounded-xl object-cover"
                />
              )}

              <button
                type="submit"
                disabled={publishing || !image}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <Send size={15} />
                {publishing ? t('common.loading') : t('common.send')}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/**
 * Edit/delete overlay on an owner's post or story tile.
 *
 * Kept off the tile's own button so the tap targets never overlap: tapping the
 * image still opens the viewer, the corner controls manage the content.
 */
function OwnerContentActions({
  onEdit,
  onDelete,
  label,
}: {
  onEdit: () => void;
  onDelete: () => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="absolute end-1.5 top-1.5 flex gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${t('common.edit')} ${label}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
      >
        <Pencil size={13} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`حذف ${label}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-rose-200 backdrop-blur-sm transition hover:bg-rose-600 hover:text-white"
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Owner edits a published post/story: caption text and optionally the image. */
function PostEditor({
  post,
  onClose,
  onSaved,
}: {
  post: StorefrontPost | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (post) {
      setCaption(post.caption);
      setImage(null);
    }
  }, [post]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!post || !caption.trim()) return;
    setSaving(true);
    try {
      await storefrontPostsApi.update(post.id, { caption: caption.trim(), image });
      toast.success('محتوا به‌روزرسانی شد.');
      onClose();
      await onSaved();
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {post && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-emerald-950/40 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={post.post_type === 'story' ? 'ویرایش استوری' : 'ویرایش پست'}
        >
          <motion.form
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onSubmit={save}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl dark:border-emerald-800 dark:bg-emerald-950"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">
                {post.post_type === 'story' ? 'ویرایش استوری' : 'ویرایش پست'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-emerald-900"
                aria-label={t('common.close')}
              >
                <X size={17} />
              </button>
            </div>

            <img src={post.image_url} alt="" className="mt-4 h-40 w-full rounded-xl object-cover" />

            <label className="mt-4 block text-sm font-bold text-slate-700 dark:text-emerald-50">
              متن
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={2200}
                rows={3}
                required
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900"
              />
            </label>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-3 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-lime-300 dark:hover:bg-emerald-900/50"
            >
              <ImageIcon size={15} />
              {image ? image.name.slice(0, 28) : 'جایگزینی تصویر (اختیاری)'}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
            />

            <button
              type="submit"
              disabled={saving}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
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
