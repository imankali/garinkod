// frontend/src/pages/ListingDetailPage.tsx
//
// The full-page detail of one marketplace آگهی. Product cards on the
// marketplace grid navigate here for the whole story — specs, seller, share,
// quantity picker — while «نمای سریع» keeps using the in-place dialog on the
// grid itself. One source of truth for the content: the page and the dialog
// render the same ListingDetailBody, so price/stock can never disagree.
//
// Back semantics: the visitor who came from a grid gets the exact grid back —
// the browser restores the scroll position because the route unmounts instead
// of overlaying, and history.back() is the honest exit when there is history.

import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Store } from 'lucide-react';

import { agricultureApi } from '../api/services';
import { parseApiError } from '../api/errors';
import ListingDetailBody from '../components/storefront/ListingDetailBody';
import ListingDetailState from '../components/storefront/ListingDetailState';

export default function ListingDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const query = useQuery({
    queryKey: ['listing', slug],
    queryFn: async () => (await agricultureApi.getListing(slug)).data,
    enabled: Boolean(slug),
    staleTime: 60 * 1000,
  });

  // Data-driven document title; the router's RouteSeo owns the static ones.
  useEffect(() => {
    if (query.data) {
      document.title = `${query.data.title} | گرین کود`;
    }
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div className="mx-auto min-h-dvh max-w-5xl px-[var(--page-gutter)] py-10">
        <ListingDetailState kind="loading" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    const message = query.error ? parseApiError(query.error).message : 'این آگهی در دسترس نیست.';
    return (
      <div className="mx-auto min-h-dvh max-w-5xl px-[var(--page-gutter)] py-10">
        <ListingDetailState
          kind="error"
          message={message}
          onBack={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate('/products?source=marketplace');
          }}
        />
      </div>
    );
  }

  const listing = query.data;
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/products?source=marketplace');
  };

  return (
    <motion.main
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="mx-auto min-h-dvh max-w-5xl px-[var(--page-gutter)] pb-16 pt-4"
    >
      <nav
        aria-label="مسیر"
        className="mb-4 flex items-center gap-1 text-fluid-xs text-slate-500 dark:text-emerald-300/70"
      >
        <button
          type="button"
          onClick={goBack}
          className="flex min-h-11 items-center gap-1 font-bold text-emerald-700 transition-colors hover:text-emerald-900 dark:text-lime-300"
        >
          <ChevronRight size={14} aria-hidden="true" />
          بازگشت
        </button>
        <span aria-hidden="true">/</span>
        <Link to="/products?source=marketplace" className="min-h-11 py-3 hover:underline">
          بازار غرفه‌داران
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate">{listing.category_label || listing.title}</span>
      </nav>

      <h1 className="mb-4 text-fluid-xl font-extrabold text-slate-800 dark:text-white">
        {listing.title}
      </h1>

      <ListingDetailBody listing={listing} />

      <footer className="mt-8 rounded-2xl border border-emerald-100 bg-white p-4 text-fluid-xs text-slate-500 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        <Link
          to={`/storefronts/${encodeURIComponent(listing.storefront.slug)}`}
          className="inline-flex min-h-11 items-center gap-1.5 font-bold text-emerald-700 hover:underline dark:text-lime-300"
        >
          <Store size={14} aria-hidden="true" />
          مشاهده غرفهٔ {listing.storefront.name}
        </Link>
      </footer>
    </motion.main>
  );
}
