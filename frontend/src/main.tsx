// frontend/src/main.tsx
//
// The entry point, and nothing more.
//
// Everything that is not a render lives here on purpose — Sentry, the crash
// boundary, the service worker — so a page component can be read as a page and
// not as plumbing. The provider stack itself is in `providers.tsx`, so the mount
// test boots the same one the browser does.
//
// Two things were removed with the rebuild: the queue gate that used to seal
// the site (the API no longer admits visitors through a waiting room) and the
// old `index.css`. The design tokens are in `styles/global.css`.

import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { registerSW } from 'virtual:pwa-register';

import App from './App';
import { reportClientError } from './api/admission';
import { adoptPreviewTokenFromUrl } from './api/previewSession';
import { Providers } from './providers';
import './styles/global.css';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0),
    sendDefaultPii: false,
  });
}

// One report per crash, however many times React re-renders the broken tree.
let crashReported = false;

interface BoundaryState {
  error: Error | null;
  reported: boolean;
}

class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null, reported: false };

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React Error Boundary caught:', error, info);
    if (sentryDsn) Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    if (crashReported) return;
    crashReported = true;
    void reportClientError({
      title: 'صفحهٔ گرین‌کود از کار افتاد',
      message: `${error.name}: ${error.message}`.slice(0, 4000),
      source: 'client',
      path: typeof window === 'undefined' ? '' : window.location.pathname,
      context: { component_stack: (info.componentStack || '').slice(-2000) },
    }).then((result) => {
      if (result.reported) this.setState({ reported: true });
    });
  }

  render() {
    const { error, reported } = this.state;
    if (!error) return this.props.children;

    return (
      <div dir="rtl" className="flex min-h-dvh items-center justify-center bg-cream p-4 dark:bg-night">
        <div className="w-full max-w-md rounded-lg border border-line bg-paper p-6 dark:border-night-line dark:bg-night-soft">
          <p className="text-2xs font-extrabold text-danger-700">خطای صفحه</p>
          <h1 className="mt-1 text-base font-extrabold text-ink dark:text-white">این صفحه باز نشد</h1>
          <p className="mt-2 text-xs leading-7 text-ink-soft dark:text-white/65">
            چیزی که وارد کرده بودید از بین نرفته است. صفحه را دوباره باز کنید؛ اگر همین‌جا ماند، از پشتیبانی
            پیگیری کنید.
          </p>
          {error.message && (
            <p dir="ltr" className="mt-3 max-h-24 overflow-auto rounded-sm bg-brand-50 p-2 text-start text-[11px] leading-5 text-ink-mute dark:bg-night dark:text-white/40">
              {String(error.message).slice(0, 300)}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 rounded-md bg-brand-700 px-4 text-sm font-bold text-white transition-colors duration-150 hover:bg-brand-800 active:scale-[0.98]"
            >
              بازخوانی صفحه
            </button>
            <a
              href="/"
              className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm font-bold text-ink transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50 dark:border-night-line dark:text-white"
            >
              رفتن به خانه
            </a>
          </div>
          <p className="mt-3 text-[11px] text-ink-mute dark:text-white/40">
            {reported ? 'گزارش این خطا ارسال شد.' : 'گزارش خطا به‌زودی ارسال می‌شود.'}
          </p>
        </div>
      </div>
    );
  }
}

// Workbox precaches the shell and the reference pages, so a farm with no
// signal still reads the article it opened this morning.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisterError: (error) => console.warn('Service worker registration failed:', error),
    onOfflineReady: () => console.info('GarinKood is ready for offline reference use.'),
  });
}

// A preview whose browser denies storage recovers its sign-in from the address;
// the parameter is stripped before the router sees it.
adoptPreviewTokenFromUrl();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found. Check index.html.');

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <Providers>
        <App />
      </Providers>
    </ErrorBoundary>
  </StrictMode>,
);
