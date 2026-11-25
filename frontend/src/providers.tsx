// frontend/src/providers.tsx
//
// The provider stack, in one place — imported by `main.tsx` and by the mount test.
//
// It lives outside both so that a test cannot quietly pass against a different set
// of providers than the app boots with: the order below (i18n above queries) is the
// order the two actually need.

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { I18nProvider } from './i18n';

/**
 * Cache defaults for a catalogue read on a phone network: one retry, no refetch on
 * focus (the visitor is reading, not waiting), and a freshness window that matches
 * how often a price list actually changes.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
        refetchOnReconnect: true,
      },
      mutations: { retry: 0 },
    },
  });
}

export function Providers({ children, client }: { children: ReactNode; client?: QueryClient }) {
  // Created once per mount: a client rebuilt on every render would drop the cache
  // on every render.
  const [fallback] = useState(createQueryClient);
  return (
    <I18nProvider>
      <QueryClientProvider client={client ?? fallback}>{children}</QueryClientProvider>
    </I18nProvider>
  );
}
