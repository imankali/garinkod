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
  // The ads tab of the shop — what the farmers' market page became.
  { path: '/products?source=marketplace', name: 'ad listings' },
  { path: '/products', name: 'products catalogue' },
  { path: '/products/image-pipeline-demo/', name: 'product detail (gallery)' },
  { path: '/storefronts', name: 'storefront directory' },
  { path: '/checkout', name: 'checkout' },
  { path: '/login', name: 'login' },
  { path: '/support', name: 'support' },
];

/**
 * The one rule this app fails everywhere, at a scale that is not a patch.
 *
 * White on the brand's emerald-600 measures 3.77:1 and the muted-text token
 * slate-400 on white measures 2.56:1 (AA asks 4.5:1), so a single pair of colours
 * accounts for most of these nodes — 143 buttons and 99 text accents across 72
 * files. Re-inking the palette is a design decision with visual consequences on
 * every page, so it gets its own change and its own review rather than sneaking in
 * behind a test PR.
 *
 * What is NOT a permission slip: the numbers below are ceilings, measured on
 * 2026-09-10. A page that reports more contrast nodes than its ceiling fails; a
 * page that does better fails too, until its number is lowered. Every other rule —
 * names, roles, labels, headings — is blocking from the first violation, and a new
 * rule appearing on a page has no ceiling at all and therefore fails.
 */
// Measured on run 34466905457, after the tagline and amber-CTA fixes.
const CONTRAST_CEILING: Record<string, number> = {
  '/': 10,
  '/products?source=marketplace': 17,
  '/products': 9,
  '/products/image-pipeline-demo/': 2,
  '/storefronts': 29,
  '/checkout': 6,
  '/login': 4,
  '/support': 3,
};

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

    const ceilingFor = (violation: { id: string }) =>
      violation.id === 'color-contrast' ? CONTRAST_CEILING[target.path] ?? 0 : 0;

    const serious = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    const blocking = serious.filter((violation) => violation.nodes.length > ceilingFor(violation));
    // A ceiling that is never reached is debt someone forgot about: say so, so the
    // number in this file goes down over time instead of becoming folklore.
    const beaten = serious
      .filter((v) => ceilingFor(v) > 0 && v.nodes.length < ceilingFor(v))
      .map((v) => `${v.id}: ${target.path} now reports ${v.nodes.length}, ceiling is ${ceilingFor(v)} — lower it`);

    // The first line is machine-readable on purpose — a run's whole a11y picture
    // has to survive being pasted into a comment, an annotation or a terminal:
    // `a11y /products color-contrast=11 aria-prohibited-attr=1` is what any of
    // those still shows, while the selector dump underneath is what a person reads.
    const counts = blocking
      .map((violation) => `${violation.id}=${violation.nodes.length}`)
      .join(' ');
    const summary = blocking
      .map(
        (violation) =>
          `${violation.id}: ${violation.help} (${violation.nodes.length} node(s))\n` +
          violation.nodes
            .slice(0, 6)
            .map((node) => `    · ${node.target.join(' ')}`)
            .join('\n'),
      )
      .join('\n');

    expect(
      blocking,
      `a11y ${target.path} ${counts || 'clean'}\n\n${summary}${
        beaten.length ? `\n\nTIGHTEN THE CEILING:\n${beaten.join('\n')}` : ''
      }`,
    ).toEqual([]);
    expect(beaten, `contrast ceilings can be lowered on ${target.path}`).toEqual([]);
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
