// frontend/src/components/home/FeaturedStorefronts.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, MapPin, Star, Store, Users } from 'lucide-react';

import { storefrontsApi } from '../../api/services';
import type { Storefront, StorefrontPost } from '../../types';
import { storefrontPostsApi } from '../../api/services';

/**
 * Featured storefronts and live stories.
 *
 * The marketplace is what distinguishes this platform from a plain shop, and
 * it had no presence on the home page at all. This strip puts real sellers —
 * with their location, rating and live stories — in front of visitors.
 *
 * The whole section unmounts when there is nothing to show: an empty
 * "featured sellers" heading looks like a broken page, whereas simply not
 * rendering it looks intentional.
 */
export default function FeaturedStorefronts() {
  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [stories, setStories] = useState<StorefrontPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      storefrontsApi.featured(6),
      storefrontPostsApi.list({ post_type: 'story' }),
    ]).then(([featured, storyResult]) => {
      if (cancelled) return;
      if (featured.status === 'fulfilled') setStorefronts(featured.value.data);
      if (storyResult.status === 'fulfilled') setStories(storyResult.value.data.results.slice(0, 10));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // A failed or empty fetch must not leave a hollow section behind.
  if (loading || (storefronts.length === 0 && stories.length === 0)) return null;

  return (
    <section className="page-shell py-8" aria-labelledby="storefronts-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="storefronts-heading"
            className="flex items-center gap-2 text-fluid-xl font-extrabold text-slate-800 dark:text-white"
          >
            <Store size={20} aria-hidden="true" className="text-emerald-600" />
            مستقیم از غرفه کشاورزان
          </h2>
          <p className="mt-1 text-fluid-sm text-slate-500 dark:text-emerald-200">
            بدون واسطه، با قیمت درب مزرعه.
          </p>
        </div>
        <Link
          to="/storefronts"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-fluid-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-lime-300 dark:hover:bg-emerald-900"
        >
          مشاهده همه غرفه‌داران
          <ArrowLeft size={14} aria-hidden="true" />
        </Link>
      </div>

      {/* Live stories, Instagram-style. */}
      {stories.length > 0 && (
        <ul className="mt-5 flex gap-4 overflow-x-auto pb-2" aria-label="استوری‌های غرفه‌ها">
          {stories.map((story) => (
            <li key={story.id} className="shrink-0">
              <Link
                to={`/storefronts/${story.storefront_slug}`}
                className="flex w-[4.5rem] flex-col items-center gap-1.5"
              >
                <span className="rounded-full bg-gradient-to-tr from-amber-400 to-rose-500 p-[3px]">
                  <span className="block h-16 w-16 overflow-hidden rounded-full border-2 border-white dark:border-emerald-950">
                    <img
                      src={story.image_url}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </span>
                </span>
                <span className="w-full truncate text-center text-fluid-2xs font-semibold text-slate-600 dark:text-emerald-100">
                  {story.storefront_name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Seller cards. */}
      {storefronts.length > 0 && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {storefronts.map((storefront) => (
            <li key={storefront.id}>
              <Link
                to={`/storefronts/${storefront.slug}`}
                className="flex h-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950"
              >
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900">
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
                    <span className="flex h-full w-full items-center justify-center text-fluid-sm font-extrabold text-emerald-700 dark:text-lime-300">
                      {storefront.name.slice(0, 2)}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1 text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                    <span className="truncate">{storefront.name}</span>
                    {storefront.is_verified && (
                      <BadgeCheck
                        size={14}
                        aria-label="غرفه تأییدشده"
                        className="shrink-0 text-emerald-500"
                      />
                    )}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-fluid-2xs text-slate-500 dark:text-emerald-300">
                    <span>{storefront.seller_type_label}</span>
                    {storefront.city && (
                      <span className="flex items-center gap-0.5">
                        <MapPin size={10} aria-hidden="true" />
                        {storefront.city}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Store size={10} aria-hidden="true" />
                      {storefront.listing_count} آگهی
                    </span>
                    {storefront.followers_count > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Users size={10} aria-hidden="true" />
                        {storefront.followers_count}
                      </span>
                    )}
                    {Number(storefront.rating) > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Star size={10} aria-hidden="true" className="text-amber-400" />
                        {storefront.rating}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
