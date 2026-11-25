// frontend/e2e/selectors.ts
//
// Helpers for the one thing the specs ask of data that the page has not rendered
// yet: a select whose options arrive from a request.

import { expect, type Locator } from '@playwright/test';

/**
 * Choose from a select that is still being *given* options.
 *
 * `selectOption` resolves as soon as the `<select>` exists, not as soon as the
 * option does — invisible on a warm laptop, a failure that reads like a broken
 * feature on a cold runner. Waiting for the option doubles as the assertion that
 * the data arrived.
 */
export async function selectWhenReady(select: Locator, value: string): Promise<void> {
  await expect(select.locator(`option[value="${value}"]`)).toBeAttached({ timeout: 15_000 });
  await select.selectOption(value);
}

/** The same wait for a select picked by index. */
export async function waitForOptions(select: Locator, atLeast = 2): Promise<void> {
  await expect.poll(() => select.locator('option').count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(atLeast);
}
