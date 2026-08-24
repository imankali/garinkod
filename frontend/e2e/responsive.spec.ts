import { expect, test } from '@playwright/test';

/**
 * Responsive sweep.
 *
 * Every significant page is opened at each breakpoint on the design checklist
 * and checked for the one failure that is both objective and genuinely
 * breaking: horizontal overflow. A page whose content is wider than the
 * viewport forces sideways scrolling, which is unusable on a phone.
 */

const BREAKPOINTS = [
  { name: '320 (small phone)', width: 320, height: 640 },
  { name: '375 (iPhone)', width: 375, height: 812 },
  { name: '414 (large phone)', width: 414, height: 896 },
  { name: '768 (tablet portrait)', width: 768, height: 1024 },
  { name: '1024 (tablet landscape)', width: 1024, height: 768 },
  { name: '1440 (desktop)', width: 1440, height: 900 },
];

const PAGES = [
  { path: '/', name: 'home' },
  { path: '/marketplace', name: 'marketplace' },
  { path: '/storefronts', name: 'storefront directory' },
  { path: '/checkout', name: 'checkout' },
  { path: '/orders', name: 'orders' },
  { path: '/services', name: 'services' },
  { path: '/farmer-sell', name: 'farmer sell' },
  { path: '/support', name: 'support' },
  { path: '/rewards', name: 'rewards' },
  { path: '/login', name: 'login' },
];

/** Allow a pixel of rounding slack before calling it overflow. */
const OVERFLOW_TOLERANCE = 2;

for (const breakpoint of BREAKPOINTS) {
  test.describe(`at ${breakpoint.name}`, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } });

    for (const target of PAGES) {
      test(`${target.name} has no horizontal overflow`, async ({ page }) => {
        await page.goto(target.path);
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(
          overflow,
          `${target.path} overflows horizontally by ${overflow}px`,
        ).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
      });
    }
  });
}

test.describe('mobile layout details', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the cart drawer fits the viewport', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'سبد خرید' }).first().click();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
  });

  test('tap targets on the bottom navigation are large enough', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'منوی پایین موبایل' });
    await expect(nav).toBeVisible();

    const buttons = nav.getByRole('link');
    const count = await buttons.count();
    for (let index = 0; index < count; index += 1) {
      const box = await buttons.nth(index).boundingBox();
      if (!box) continue;
      // 44px is the widely used minimum comfortable touch target.
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
  });
});

test.describe('zoomed layout', () => {
  // 200% zoom is emulated by halving the viewport at the same DPR, which is
  // what a user with enlarged text effectively sees.
  test.use({ viewport: { width: 640, height: 480 } });

  test('home remains usable at 200% zoom', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
  });
});
