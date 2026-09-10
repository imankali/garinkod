// frontend/src/pages/Studio.tsx
//
// استودیو غرفه — the door to selling, not a room of its own.
//
// The studio used to be a separate publishing screen reachable only by level 2
// accounts, which put the tool that makes a seller *behind* the state of already
// being a seller. This page now resolves the three real cases:
//
//   signed out        → say what the studio is and ask them to log in;
//   no غرفه yet       → the same ساخت غرفه form the marketplace opens, so the
//                       stall and its identity fields are filled in one place;
//   a غرفه exists     → the seller's own page, where آگهی، پست و استوری are
//                       actually published and managed.
//
// The composer itself is no longer duplicated here: StorefrontPage owns
// OwnerComposer and the highlight editor, and a second copy of that form on a
// different URL is how two "official" ways to post start disagreeing.

import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Camera, Store } from 'lucide-react';

import { agricultureApi } from '../api/services';
import StorefrontForm from '../components/storefront/StorefrontForm';
import { useAuthStore } from '../store/authStore';
import type { Storefront } from '@/types/storefront';

/**
 * `checking` has to be its own state rather than "storefront is null":
 * rendering the create form while the request for an existing stall is still in
 * flight would show a stranger the thing they must not do (open a second غرفه)
 * for a few hundred milliseconds.
 */
type Gate = 'checking' | 'signed-out' | 'needs-storefront' | 'has-storefront';

export default function Studio() {
  const { isAuthenticated, isSessionChecked } = useAuthStore();
  const navigate = useNavigate();
  const [gate, setGate] = useState<Gate>('checking');
  const [storefront, setStorefront] = useState<Storefront | null>(null);

  useEffect(() => {
    if (!isSessionChecked) return;
    if (!isAuthenticated) {
      setGate('signed-out');
      return;
    }
    let cancelled = false;
    setGate('checking');
    agricultureApi
      .getStorefront()
      .then((response) => {
        if (cancelled) return;
        setStorefront(response.data || null);
        setGate(response.data ? 'has-storefront' : 'needs-storefront');
      })
      .catch(() => {
        if (cancelled) return;
        // A failed lookup is not "you have no stall" — but the form is still the
        // safest thing to offer, since creating a second غرفه is rejected by the
        // API and the seller can go to their own page from the header anyway.
        setStorefront(null);
        setGate('needs-storefront');
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isSessionChecked]);

  if (gate === 'checking') {
    return (
      <main className="mx-auto max-w-3xl px-[var(--page-gutter)] py-16 text-center text-sm text-slate-500 dark:text-emerald-200">
        <span className="sr-only">در حال بررسی وضعیت غرفه</span>
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" aria-hidden="true" />
      </main>
    );
  }

  if (gate === 'has-storefront' && storefront) {
    // The storefront page is the studio: composer, posts, stories, highlights.
    return <Navigate to={`/storefronts/${storefront.slug}?tab=posts`} replace />;
  }

  if (gate === 'signed-out') {
    // The same convention as every other protected address on the site: hand the
    // visitor to the login page with this one remembered, so signing in returns
    // them here and the gate resolves again — this time onto the form or their
    // own غرفه. A page that only *explains* the gate strands them.
    return <Navigate to="/login" replace state={{ from: '/studio' }} />;
  }

  return (
    <main className="mx-auto max-w-3xl px-[var(--page-gutter)] py-10">
      <header className="rounded-3xl bg-gradient-to-l from-violet-700 via-fuchsia-700 to-emerald-600 p-6 text-white shadow-xl shadow-violet-900/15 sm:p-8">
        <p className="flex items-center gap-2 text-fluid-xs font-extrabold text-lime-200">
          <Camera size={14} aria-hidden="true" />
          استودیو غرفه
        </p>
        <h1 className="mt-2 text-fluid-2xl font-extrabold">اول غرفه‌تان را بسازید</h1>
        <p className="mt-3 max-w-xl text-fluid-sm leading-7 text-white/90">
          پست، استوری و آگهی محصول همه داخل غرفه شما منتشر می‌شود. با تکمیل این فرم، غرفه شما ساخته می‌شود و پس از بررسی
          می‌توانید فروش را شروع کنید.
        </p>
      </header>

      <div className="mt-6 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-6">
        <StorefrontForm
          variant="card"
          onCreated={(created) => {
            // Straight onto the seller's own page: the studio is the غرفه, and
            // leaving them on a form they have already submitted is a dead end.
            navigate(`/storefronts/${created.slug}?tab=posts`, { replace: true });
          }}
        />
      </div>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-fluid-xs text-slate-500 dark:text-emerald-300">
        <Store size={13} aria-hidden="true" />
        غرفه‌های آماده را می‌توانید در
        <Link to="/storefronts" className="font-bold text-emerald-700 hover:underline dark:text-lime-300">
          بازار غرفه‌داران
        </Link>
        ببینید.
      </p>
    </main>
  );
}
