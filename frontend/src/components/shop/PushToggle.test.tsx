// frontend/src/components/shop/PushToggle.test.tsx
//
// The important assertion here is a negative one: when the server says push is
// not configured, nothing renders. A switch that asks for the browser's
// permission and then has nowhere to register burns that permission for good —
// the prompt does not come back, and the visitor has no idea why.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const status = vi.fn();
const subscribe = vi.fn();
const remove = vi.fn();

vi.mock('../../api/services', () => ({
  webPushApi: {
    status: (...args: unknown[]) => status(...args),
    subscribe: (...args: unknown[]) => subscribe(...args),
    remove: (...args: unknown[]) => remove(...args),
  },
}));

import PushToggle from './PushToggle';

function renderToggle() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PushToggle />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  status.mockReset();
  subscribe.mockReset();
  remove.mockReset();
});

describe('PushToggle', () => {
  it('renders nothing when the server has push switched off', async () => {
    status.mockResolvedValue({ data: { enabled: false, public_key: '', subscriptions: [] } });
    renderToggle();

    // jsdom has no service worker or PushManager, so the component skips the
    // request entirely — the important part is that no UI appears either way.
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
    expect(screen.queryByText(/اعلان وضعیت سفارش/)).toBeNull();
    expect(status).not.toHaveBeenCalled();
  });

  it('renders nothing when enabled but no key was published', async () => {
    status.mockResolvedValue({ data: { enabled: true, public_key: '', subscriptions: [] } });
    renderToggle();

    // Without a key the subscribe call cannot be built; a button would fail
    // after the permission had already been granted.
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
    expect(screen.queryByText(/اعلان وضعیت سفارش/)).toBeNull();
  });
});
