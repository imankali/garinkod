// frontend/src/components/home/FeaturedStorefronts.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Store } from 'lucide-react';

import { storefrontsApi } from '../../api/services';
import StorefrontCard from '../StorefrontCard';
import type { Storefront } from '@/types/storefront';

/**
 * «مستقیم از کشاورزان» — the home page's window onto the marketplace.
 *
 * Two things used to be wrong here. The cards were a second, hand-rolled seller
 * card (avatar + one line of meta) that looked nothing like the stall cards on
 * the marketplace page, and a row of story bubbles sat above them, which made
 * the home page read like a social feed rather than a shop window. Stories are a
 * thing a returning user follows — they live in the profile now — while what
 * belongs on the home page is the stall itself: who is selling, where, with what
 * rating and how many ads.
 *
 * So this section renders the very same StorefrontCard the storefronts directory
 * renders, and follows the same rule: it unmounts when there is nothing to show,
 * because an empty "featured sellers" heading looks like a broken page.
 */
export default function FeaturedStorefronts() {
  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    storefrontsApi
      .featured(8)
      .then((response) => {
        if (!cancelled) setStorefronts(response.data);
      })
      .catch(() => {
        if (!cancelled) setStorefronts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || storefronts.length === 0) return null;

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

      {/* Four cards on a desktop row, two on a tablet, one on a phone: the same
          rhythm as the directory, so the section is recognisably the same thing. */}
      <ul className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {storefronts.map((storefront) => (
          <li key={storefront.id}>
            <StorefrontCard storefront={storefront} />
          </li>
        ))}
      </ul>
    </section>
  );
}
