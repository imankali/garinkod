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

test.describe('the sticky header', () => {
  /**
   * The header collapses its aux rows (top strip, nav) on scroll-down and brings
   * them back on scroll-up. Collapsing removes ~130px from a sticky header that
   * sits in the normal flow, so the document reflows — and the browser answers a
   * reflow by moving the scroll offset to hold the content below still. That
   * answer arrives as an ordinary scroll event running the other way, so a header
   * that took its direction from the scroll offset took its own echo for the
   * reader changing their mind: it flipped back, reflowed, was answered again,
   * and the two argued several times a second.
   *
   * Measured over four seconds in which nothing was touched: 37 different header
   * heights and 35 different scroll positions, at every breakpoint and in both
   * motion modes — and, because a reflow cancels a scroll in flight, a page that
   * would not come back to the top when asked. None of that is visible to jsdom,
   * which has no layout and no scroll anchoring, so it is pinned here.
   */
  test.use({ viewport: { width: 1280, height: 900 } });
  // The suite default is `reducedMotion: 'reduce'`, so that hover and tap
  // animations stop fighting Playwright for stability. This block opts out per
  // page: the twitch lives in the 250ms row animation, and with motion reduced
  // the rows appear and disappear instantly — precisely the case that does not
  // reproduce it. The default most visitors get is the one tested here.

  test('settles after a scroll instead of oscillating', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const header = page.locator('#site-header').first();
    await page.mouse.move(640, 500);
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(1200);

    // An in-page jump — an anchor link, a route change — moves the page without
    // touching the header, exactly as the browser's own compensation does. Under
    // the old logic this is what sent the two of them into a loop.
    await page.evaluate(() => window.scrollTo(0, 340));

    const heights: number[] = [];
    for (let sample = 0; sample < 12; sample += 1) {
      heights.push(
        await header.evaluate((element) => Math.round(element.getBoundingClientRect().height)),
      );
      await page.waitForTimeout(100);
    }

    expect(
      new Set(heights).size,
      `the header changed height while the page was still: ${heights.join(' → ')}`,
    ).toBe(1);
  });

  test('still collapses on the way down and returns on the way up', async ({ page }) => {
    // The fix must not have "solved" the twitch by disabling the feature.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const header = page.locator('#site-header').first();
    const height = () => header.evaluate((element) => Math.round(element.getBoundingClientRect().height));

    const expanded = await height();

    await page.mouse.move(640, 500);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1200);
    const collapsed = await height();
    expect(collapsed, 'the header did not collapse on scroll-down').toBeLessThan(expanded);

    await page.mouse.wheel(0, -260);
    await page.waitForTimeout(1200);
    expect(await height(), 'the header did not come back on scroll-up').toBeGreaterThan(collapsed);
  });

  test('«بازگشت به بالا» arrives at the top', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.mouse.move(640, 500);
    for (let notch = 0; notch < 6; notch += 1) {
      await page.mouse.wheel(0, 220);
      await page.waitForTimeout(90);
    }
    await page.waitForTimeout(1500);

    // Dispatched rather than clicked: the button unmounts the moment the page
    // passes the 300px visibility threshold on the way up, which is a race
    // Playwright's actionability checks lose.
    await page
      .locator('button[aria-label="بازگشت به بالای صفحه"]')
      .dispatchEvent('click');

    await expect
      .poll(async () => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5000 })
      .toBe(0);
    await expect
      .poll(async () => header_height(page), { timeout: 5000 })
      .toBeGreaterThan(150);
  });
});

/** Height of a sticky header, whichever one the page happens to render. */
async function header_height(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() =>
    Math.round(document.getElementById('site-header')?.getBoundingClientRect().height ?? 0),
  );
}

test.describe('the search box', () => {
  /**
   * The header's own promise: scroll down and the field stays with you.
   *
   * On a phone the field used to live in a row *under* the pinned one, so
   * collapsing the header took the search with it and left logo, cart and menu —
   * the three things a reader who is already shopping does not need. It now sits
   * in the pinned row at every breakpoint, next to a submit button that runs it.
   *
   * Two fields are always in the DOM because the header chooses between them
   * with `md:` classes rather than by unmounting, so every assertion here is
   * about the *visible* one — the only kind that says anything about what a
   * reader sees.
   */
  const visibleField = (page: import('@playwright/test').Page) =>
    page.locator('#site-header input[aria-label="جستجوی محصولات"]:visible');

  for (const [name, viewport] of [
    ['desktop', { width: 1280, height: 900 }],
    ['phone', { width: 390, height: 844 }],
  ] as const) {
    test(`stays pinned while scrolling on ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(visibleField(page)).toHaveCount(1);

      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      for (let notch = 0; notch < 4; notch += 1) {
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(120);
      }
      await page.waitForTimeout(1200);

      // Still exactly one field in front of the reader, still usable.
      await expect(visibleField(page)).toHaveCount(1);
      await expect(visibleField(page)).toBeVisible();
      const width = await visibleField(page).evaluate((el) => el.getBoundingClientRect().width);
      expect(width, 'the pinned field is too narrow to search in').toBeGreaterThan(60);

      // …and on the way back up, when the rest of the header returns.
      await page.mouse.wheel(0, -260);
      await page.waitForTimeout(1200);
      await expect(visibleField(page)).toHaveCount(1);
      await expect(visibleField(page)).toBeVisible();
    });
  }

  test('the box is a field, a microphone and a search button — nothing else', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Both were removed by request: the scope selector («همه») and the funnel
    // button that opened a panel of filter chips.
    await expect(page.getByLabel('محدوده جستجو')).toHaveCount(0);
    await expect(page.getByLabel('فیلترهای پیشرفته')).toHaveCount(0);

    // The submit button took the funnel button's place in the row.
    const submit = page.locator('#site-header button[type="submit"]:visible');
    await expect(submit).toHaveCount(1);
    await expect(submit).toHaveAccessibleName('جستجو');
  });

  test('searching navigates to the results, and the filter lives there', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await visibleField(page).fill('اوره');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/products\?.*search=/);
    expect(new URL(page.url()).searchParams.get('search')).toBe('اوره');
    // No category in the URL: the box has no scope to contribute one.
    expect(new URL(page.url()).searchParams.get('category')).toBeNull();

    // Filtering still exists — on the results page, where it belongs.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
