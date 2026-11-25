// frontend/e2e/responsive.spec.ts
//
// The responsive sweep: every significant page at every breakpoint, checked for
// the one failure that is objective and genuinely breaking — horizontal overflow.
// A page wider than the viewport forces sideways scrolling, which is unusable on
// a phone in a field.

import { expect, test } from '@playwright/test';

import { open } from './support';

const BREAKPOINTS = [
  { name: '320 small phone', width: 320, height: 640 },
  { name: '375 phone', width: 375, height: 812 },
  { name: '768 tablet', width: 768, height: 1024 },
  { name: '1440 desktop', width: 1440, height: 900 },
] as const;

const PAGES = [
  { path: '/', name: 'home' },
  { path: '/products', name: 'catalogue' },
  { path: '/storefronts', name: 'storefronts' },
  { path: '/services', name: 'services' },
  { path: '/farmers', name: 'farmers' },
  { path: '/magazine', name: 'magazine' },
  { path: '/support', name: 'support' },
  { path: '/checkout', name: 'checkout' },
  { path: '/login', name: 'login' },
] as const;

/** One pixel of rounding slack before calling it overflow. */
const TOLERANCE = 2;

for (const breakpoint of BREAKPOINTS) {
  test.describe(`at ${breakpoint.name}`, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } });

    for (const target of PAGES) {
      test(`${target.name} does not scroll sideways`, async ({ page }) => {
        await open(page, target.path);

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + TOLERANCE);
      });
    }
  });
}

test.describe('phone chrome', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the bottom bar holds four links and clears 44px', async ({ page }) => {
    await open(page, '/');

    const bar = page.getByRole('navigation', { name: 'ناوبری پایین' });
    await expect(bar).toBeVisible();

    const links = bar.getByRole('link');
    await expect(links).toHaveCount(4);

    for (const link of await links.all()) {
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('content is never hidden behind the fixed bar', async ({ page }) => {
    await open(page, '/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // At the very bottom of the page the footer's last line must sit above the
    // bar's top edge. The shell reserves the bar's height; when it stopped doing
    // that, the legal links were the first thing to disappear under it.
    const geometry = await page.evaluate(() => {
      const bar = document.querySelector('nav[aria-label="ناوبری پایین"]');
      const footer = document.querySelector('footer');
      return {
        barTop: bar?.getBoundingClientRect().top ?? 0,
        footerBottom: footer?.getBoundingClientRect().bottom ?? 0,
      };
    });

    expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.barTop + 1);
  });

  test('the cart panel fits the viewport', async ({ page }) => {
    await open(page, '/products');

    await page.getByRole('button', { name: /سبد خرید/ }).first().click();
    const drawer = page.getByRole('dialog', { name: 'سبد خرید' });
    await expect(drawer).toBeVisible();

    const box = await drawer.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(375);
  });
});

test.describe('reading', () => {
  test('body text is at least 12px', async ({ page }) => {
    await open(page, '/');

    const tooSmall = await page.$$eval('p, li, dd, dt', (elements) =>
      elements
        .filter((element) => (element.textContent ?? '').trim().length > 12)
        .map((element) => ({ tag: element.tagName, size: parseFloat(window.getComputedStyle(element).fontSize) }))
        .filter((entry) => entry.size > 0 && entry.size < 12),
    );

    expect(tooSmall).toEqual([]);
  });

  test('the document stays RTL', async ({ page }) => {
    await open(page, '/products');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  });
});
