// frontend/src/api/messagesWindowParams.test.ts
//
// The query the messenger sends for a thread. The server switches between plain
// pagination and a tail window on exactly these parameters, so a stray `page`
// next to a `page_size` is the difference between the newest 80 messages and the
// oldest 40 — the bug the tail mode exists to fix.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from './client';
import { messagesApi } from './services';

vi.mock('./client', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: {} })) },
}));

const get = vi.mocked(apiClient.get);
const url = '/marketplace/conversations/12/messages/';

beforeEach(() => {
  get.mockClear();
});

describe('the messages query', () => {
  it('opens a thread on a tail window', async () => {
    await messagesApi.messages(12, { pageSize: 80 });
    expect(get).toHaveBeenCalledWith(url, { params: { page_size: 80 } });
  });

  it('walks back from a cursor, without a page number in sight', async () => {
    await messagesApi.messages(12, { pageSize: 80, beforeId: 4021 });
    expect(get).toHaveBeenCalledWith(url, { params: { page_size: 80, before_id: 4021 } });
  });

  it('leaves plain pagination alone when no window is asked for', async () => {
    await messagesApi.messages(12, { page: 2 });
    expect(get).toHaveBeenCalledWith(url, { params: { page: 2 } });
  });

  it('sends nothing extra for a bare read', async () => {
    await messagesApi.messages(12);
    expect(get).toHaveBeenCalledWith(url, { params: {} });
  });
});
