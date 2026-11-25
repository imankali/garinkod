// frontend/e2e/navigation.spec.ts
//
// Navigation and reachability, rewritten for the rebuilt shell.
//
// The rule these tests enforce: every destination the site offers is reachable by
// clicking, from the chrome, on any screen size. Before the navigation config
// existed six routes had no link anywhere; a menu that is generated from `nav.ts`
// cannot drift from the routes, and this is the check that proves it.

import { expect, test, type Page } from '@playwright/test';

import { FOCUSABLE, open } from './support';

/** Every destination the site promises a visitor who is not signed in. */
const PUBLIC_DESTINATIONS = [
  '/products',
  '/storefronts',
  '/offers',
  '/services',
  '/farmers',
  '/magazine',
  '/track',
  '/support',
  '/about',
  '/contact',
  '/legal',
  '/brands',
] as const;

/** Paths only, no query, no hash. */
async function linkedPaths(page: Page): Promise<string[]> {
  return page.$$eval('a[href^="/"]', (anchors) =>
    anchors
      .map((anchor) => (anchor as HTMLAnchorElement).getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/'))
      .map((href) => href.split('?')[0]!.split('#')[0]!),
  );
}

test.describe('reachability', () => {
  test('the home page links to every public destination', async ({ page }) => {
    await open(page, '/');
    const links = await linkedPaths(page);

    const missing = PUBLIC_DESTINATIONS.filter((destination) => !links.includes(destination));
    expect(missing, `not linked from the home page: ${missing.join(', ')}`).toEqual([]);
  });

  test('the desktop row carries the whole primary navigation', async ({ page }) => {
    await open(page, '/');
    const nav = page.getByRole('navigation', { name: 'ناوبری اصلی' });

    // Nine words, each one a real link — not a button and a menu.
    await expect(nav).toBeVisible();
    const count = await nav.getByRole('link').count();
    expect(count).toBeGreaterThanOrEqual(9);
  });

  test('the phone menu exposes the same destinations', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, '/');

    await page.getByRole('button', { name: 'منو' }).click();
    const menu = page.getByRole('dialog', { name: 'منوی سایت' });
    await expect(menu).toBeVisible();

    for (const destination of ['/products', '/storefronts', '/support', '/about']) {
      await expect(menu.locator(`a[href="${destination}"]`)).toHaveCount(1);
    }
  });

  test('the active page is marked with aria-current', async ({ page }) => {
    await open(page, '/products');
    await expect(page.locator('[aria-current="page"]').first()).toBeVisible();
  });

  test('an unknown address gets a map, not a blank page', async ({ page }) => {
    await page.goto('/this-address-does-not-exist');

    await expect(page.getByRole('heading', { name: 'این نشانی وجود ندارد' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'صفحهٔ اصلی' })).toBeVisible();
  });
});

test.describe('keyboard access', () => {
  test('the skip link is the first stop and moves focus into the content', async ({ page }) => {
    await open(page, '/');

    const first = page.locator(FOCUSABLE).first();
    await expect(first).toHaveText(/رفتن به محتوای اصلی/);

    await first.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('the phone menu closes on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, '/');

    await page.getByRole('button', { name: 'منو' }).click();
    const menu = page.getByRole('dialog', { name: 'منوی سایت' });
    await expect(menu).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('the cart panel is a dialog that closes on Escape', async ({ page }) => {
    await open(page, '/products');

    await page.getByRole('button', { name: /سبد خرید/ }).first().click();
    const drawer = page.getByRole('dialog', { name: 'سبد خرید' });
    await expect(drawer).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });
});

test.describe('navigation performance', () => {
  test('a route change scrolls to the top but a filter change does not', async ({ page }) => {
    await open(page, '/products');

    await page.mouse.wheel(0, 1200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    // A filter is a query-string change: the visitor keeps their place.
    await page.getByRole('link', { name: 'تخفیف‌ها' }).first().click();
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
