// frontend/e2e/support.ts
//
// Shared bits of the browser suite.
//
// Two rules that keep these specs honest:
//   1. A slug is never hardcoded. The seed data is real, so the specs ask the API
//      which product, stall and article exist right now — a renamed demo record
//      then fails one helper with a clear message instead of ten tests with a 404.
//   2. Nothing here waits with `waitForTimeout`. Every wait is tied to something
//      the page does, because a sleep either wastes time or hides a race.

import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** The first row of a paginated endpoint, or a clear failure. */
export async function firstRow<T = Record<string, unknown>>(
  request: APIRequestContext,
  path: string,
): Promise<T> {
  const response = await request.get(`${path}${path.includes('?') ? '&' : '?'}page_size=1`);
  expect(response.ok(), `GET ${path} answered ${response.status()}`).toBeTruthy();
  const body = (await response.json()) as { results?: T[] } | T[];
  const row = Array.isArray(body) ? body[0] : body.results?.[0];
  expect(row, `${path} has no rows to link to`).toBeTruthy();
  return row as T;
}

export const slugOf = async (request: APIRequestContext, path: string) =>
  (await firstRow<{ slug: string }>(request, path)).slug;

/** Every visible, focusable thing — used by the focus and touch-target checks. */
export const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Opens a route and waits until the page has stopped fetching. The header's own
 * search box mounts before any data does, so `networkidle` is the signal that the
 * screen is actually the one under test.
 */
export async function open(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} did not answer 200`).toBe(200);
  await page.waitForLoadState('networkidle');
}
