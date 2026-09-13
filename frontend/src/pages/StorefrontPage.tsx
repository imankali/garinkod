// frontend/src/pages/StorefrontPage.tsx

import {useCallback, useEffect, useState} from 'react';
import {Link, useParams, useSearchParams} from 'react-router';
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';
import {BadgeCheck, Grid3x3, Heart, ImageIcon, MapPin, MessageCircle, Pencil, Plus, Search, Send, ShoppingBasket, Star, Trash2, UserPlus, X} from 'lucide-react';
import toast from 'react-hot-toast';
import {Helmet} from 'react-helmet-async';
import {agricultureApi, messagesApi, storefrontPostsApi, storefrontsApi} from '../api/services';
import {parseApiError} from '../api/errors';
import {useAuthStore} from '../store/authStore';
import {useCartStore} from '../store/cartStore';
import {useDirectStore} from '../store/directStore';
import {useDebouncedValue} from '../hooks/useDebouncedValue';
import {useTranslation} from '../i18n';
import {formatPrice} from '../utils/formatPrice';
import {cn} from '../utils/cn';
import ListingComposer from '../components/storefront/ListingComposer';
import ListingDetailModal from '../components/storefront/ListingDetailModal';
import PostCard from '../components/social/PostCard';
import type { MarketplaceListing, StorefrontPost, StorefrontProfile } from '@/types/storefront';

