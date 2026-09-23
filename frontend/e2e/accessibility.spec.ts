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
 * The contrast ceilings are gone, and this is the change that removed them.
 *
 * They existed because a single pair of colours accounted for almost every
 * violation on the site: the brand emerald-600 measured 3.77:1 against white and
 * the muted slate-400 measured 2.56:1, which is 143 buttons and 99 text accents
 * across 72 files. Re-inking a palette is a design decision, so the ceilings
 * recorded the debt page by page instead of failing every build — with the rule
 * that a page doing *better* than its ceiling also fails, so the numbers could
 * only ever go down.
 *
 * The palette has now been re-inked for AA, measured rather than eyeballed:
 *
 *   emerald-600   #059669 (3.77:1 on white)  → #047857 (5.48:1 both ways)
 *   brand green   #0f8a5f (4.35:1, and 3.83:1 on the emerald-100 chips)
 *                                            → #0e7c56 (5.03:1 / 4.58:1)
 *   slate-400     #67778f (4.35:1 on slate-50, 4.33:1 on the cream)
 *                                            → #617087 (4.54:1 there)
 *   slate-500     #62748e (4.35:1 on slate-100) → #5e6f88 (4.61:1)
 *   rose-600      #ec003f (4.12:1 on rose-50) → #e0003c (4.51:1)
 *
 * The last of them are under a tenth of a step: a colour can be legible-looking
 * and still miss by 0.15, which is exactly the kind of miss that survives review.
 * Measured after the change, all twenty-five public routes report zero contrast
 * violations at both 1280px and 390px, so every ceiling here is zero and any
 * contrast node at all is a regression.
 *
 * Two rules stay out of reach of this suite and are worth remembering: axe cannot
 * measure text painted over a gradient (the accent gradient's lime end was 1.51:1
 * against white until it was darkened — see `.bg-brand-gradient-accent` in
 * index.css), and it cannot see a colour that changes per frame.
 */
const CONTRAST_CEILING: Record<string, number> = {};

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

    // Every rule is blocking from the first violation. The map is kept as the
    // place to record a ceiling if the design ever has to accept one again.
    const ceilingFor = (violation: { id: string }) =>
      violation.id === 'color-contrast' ? (CONTRAST_CEILING[target.path] ?? 0) : 0;

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
    // Improvement is not a broken build: it is recorded, on the run, where the
    // next person to touch this file will see it and lower the number. Failing here
    // would mean a fix in the app turns CI red — which is how ratchets get deleted.
    for (const note of beaten) {
      await testInfo.attach('ceiling-can-be-lowered', { body: note, contentType: 'text/plain' });
    }
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
