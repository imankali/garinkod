// frontend/src/main.tsx
// ✅ نقطه ورود اصلی اپلیکیشن React

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import * as Sentry from "@sentry/react";
import { HelmetProvider } from "react-helmet-async";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { reportClientError } from "./api/admission";
import { adoptPreviewTokenFromUrl } from "./api/previewSession";
import ShopQueueGate from "./components/ShopQueueGate";
import { I18nProvider } from "./i18n";
import "./index.css";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0),
    sendDefaultPii: false,
  });
}

// ========================================
// React Query Client Configuration
// ✅ تنظیمات بهینه برای cache و retry
// ========================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      //  غیرفعال کردن refetch هنگام focus (برای جلوگیری از درخواست‌های تکراری)
      refetchOnWindowFocus: false,

      // ✅ فقط یک بار retry در صورت خطا (برای UX بهتر)
      retry: 1,

      // ✅ داده‌ها برای ۵ دقیقه fresh هستند (بعد از آن stale می‌شوند)
      staleTime: 5 * 60 * 1000,

      // ✅ داده‌های cache شده برای ۱۰ دقیقه در حافظه می‌مانند
      gcTime: 10 * 60 * 1000,

      // ✅ retry با تأخیر exponential (1s, 2s, 4s, ...)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // ✅ refetch هنگام reconnect به اینترنت
      refetchOnReconnect: true,
    },

    mutations: {
      // ✅ mutationها فقط یک بار retry می‌شوند
      retry: 1,
    },
  },
});

// ========================================
// Error Boundary برای جلوگیری از crash کامل اپ
// ========================================
// One report per crash, however many times React decides to re-render the broken
// tree: the shop's own error notebook wants «this happened, ۳ بار» not three
// separate cries.
let crashReported = false;

class ErrorBoundary extends (await import("react")).Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; reported: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, reported: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React Error Boundary caught:", error, errorInfo);
    if (sentryDsn) Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });

    if (crashReported) return;
    crashReported = true;
    // The same endpoint the «اینجا خطا داد» button uses, so a screen that dies on
    // its own is recorded exactly like a screen whose visitor chose to complain —
    // in one list, grouped, and read by whoever runs the shop.
    reportClientError({
      title: 'صفحهٔ گرین کود از کار افتاد',
      message: `${error?.name ?? 'Error'}: ${error?.message ?? ''}`.slice(0, 4000),
      source: 'client',
      path: typeof window === 'undefined' ? '' : window.location.pathname,
      context: { component_stack: (errorInfo.componentStack || '').slice(-2000) },
    }).then((result) => {
      if (result.reported) this.setState({ reported: true });
    });
  }

  render() {
    if (this.state.hasError) {
      const detail = this.state.error?.message ? String(this.state.error.message).slice(0, 300) : '';
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-lime-50 p-4" dir="rtl">
          <div className="max-w-md text-center bg-white rounded-3xl p-8 shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-black text-emerald-700">!</div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">همین لحظه صفحهٔ سایت از کار افتاد</h1>
            <p className="text-sm text-slate-500 leading-7 mb-5">
              چیزی که وارد کرده بودید از بین نرفته است. یک‌بار صفحه را باز کنید؛ اگر باز هم همین‌جا بود،
              با شمارهٔ پشتیبانی تماس بگیرید — ما همین خطا را در لاگ سیستم می‌بینیم.
            </p>
            {detail ? (
              <p dir="ltr" className="mb-5 rounded-2xl bg-slate-50 p-3 text-left text-[11px] leading-5 text-slate-400">
                {detail}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 px-6 py-3 text-sm font-bold text-white shadow-lg"
              >
                بازخوانی صفحه
              </button>
              <a
                href="/"
                className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                رفتن به خانه
              </a>
            </div>
            <p className="mt-5 text-[11px] text-slate-400">
              {this.state.reported ? 'گزارش این خطا به تیم فنی ارسال شد.' : 'اگر اینترنت ندارید، پس از اتصال دوباره همین پیام را می‌فرستیم.'}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Workbox precaching, runtime agricultural-reference caches and Push events
// are built together by vite-plugin-pwa. Auto-update prevents clients from
// remaining pinned to vulnerable, obsolete bundles.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisterError: (error) => console.warn('Service worker registration failed:', error),
    onOfflineReady: () => console.info('GarinKood is ready for offline reference use.'),
  });
}

// A preview whose browser denies storage recovers its sign-in from the address, and the
// parameter is dropped before the router ever sees it. Dev-only in effect: no production
// response carries the token this reads.
adoptPreviewTokenFromUrl();

// ========================================
// Render App
// ========================================
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found. Please check your index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      {/* The gate has to sit above the providers: while the shop is holding its
          door there must be no query client left to keep asking it for data. */}
      <ShopQueueGate>
        <HelmetProvider>
          <I18nProvider>
            <QueryClientProvider client={queryClient}>
              <App />
            {/* React Query DevTools - فقط در حالت development */}
              {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
            </QueryClientProvider>
          </I18nProvider>
        </HelmetProvider>
      </ShopQueueGate>
    </ErrorBoundary>
  </StrictMode>
);