import { EmptyState, StoryViewer } from './storefront/Overlays';
import { OwnerEditor } from './storefront/OwnerEditor';
import { OwnerComposer } from './storefront/OwnerComposer';
import { OwnerContentActions, PostEditor } from './storefront/OwnerActions';

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
  const reduceMotion = useReducedMotion();
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  // `?listing=<slug>` opens one آگهی's detail. Keeping it in the URL means the
  // "محصول پیوست‌شده" link in a message, a shared address and the back button
  // all land on the same product.
  const [searchParams, setSearchParams] = useSearchParams();
  const openListingSlug = searchParams.get('listing');
  /*
    `?tab=posts&post=<id>&comment=<id>` is the address a comment-reply
    notification links to: the post whose comment was answered, with that
    comment's thread open and the reader's own line in view. A notification that
    only says «یکی پاسخ داد» and then drops you at the top of a shop page makes
    the reader do the search the platform could have done.
  */
  const deepLinkPost = searchParams.get('post') ? Number(searchParams.get('post')) : null;
  const deepLinkComment = searchParams.get('comment') ? Number(searchParams.get('comment')) : null;
  const openListing = useCallback(
    (listingSlug: string | null) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (listingSlug) next.set('listing', listingSlug);
          else next.delete('listing');
          return next;
        },
        { replace: !listingSlug },
      );
    },
    [setSearchParams],
  );
  const [profile, setProfile] = useState<StorefrontProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<TabKey>(() =>
    new URLSearchParams(window.location.search).get('tab') === 'posts' ? 'posts' : 'listings',
  );
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
  const [contentError, setContentError] = useState('');

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

  /*
    The deep-linked post is scrolled to as soon as it is on the page; PostCard
    then opens its comment thread and flashes the line the reply answered. It
    waits on the loaded content rather than on a timeout, because the feed is
    what decides whether that node exists yet.
  */
  useEffect(() => {
    if (!deepLinkPost || !profile) return;
    const node = document.getElementById(`post-${deepLinkPost}`);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [deepLinkPost, profile]);


  // Owners see a live unread badge for the storefront inbox.
  // Live content search inside this storefront.
  const searchContent = useCallback(async () => {
    const query = debouncedContentQuery.trim();
    if (!query) { setContentResults(null); setContentError(''); return; }
    setContentBusy(true); setContentError('');
    try {
      const response = await storefrontsApi.searchContent(slug, query);
      setContentResults([...response.data.posts, ...response.data.stories]);
    } catch (error) {
      setContentError(parseApiError(error).message);
    } finally { setContentBusy(false); }
  }, [debouncedContentQuery, slug]);

  useEffect(() => { void searchContent(); }, [searchContent]);

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

  if (loading) return <StorefrontSkeleton />;

  if (loadError || !profile) {
    return (
      <>
      <Helmet><title>غرفه پیدا نشد | گرین کود</title><meta name="robots" content="noindex,nofollow" /></Helmet>
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
      </>
    );
  }

  const { storefront, listings, posts, stories, highlights, counts } = profile;

  const isOwner = storefront.is_owner;
  const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
  const storefrontUrl = `${siteUrl}/storefronts/${encodeURIComponent(storefront.slug)}`;
  const seoDescription = (
    storefront.bio.trim()
    || `${storefront.seller_type_label} در ${[storefront.city, storefront.province].filter(Boolean).join('، ') || 'بازار کشاورزی گرین کود'}`
  ).slice(0, 160);
  const socialImage = storefront.cover_url || storefront.avatar_url;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': `${storefrontUrl}#store`,
    name: storefront.name,
    description: seoDescription,
    url: storefrontUrl,
    ...(socialImage ? { image: new URL(socialImage, `${siteUrl}/`).href } : {}),
    ...(storefront.city || storefront.province ? {
      address: {
        '@type': 'PostalAddress',
        addressLocality: storefront.city || undefined,
        addressRegion: storefront.province || undefined,
        addressCountry: 'IR',
      },
    } : {}),
  };

  return (
    <>
      <Helmet>
        <title>{`${storefront.name} | غرفه‌های گرین کود`}</title>
        <meta name="description" content={seoDescription} />
        <meta name="robots" content="index,follow,max-image-preview:large" />
        <link rel="canonical" href={storefrontUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${storefront.name} | گرین کود`} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={storefrontUrl} />
        {socialImage && <meta property="og:image" content={new URL(socialImage, `${siteUrl}/`).href} />}
        <meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>
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
              <motion.button
                type="button"
                whileHover={reduceMotion ? undefined : { y: -4 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
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
              </motion.button>
              <OwnerEditor storefront={storefront} onSaved={load} />
            </>
          ) : (
            <>
              <motion.button
                type="button"
                whileHover={reduceMotion ? undefined : { y: -4 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
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
              </motion.button>
              <motion.button
                type="button"
                whileHover={reduceMotion ? undefined : { y: -4 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                onClick={() => openDirect({ storefrontSlug: storefront.slug })}
                className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700"
              >
                <MessageCircle size={15} />
                {t('storefront.message')}
              </motion.button>
            </>
          )}
        </div>
      </header>

      {/* Counters */}
      <dl className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-center dark:border-emerald-900 dark:bg-emerald-950/40 [&>div]:min-w-0 [&_dd]:break-words [&_dt]:break-words">
        {[
          { label: t('storefronts.listings'), value: counts.listings },
          { label: t('storefront.tab.posts'), value: counts.posts },
          { label: t('storefronts.followers'), value: counts.followers },
        ].map((entry) => (
          <div key={entry.label}>
            <dt className="text-fluid-xs text-slate-500 dark:text-emerald-300">{entry.label}</dt>
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
                  <span className="w-full min-w-0 truncate text-center text-fluid-2xs text-slate-600 dark:text-emerald-100">
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
                  <span className="w-full min-w-0 truncate text-center text-fluid-2xs text-slate-600 dark:text-emerald-100">
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
              className="absolute end-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-emerald-900"
              aria-label={t('common.close')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {contentError && (
          <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50 p-3 text-fluid-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
            <span>{contentError}</span>
            <motion.button type="button" onClick={() => void searchContent()} whileHover={reduceMotion ? undefined : { y: -4 }} whileTap={reduceMotion ? undefined : { scale: 0.97 }} className="rounded-lg border border-rose-200 px-3">تلاش مجدد</motion.button>
          </div>
        )}

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
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-start text-fluid-2xs font-bold text-white">
                        <span className="line-clamp-1">{post.caption}</span>
                        {/* Counts even in a result tile: the number is the reason
                            a seller reads a post's performance at all. */}
                        <span className="mt-0.5 flex items-center gap-2 text-[10px] font-bold text-white/85">
                          <span className="flex items-center gap-0.5">
                            <Heart size={9} aria-hidden="true" />
                            {post.like_count.toLocaleString('fa-IR')}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MessageCircle size={9} aria-hidden="true" />
                            {post.comment_count.toLocaleString('fa-IR')}
                          </span>
                        </span>
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
          <motion.button
            key={key}
            role="tab"
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
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
          </motion.button>
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
                  <button
                    type="button"
                    onClick={() => openListing(listing.slug)}
                    className="relative block w-full text-start"
                    aria-label={`مشاهده جزئیات ${listing.title}`}
                  >
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
                  </button>
                  <div className="p-3">
                    <h3 className="min-w-0 truncate text-sm font-bold text-slate-800 dark:text-white">
                      <button
                        type="button"
                        onClick={() => openListing(listing.slug)}
                        className="max-w-full min-w-0 truncate text-start hover:text-emerald-700 hover:underline dark:hover:text-lime-300"
                      >
                        {listing.title}
                      </button>
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
            /*
              A feed of full post cards, the same component بازار کشاورزان uses,
              rather than a wall of thumbnails: on a storefront page the reader
              wants the caption, the like count and the comment thread, and a grid
              of squares shows none of them. Stories keep their own viewer.
            */
            <ul className="mx-auto grid max-w-xl gap-5">
              {posts.map((post) => (
                <li key={post.id} id={`post-${post.id}`}>
                  <PostCard
                    post={post}
                    openComments={deepLinkPost === post.id}
                    highlightCommentId={deepLinkPost === post.id ? deepLinkComment ?? undefined : undefined}
                    {...(isOwner
                      ? {
                          onEdit: (target: StorefrontPost) => setPostEditor(target),
                          onDelete: (target: StorefrontPost) => void deletePost(target),
                        }
                      : {})}
                  />
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

      {/* One آگهی's detail, deep-linkable via ?listing=<slug>. */}
      <ListingDetailModal
        slug={openListingSlug}
        initial={openListingSlug ? listings.find((item) => item.slug === openListingSlug) ?? null : null}
        onClose={() => openListing(null)}
        isOwner={isOwner}
      />

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
    </>
  );
}


function StorefrontSkeleton() {
  const block = "animate-pulse rounded-2xl bg-slate-100 dark:bg-emerald-900";
  return <main className="mx-auto max-w-5xl px-[var(--page-gutter)] py-8" role="status" aria-label="در حال بارگذاری غرفه"><div className={`h-52 w-full ${block}`} /><div className="-mt-10 flex items-end gap-4 px-5"><div className={`h-24 w-24 rounded-full ${block}`} /><div className="flex-1 space-y-3 pb-2"><div className={`h-7 w-52 ${block}`} /><div className={`h-4 w-36 ${block}`} /></div></div><div className="mt-5 grid grid-cols-3 gap-2">{Array.from({length:3}).map((_,i)=><div key={i} className={`h-20 min-w-0 ${block}`} />)}</div><div className={`mt-6 h-12 ${block}`} /><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:6}).map((_,i)=><div key={i} className={`h-56 ${block}`} />)}</div><span className="sr-only">در حال بارگذاری</span></main>;
}
