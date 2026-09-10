import { expect, type Locator } from '@playwright/test';

/**
 * Choosing from a select that the page is still being *given* options for.
 *
 * Every filter on this site is fed by a request — provinces and cities, crops,
 * moderation statuses — and `selectOption` resolves as soon as the `<select>`
 * exists, not as soon as the option does. On a warm laptop that is invisible; on a
 * cold runner it is a failure that reads like a broken feature. So the spec waits
 * for the thing it is about to pick, which doubles as the assertion that the data
 * arrived: an empty dropdown is a real bug, and this is where it would be caught.
 */
export async function selectWhenReady(select: Locator, value: string): Promise<void> {
  await expect(select.locator(`option[value="${value}"]`)).toBeAttached({ timeout: 15_000 });
  await select.selectOption(value);
}

/**
 * The same wait for a select whose options carry no stable value — anything picked
 * by index. It only promises the list is populated, never which entry lands where.
 */
export async function waitForOptions(select: Locator, atLeast = 2): Promise<void> {
  await expect
    .poll(() => select.locator('option').count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(atLeast);
}
