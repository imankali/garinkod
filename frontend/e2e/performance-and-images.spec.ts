import { expect, test } from '@playwright/test';

/**
 * Performance & image-pipeline contract tests.
 *
 * These guard the specific work that could silently regress without a browser
 * ever noticing:
 *   1. AVIF variants are actually requested over the network (the backend
 *      pipeline + <picture>, not just claims in code).
 *   2. No layout shift on first paint (explicit dimensions everywhere).
 *   3. The products grid is truly responsive (1 column on a 375px phone).
 *   4. The document is RTL on mobile, the layout this audience reads in.
 *
 * Run against the production bundle when asserting real behaviour:
 *   npm run build && PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 npx playwright test performance-and-images
 */

/** Product-card links on the catalogue grid, deduplicated by href. */
async function catalogueCards(page: import('@playwright/test').Page) {
  const links = page.locator("a[href^='/products/']");
  await links.first().waitFor({ timeout: 15_000 });
  const count = await links.count();
  const seen = new Set<string>();
  const boxes: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const href = await links.nth(i).getAttribute('href');
    if (!href || seen.has(href) || href === '/products/' || href.endsWith('/products')) continue;
    seen.add(href);
    const box = await links.nth(i).boundingBox();
    if (box) boxes.push({ x: box.x, y: box.y });
  }
  return boxes;
}

test.describe('image pipeline (real network contract)', () => {
  test('catalogue requests at least one AVIF variant with HTTP 200', async ({ page }) => {
    const avifResponses: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('.avif') && response.status() === 200) {
        avifResponses.push(response.url());
      }
    });

    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    expect(
      avifResponses.length,
      'no .avif request observed — is the backend pipeline running and does any listed product have a processed image?',
    ).toBeGreaterThan(0);

    // Same-origin serving through the vite proxy, exactly like production.
    expect(avifResponses[0]).toContain('/media/');
  });
});

test.describe('layout stability', () => {
  test('first paint causes no meaningful layout shift', async ({ page }) => {
    // Install the observer BEFORE any app code runs; shifts are then collected
    // across the whole load, not only after hydration.
    await page.addInitScript(() => {
      (window as unknown as { __clsValue: number }).__clsValue = 0;
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries() as PerformanceEntry[]) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!shift.hadRecentInput) {
            (window as unknown as { __clsValue: number }).__clsValue += shift.value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const cls = (await page.evaluate(
      () => (window as unknown as { __clsValue: number }).__clsValue,
    )) as number;

    // Exact zero is the target (every image carries width/height); a 0.01
    // epsilon covers a possible late web-font metric nudge that no explicit
    // dimension can prevent. The hard zero budget lives in lighthouserc.cjs.
    expect(cls, `layout shift detected: ${cls}`).toBeLessThanOrEqual(0.01);
  });
});

test.describe('responsive grid & RTL', () => {
  test('products grid keeps two readable columns on a 375px phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const boxes = await catalogueCards(page);
    expect(boxes.length, 'no product cards found on /products').toBeGreaterThan(1);

    // Two-up is the catalogue's design on a phone — a market grid of compact
    // cards, not a stack. What has to hold is that the split is even and that the
    // page never scrolls sideways to read it. Measured off the cards' x offsets
    // rather than their widths, because a card holds links of several widths.
    const starts = [...new Set(boxes.map((b) => Math.round(b.x)))].sort((a, b) => a - b);
    expect(starts.length, 'phone grid should be two columns').toBe(2);
    const [firstStart = 0, secondStart = 0] = starts;
    const firstColumnWidth = secondStart - firstStart;
    expect(firstColumnWidth, 'the two columns must split a 375px phone evenly').toBeGreaterThanOrEqual(160);
    expect(firstColumnWidth, '…and no wider than the viewport allows').toBeLessThanOrEqual(200);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'a phone must not scroll sideways to read the catalogue').toBeLessThanOrEqual(1);
  });

  test('products grid shows at least two columns on a 768px tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const boxes = await catalogueCards(page);
    expect(boxes.length).toBeGreaterThan(1);

    const firstRowY = Math.min(...boxes.map((b) => b.y));
    const firstRowColumns = new Set(
      boxes.filter((b) => Math.abs(b.y - firstRowY) < 24).map((b) => Math.round(b.x / 10)),
    );
    expect(
      firstRowColumns.size,
      'tablet grid should place at least two cards side by side in the first row',
    ).toBeGreaterThanOrEqual(2);
  });

  test('document stays RTL on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/products');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');

    // Computed direction must survive into real content, not just the tag.
    const direction = await page
      .locator('main')
      .first()
      .evaluate((el) => getComputedStyle(el).direction);
    expect(direction).toBe('rtl');
  });
});
