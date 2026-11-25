// frontend/src/components/ui/Toaster.tsx

import { Toaster as HotToaster } from 'react-hot-toast';

/**
 * The one place a transient message appears.
 *
 * Why this exists at all: the data layer (the API client, the cart store, the
 * auth store) reports server-side failures through `react-hot-toast`, and those
 * calls are silent if nothing is mounted. The screens still state their own
 * errors inline — a field error belongs under the field, not in a toast — so this
 * is only for the messages that have nowhere else to live: a dropped request, a
 * session that could not be kept, a stock conflict discovered on the server.
 *
 * It is placed above the phone's bottom bar, not under it, and it is styled from
 * the same tokens as everything else: no green tick, no bounce, no stack of five.
 */
export default function Toaster() {
  return (
    <HotToaster
      position="bottom-center"
      gutter={10}
      // One at a time: two stacked toasts say the same thing twice.
      containerStyle={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--color-ink)',
          color: '#f6f8f3',
          padding: '0.625rem 0.875rem',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8125rem',
          fontWeight: 700,
          lineHeight: 1.7,
          maxWidth: 'min(28rem, 92vw)',
          boxShadow: 'var(--shadow-panel)',
        },
        success: {
          style: { background: 'var(--color-brand-800)', color: '#f0fdf4' },
          iconTheme: { primary: '#bbf7d0', secondary: '#14532d' },
        },
        error: {
          style: { background: '#7f1d1d', color: '#fef2f2' },
          iconTheme: { primary: '#fecaca', secondary: '#7f1d1d' },
        },
      }}
    />
  );
}
