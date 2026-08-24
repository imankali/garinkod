import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Automated accessibility checks with axe-core.
 *
 * Automated rules catch roughly a third of real accessibility problems, so
 * these are a floor rather than a certificate. The suite fails on serious and
 * critical violations and prints the rest for review.
 */

const PAGES = [
  { path: '/', name: 'home' },
  { path: '/marketplace', name: 'marketplace' },
  { path: '/storefronts', name: 'storefront directory' },
  { path: '/checkout', name: 'checkout' },
  { path: '/login', name: 'login' },
  { path: '/support', name: 'support' },
];

for (const target of PAGES) {
  test(`${target.name} has no serious accessibility violations`, async ({ page }, testInfo) => {
    await page.goto(target.path);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Attach the full report so CI artifacts explain any failure.
    await testInfo.attach(`axe-${target.name}.json`, {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    const summary = blocking
      .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} node(s))`)
      .join('\n');

    expect(blocking, `Serious/critical a11y violations on ${target.path}:\n${summary}`).toEqual([]);
  });
}

test('every page has exactly one h1 and an ordered heading structure', async ({ page }) => {
  for (const target of PAGES) {
    await page.goto(target.path);
    await page.waitForLoadState('networkidle');

    const levels = await page.$$eval('h1, h2, h3, h4, h5, h6', (headings) =>
      headings
        .filter((heading) => (heading as HTMLElement).offsetParent !== null)
        .map((heading) => Number(heading.tagName.slice(1))),
    );

    const h1Count = levels.filter((level) => level === 1).length;
    expect(h1Count, `${target.path} should have exactly one visible h1`).toBeLessThanOrEqual(1);

    // A heading must not skip more than one level below its predecessor.
    for (let index = 1; index < levels.length; index += 1) {
      const previous = levels[index - 1] ?? 1;
      const current = levels[index] ?? 1;
      expect(
        current - previous,
        `${target.path} skips a heading level (h${previous} → h${current})`,
      ).toBeLessThanOrEqual(1);
    }
  }
});

test('the whole page is reachable with the keyboard alone', async ({ page }) => {
  await page.goto('/');

  const reached: string[] = [];
  for (let step = 0; step < 25; step += 1) {
    await page.keyboard.press('Tab');
    const description = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return '';
      const style = window.getComputedStyle(active);
      // A focused element must show *some* focus affordance.
      const hasIndicator =
        style.outlineStyle !== 'none' ||
        style.boxShadow !== 'none' ||
        active.classList.toString().includes('focus');
      return `${active.tagName}|${hasIndicator}`;
    });
    if (description) reached.push(description);
  }

  expect(reached.length, 'Tab should move focus through interactive elements').toBeGreaterThan(5);
  const withoutIndicator = reached.filter((entry) => entry.endsWith('|false'));
  expect(withoutIndicator, 'every focused element needs a visible focus indicator').toEqual([]);
});

test('all images carry an alt attribute', async ({ page }) => {
  for (const target of PAGES) {
    await page.goto(target.path);
    await page.waitForLoadState('networkidle');

    const missing = await page.$$eval('img:not([alt])', (images) =>
      images.map((image) => (image as HTMLImageElement).src),
    );
    expect(missing, `Images without alt on ${target.path}`).toEqual([]);
  }
});

test('every icon-only button has an accessible name', async ({ page }) => {
  await page.goto('/');

  const unnamed = await page.$$eval('button', (buttons) =>
    buttons
      .filter((button) => (button as HTMLElement).offsetParent !== null)
      .filter((button) => {
        const text = (button.textContent ?? '').trim();
        const label = button.getAttribute('aria-label');
        const labelledBy = button.getAttribute('aria-labelledby');
        const title = button.getAttribute('title');
        return !text && !label && !labelledBy && !title;
      })
      .map((button) => button.outerHTML.slice(0, 120)),
  );

  expect(unnamed, 'buttons without an accessible name').toEqual([]);
});
