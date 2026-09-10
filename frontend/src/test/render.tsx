// frontend/src/test/render.tsx
//
// The providers a component of this app needs before it can render at all.
//
// Rendering a screen bare — `render(<Foo />)` — fails on the first `useTranslation`
// or `useQuery` call, and a test file that repeats the wrapper by hand drifts into
// thirty slightly different providers. One helper keeps every component test in
// the same environment the real app gives them: translations, routing and a query
// client with retries off (a test that waits for a retry is a test that times out).

import type { ReactElement } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, type RenderOptions } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router';

import { I18nProvider } from '../i18n';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Let everything the mount set in motion land, inside `act`.
 *
 * A page that fetches on mount resolves its promises between test steps; React
 * then warns — loudly, in stderr — that the update was not wrapped, and worse,
 * the update can land after the assertion that was supposed to see it. One tick
 * of flushing makes "the page has finished its first load" a fact rather than a
 * race.
 */
export async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** `renderApp`, plus the first load settled. */
export async function renderAppSettled(
  ui: ReactElement,
  options: Parameters<typeof renderApp>[1] = {},
) {
  const result = renderApp(ui, options);
  await flush();
  return result;
}

export function renderApp(
  ui: ReactElement,
  options: { route?: string; queryClient?: QueryClient } & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { route = '/', queryClient = createTestQueryClient(), ...rest } = options;
  const result = render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>
    </HelmetProvider>,
    rest,
  );
  return { ...result, queryClient };
}
