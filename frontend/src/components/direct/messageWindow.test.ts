// frontend/src/components/direct/messageWindow.test.ts
//
// The rule behind «پیام‌های قدیمی‌تر»: a thread opens on its newest window, and a
// quiet refresh must fold that window into what the reader has already scrolled
// back to, rather than throwing their history away.
//
// The old behaviour was the second one — every poll replaced the list with page 1,
// which for a long conversation meant both an empty screen on open and a reader's
// place in history erased every few seconds.

import { describe, expect, it } from 'vitest';

import { mergeWindow } from './DirectThread';
import type { StorefrontMessage } from '@/types/messaging';

const message = (id: number, extra: Partial<StorefrontMessage> = {}): StorefrontMessage =>
  ({
    id,
    body: `پیام ${id}`,
    created_at: '2026-01-01T00:00:00Z',
    ...extra,
  }) as StorefrontMessage;

describe('mergeWindow', () => {
  it('keeps the older rows a cursor page brought in', () => {
    const history = [message(1), message(2), message(3)];
    const window = [message(4), message(5)];
    expect(mergeWindow(history, window).map((item) => item.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('replaces a row inside the window with its fresh copy', () => {
    const before = [message(1), message(2, { body: 'قدیمی' })];
    const window = [message(2, { body: 'ویرایش‌شده' }), message(3)];
    const merged = mergeWindow(before, window);
    expect(merged.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(merged[1]?.body).toBe('ویرایش‌شده');
  });

  it('starts from the window when there is no history yet', () => {
    expect(mergeWindow([], [message(9)]).map((item) => item.id)).toEqual([9]);
  });

  it('does not duplicate a row the window already carries', () => {
    const before = [message(4), message(5)];
    const window = [message(4), message(5), message(6)];
    expect(mergeWindow(before, window).map((item) => item.id)).toEqual([4, 5, 6]);
  });
});
