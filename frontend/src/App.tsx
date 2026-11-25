// frontend/src/App.tsx
//
// The site map, in one file.
//
// Everything that paints the first screen is eager: the header, the footer,
// the phone bar, the cart panel, and the home page. Routed pages below the fold
// are lazy — a visitor who came for one product should not download the
// checkout flow to look at it.
//
// Two structural decisions worth keeping:
//   • `/checkout` is its own page even though the cart is a drawer. The cart
//     panel is for editing a basket in place; checkout is a form with a
//     back button, and it needs an address you can return to after a refresh.
//   • `/legal/:slug` and `/magazine/:slug` are single routes with an optional
//     parameter rather than two routes per section: the hub and the document
//     share their header and their query, and splitting them would duplicate
//     both.

import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router';

import { useAuthStore } from './store/authStore';
import { useCartStore } from './store/cartStore';
import { applyThemeClass, useThemeStore } from './store/themeStore';
import { captureReferral } from './lib/referral';

import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import BottomNav from './components/layout/BottomNav';
import CartDrawer from './components/shop/CartDrawer';
import Toaster from './components/ui/Toaster';
import { Skeleton } from './components/ui/Skeleton';
import Home from './pages/Home';

const Shop = lazy(() => import('./pages/Shop'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Landing = lazy(() => import('./pages/Landing'));
const Brands = lazy(() => import('./pages/Brands'));
const Offers = lazy(() => import('./pages/Offers'));
const Storefronts = lazy(() => import('./pages/Storefronts'));
const StorefrontPage = lazy(() => import('./pages/StorefrontPage'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const Services = lazy(() => import('./pages/Services'));
const Farmers = lazy(() => import('./pages/Farmers'));
const Magazine = lazy(() => import('./pages/Magazine'));
const Article = lazy(() => import('./pages/Article'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Support = lazy(() => import('./pages/Support'));
const Legal = lazy(() => import('./pages/Legal'));
const SitePage = lazy(() => import('./pages/SitePage'));
const Farm = lazy(() => import('./pages/Farm'));
const Calculator = lazy(() => import('./pages/Calculator'));
const Affiliate = lazy(() => import('./pages/Affiliate'));
const Auth = lazy(() => import('./pages/Auth'));
const Account = lazy(() => import('./pages/Account'));
const Orders = lazy(() => import('./pages/Orders'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Track = lazy(() => import('./pages/Track'));
const NotFound = lazy(() => import('./pages/NotFound'));

/**
 * Resets the scroll position on a route change — but not when only the query
 * string changed, because that is a filter being applied and yanking the page
 * back to the top would lose the visitor's place in the grid.
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

/**
 * Opens the session the browser already holds.
 *
 * The access token lives in an HttpOnly cookie, so the app cannot *know* who is
 * signed in until it asks: one request on mount decides whether the header shows
 * «حساب من» or «ورود», and the cart is fetched after that answer, because a
 * signed-out cart belongs to the session cookie rather than to an account.
 */
/**
 * Banks `?ref=` on the first frame, before anyone can navigate away from it.
 *
 * It used to live inside `Session`, which also opens the session and fetches the
 * cart — so an effect that only reads the query string was tied to two requests,
 * and any ordering change there could silently drop an affiliate code. Reading
 * the URL is a synchronous side effect with no dependency, so it is its own
 * effect with none.
 */
function ReferralCapture() {
  useEffect(() => {
    captureReferral();
  }, []);
  return null;
}

function Session() {
  const isDark = useThemeStore((state) => state.isDark);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isSessionChecked = useAuthStore((state) => state.isSessionChecked);
  const initializeSession = useAuthStore((state) => state.initializeSession);
  const fetchCart = useCartStore((state) => state.fetchCart);
  const resetCart = useCartStore((state) => state.reset);

  useEffect(() => {
    applyThemeClass(isDark);
  }, [isDark]);

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  useEffect(() => {
    if (!isSessionChecked) return;
    void fetchCart();
  }, [isSessionChecked, isAuthenticated, fetchCart]);

  // Signing out must not leave the previous account's basket on the screen.
  useEffect(() => {
    if (isSessionChecked && !isAuthenticated) resetCart();
  }, [isAuthenticated, isSessionChecked, resetCart]);

  return null;
}

/** The page skeleton: a heading bar and a block of content, which is what most pages are. */
function PageFallback() {
  return (
    <div className="shell flex flex-col gap-4 py-8" aria-busy="true" aria-live="polite">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <Skeleton className="mt-2 h-64 w-full rounded-lg" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ReferralCapture />
      <Session />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:z-[60] focus:rounded-md focus:bg-brand-800 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:outline-none"
      >
        رفتن به محتوای اصلی
      </a>

      <div className="flex min-h-dvh flex-col">
        <Header />

        {/* `tabIndex={-1}` so the skip link can move focus here, not just scroll. */}
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />

              {/* Catalogue */}
              <Route path="/products" element={<Shop />} />
              <Route path="/product/:slug" element={<ProductDetail />} />
              <Route path="/catalog/:kind/:slug" element={<Landing />} />
              <Route path="/brands" element={<Brands />} />
              <Route path="/offers" element={<Offers />} />

              {/* Marketplace */}
              <Route path="/storefronts" element={<Storefronts />} />
              <Route path="/storefront/:slug" element={<StorefrontPage />} />
              <Route path="/listing/:slug" element={<ListingDetail />} />

              {/* Services and selling */}
              <Route path="/services" element={<Services />} />
              <Route path="/farmers" element={<Farmers />} />
              <Route path="/affiliate" element={<Affiliate />} />

              {/* Reading */}
              <Route path="/magazine" element={<Magazine />} />
              <Route path="/magazine/:slug" element={<Article />} />

              {/* Company */}
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/support" element={<Support />} />
              <Route path="/legal" element={<Legal />} />
              <Route path="/legal/:slug" element={<Legal />} />
              {/* The address SitePage.get_absolute_url returns. */}
              <Route path="/page/:slug" element={<SitePage />} />
              <Route path="/farm" element={<Farm />} />
              <Route path="/calculator" element={<Calculator />} />

              {/* Account and orders */}
              <Route path="/login" element={<Auth />} />
              <Route path="/account" element={<Account />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/track" element={<Track />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>

        <Footer />
      </div>

      <CartDrawer />
      <Toaster />
      <BottomNav />
    </BrowserRouter>
  );
}
