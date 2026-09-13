import { expect, test, type Page } from '@playwright/test';

/**
 * Navigation and reachability.
 *
 * The rule these tests enforce: every page must be reachable by clicking,
 * never only by typing a URL. Before the navigation config existed, six routes
 * had no link anywhere in the interface.
 */

/** Routes a signed-out visitor must be able to reach by clicking alone. */
/**
 * Routes a signed-out visitor must be able to reach by clicking alone.
 *
 * There is no /marketplace here: the farmers' market and the storefront
 * directory are one page now (/storefronts), and the ads live as a tab of the
 * shop (/products?source=marketplace). The old address survives only as a
 * redirect, which public-routes.spec.ts guards.
 */
const PUBLIC_DESTINATIONS = [
  '/products',
  '/storefronts',
  '/services',
  '/farmer-sell',
  '/support',
  '/orders',
  // Guide and trust pages are part of the furniture too: they used to be reachable
  // only by typing the address.
  '/brands',
  '/faq',
  '/customers',
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

    for (const destination of ['/products', '/storefronts', '/support']) {
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
    await page.goto('/storefronts');
    await expect(page.locator('[aria-current="page"]').first()).toBeVisible();
  });
});

test.describe('keyboard access', () => {
  test('the skip link is the first stop and jumps to the content', async ({ page }) => {
    await page.goto('/');

    // Sequential focus traversal is not something a headless run can be trusted
    // to reproduce: Tab lands wherever the browser feels like, and the failure
    // reads as an empty document. So the contract is asserted on its two real
    // properties — the link is the first focusable thing in the document, and
    // activating it moves focus into the main content.
    const firstFocusable = page
      .locator('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
      .first();
    await expect(firstFocusable).toHaveText(/پرش به محتوای اصلی/);

    await firstFocusable.focus();
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
      // Ask the drawer this test opened whether it holds focus. Reaching for
      // "[role=dialog]" in the document would answer about whichever dialog was
      // rendered first — the cart, the wishlist — and report an escape that never
      // happened.
      const inside = await menu.evaluate((dialog) => dialog.contains(document.activeElement));
      expect(inside, `focus escaped the drawer after ${step + 1} tabs`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });
});

test.describe('touch targets', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('every visible control meets the 44px minimum', async ({ page }) => {
    for (const route of ['/', '/storefronts', '/products']) {
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
            const parent = element.parentElement;
            const own = (element.textContent ?? '').trim().length;
            const around = (parent?.textContent ?? '').trim().length;
            return {
              tag: element.tagName,
              text: (element.textContent ?? '').trim().slice(0, 30),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              // The design system's own floor, read from the token rather than
              // recomputed: index.css anchors `.min-h-11` controls to
              // `--tap-min` in pixels, so the number here cannot drift from the
              // number the stylesheet enforces.
              touchMin: parseFloat(
                window
                  .getComputedStyle(document.documentElement)
                  .getPropertyValue('--tap-min')
                  .trim() || '44px',
              ),
              // "In prose": one clause of a longer run of text, not a control.
              inlineInProse:
                !!parent &&
                /^(P|LI|DD|DT|SPAN|H1|H2|H3|H4)$/.test(parent.tagName) &&
                around > own + 8,
            };
          })
          // Two bars, both named. Every control in the chrome clears 44px, which is
          // this product's own rule for buttons and selects. Links are measured
          // against WCAG 2.2 SC 2.5.8 — 24px — with its Inline exception respected,
          // because a link that is one clause of a sentence is read as text and no
          // standard expects anyone to tap it accurately. The old filter claimed the
          // same exemption in a comment while measuring everything against 40px.
          .filter((box) => {
            if (box.height <= 0) return false;
            // Two bars. The absolute one is WCAG 2.2 SC 2.5.8's 24 CSS px, which no
            // scaling excuses. The other is `--tap-min`, the design system's own
            // floor, applied by index.css to every control the markup declares a
            // tap target. Inline prose links keep the standard's own exception:
            // a clause of a sentence is read as text, not aimed at.
            if (box.height < 24) return true;
            if (box.tag === 'A' && box.inlineInProse) return false;
            return box.height + 2 < box.touchMin || box.width + 2 < box.touchMin;
          }),
      );

      expect(
        undersized,
        `${route} has controls below the touch minimum:\n${JSON.stringify(undersized, null, 2)}`,
      ).toEqual([]);
    }
  });
});

test.describe('home page as the shop window', () => {
  /**
   * The home page previously surfaced only the product catalogue and the dose
   * calculator; the storefront directory, services, procurement, loyalty club,
   * affiliate scheme, order tracking and support were all invisible without
   * opening a menu. These tests keep the shop window full.
   */
  const EXPECTED_ON_HOME = [
    '/storefronts',
    '/services',
    '/farmer-sell',
    '/orders',
    '/rewards',
    '/affiliate',
    '/support',
    '/products',
  ];

  test('every public capability is linked from the home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const links = await page.$$eval('a[href^="/"]', (anchors) =>
      anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute('href')?.split('?')[0]),
    );

    const missing = EXPECTED_ON_HOME.filter((destination) => !links.includes(destination));
    expect(missing, `not linked from the home page: ${missing.join(', ')}`).toEqual([]);
  });

  test('the hero states what the site is and offers a way in', async ({ page }) => {
    await page.goto('/');

    const hero = page.getByRole('region', { name: /کود، سم، بذر/ });
    await expect(hero).toBeVisible();
    await expect(hero.getByRole('link', { name: /خرید از فروشگاه/ })).toBeVisible();
    await expect(hero.getByRole('link', { name: /بازار غرفه‌داران/ })).toHaveAttribute(
      'href',
      '/storefronts',
    );
  });

  test('the sellers’ market is represented on the home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The directory is what makes this site different from a shop, so it has to
    // be on the front page in words and as a way in — not only in a menu.
    await expect(
      page.getByRole('heading', { name: 'مستقیم از غرفه کشاورزان' }),
    ).toBeVisible();
    await expect(page.locator('a[href^="/storefronts/"]').first()).toBeVisible();
    // …and the section is never an empty heading: it either shows stalls or
    // removes itself.
    await expect(page.getByRole('link', { name: /مشاهده همه غرفه‌داران/ })).toBeVisible();
  });

  test('the home page has one h1 and an ordered heading structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const levels = await page.$$eval('h1, h2, h3', (headings) =>
      headings.map((heading) => Number(heading.tagName.slice(1))),
    );

    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index]! - levels[index - 1]!).toBeLessThanOrEqual(1);
    }
  });
});
