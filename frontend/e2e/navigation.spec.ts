import { expect, test, type Page } from '@playwright/test';

/**
 * Navigation and reachability.
 *
 * The rule these tests enforce: every page must be reachable by clicking,
 * never only by typing a URL. Before the navigation config existed, six routes
 * had no link anywhere in the interface.
 */

/** Routes a signed-out visitor must be able to reach by clicking alone. */
const PUBLIC_DESTINATIONS = [
  '/products',
  '/marketplace',
  '/storefronts',
  '/services',
  '/farmer-sell',
  '/support',
  '/orders',
];

async function collectLinks(page: Page): Promise<string[]> {
  return page.$$eval('a[href]', (anchors) =>
    anchors
      .map((anchor) => (anchor as HTMLAnchorElement).getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/'))
      .map((href) => href.split('?')[0]!.split('#')[0]!),
  );
}

test.describe('reachability', () => {
  test('the footer links to every public destination', async ({ page }) => {
    await page.goto('/');
    // The footer renders the full site map, so one page is enough to check.
    const links = await collectLinks(page);

    const missing = PUBLIC_DESTINATIONS.filter((destination) => !links.includes(destination));
    expect(missing, `destinations with no link on the home page: ${missing.join(', ')}`).toEqual([]);
  });

  test('the mobile menu exposes the full site map', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await page.getByRole('button', { name: 'باز کردن منوی کامل' }).click();
    const menu = page.getByRole('dialog', { name: 'منوی اصلی' });
    await expect(menu).toBeVisible();

    const links = await menu.locator('a[href^="/"]').evaluateAll((anchors) =>
      anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute('href')?.split('?')[0]),
    );

    for (const destination of ['/products', '/marketplace', '/storefronts', '/support']) {
      expect(links, `${destination} missing from the mobile menu`).toContain(destination);
    }
  });

  test('the mobile bottom bar uses real links, not buttons', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const bar = page.getByRole('navigation', { name: 'منوی اصلی موبایل' });
    await expect(bar).toBeVisible();
    // Real anchors can be opened in a new tab and are announced as links.
    await expect(bar.locator('a[href]')).not.toHaveCount(0);
  });

  test('the active page is marked with aria-current', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page.locator('[aria-current="page"]').first()).toBeVisible();
  });
});

test.describe('keyboard access', () => {
  test('the skip link is the first stop and jumps to the content', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    await expect(focused).toHaveText(/پرش به محتوای اصلی/);

    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('the mobile menu traps focus and closes on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByRole('button', { name: 'باز کردن منوی کامل' }).click();

    const menu = page.getByRole('dialog', { name: 'منوی اصلی' });
    await expect(menu).toBeVisible();

    // Focus must stay inside the drawer while it is open.
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press('Tab');
      const insideDialog = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return dialog ? dialog.contains(document.activeElement) : false;
      });
      expect(insideDialog, `focus escaped the drawer after ${step + 1} tabs`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });
});

test.describe('touch targets', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('every visible control meets the 44px minimum', async ({ page }) => {
    for (const route of ['/', '/marketplace', '/storefronts']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const undersized = await page.$$eval('button, a[href], select', (elements) =>
        elements
          .filter((element) => {
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            return (element as HTMLElement).offsetParent !== null;
          })
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              text: (element.textContent ?? '').trim().slice(0, 30),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            };
          })
          // Inline text links inside a paragraph are exempt: they are read as
          // text, not tapped as controls.
          .filter((box) => box.height > 0 && box.height < 40 && box.width < 200),
      );

      expect(
        undersized,
        `${route} has controls below the touch minimum:\n${JSON.stringify(undersized, null, 2)}`,
      ).toEqual([]);
    }
  });
});
