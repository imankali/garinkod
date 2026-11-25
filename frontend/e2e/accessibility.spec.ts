// frontend/e2e/accessibility.spec.ts
//
// axe-core over the pages the rebuild introduced.
//
// Automated rules catch roughly a third of real accessibility problems, so this
// is a floor rather than a certificate: the suite fails on `serious` and
// `critical` findings and reports the rest.
//
// The contrast ceiling that used to live here is gone with the palette that
// caused it. The new tokens are re-inked (ink #14231b on cream #f6f8f3 is
// 14.6:1, brand-700 #15803d on white is 4.9:1, ink-mute #64776b on paper is
// 4.6:1), so contrast is now a blocking rule like every other one — if it
// regresses, that is a defect and not a number to raise.

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { open, slugOf } from './support';

test.describe('axe', () => {
  test('the home page has no serious violations', async ({ page }) => {
    await open(page, '/');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const blocking = results.violations.filter((rule) => rule.impact === 'serious' || rule.impact === 'critical');
    expect(blocking.map((rule) => `${rule.id}: ${rule.nodes.length} node(s)`)).toEqual([]);
  });

  test('the catalogue has no serious violations', async ({ page }) => {
    await open(page, '/products');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const blocking = results.violations.filter((rule) => rule.impact === 'serious' || rule.impact === 'critical');
    expect(blocking.map((rule) => `${rule.id}: ${rule.nodes.length} node(s)`)).toEqual([]);
  });

  test('a product page has no serious violations', async ({ page, request }) => {
    const slug = await slugOf(request, '/api/products/');
    await open(page, `/product/${slug}`);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const blocking = results.violations.filter((rule) => rule.impact === 'serious' || rule.impact === 'critical');
    expect(blocking.map((rule) => `${rule.id}: ${rule.nodes.length} node(s)`)).toEqual([]);
  });

  test('the sign-in page has no serious violations', async ({ page }) => {
    await open(page, '/login');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const blocking = results.violations.filter((rule) => rule.impact === 'serious' || rule.impact === 'critical');
    expect(blocking.map((rule) => `${rule.id}: ${rule.nodes.length} node(s)`)).toEqual([]);
  });
});

test.describe('document shape', () => {
  test('the home page has one h1 and never skips a level', async ({ page }) => {
    await open(page, '/');

    const levels = await page.$$eval('h1, h2, h3, h4', (headings) =>
      headings.map((heading) => Number(heading.tagName.slice(1))),
    );

    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index]! - levels[index - 1]!).toBeLessThanOrEqual(1);
    }
  });

  test('all images carry an alt attribute', async ({ page }) => {
    await open(page, '/products');
    const missing = await page.$$eval('img', (images) => images.filter((image) => !image.hasAttribute('alt')).length);
    expect(missing).toBe(0);
  });

  test('every icon-only control has an accessible name', async ({ page }) => {
    await open(page, '/');

    const unnamed = await page.$$eval('button', (buttons) =>
      buttons
        .filter((button) => (button.textContent ?? '').trim().length === 0)
        .filter((button) => !button.getAttribute('aria-label') && !button.getAttribute('aria-labelledby'))
        .map((button) => button.outerHTML.slice(0, 120)),
    );

    expect(unnamed).toEqual([]);
  });
});
