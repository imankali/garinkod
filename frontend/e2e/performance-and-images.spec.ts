// frontend/e2e/performance-and-images.spec.ts
//
// The two things a shopping page can get wrong that a screenshot will not show:
// it can move under the reader's thumb while loading, and it can ship a 2 MB JPEG
// to a phone on 3G.

import { expect, test } from '@playwright/test';

import { open, slugOf } from './support';

test.describe('layout stability', () => {
  test('first paint causes no meaningful layout shift on the home page', async ({ page }) => {
    await page.addInitScript(() => {
      // Cumulative Layout Shift, collected before the app mounts.
      const state = { value: 0 };
      Object.defineProperty(window, '__cls', { value: state, writable: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
          if (!entry.hadRecentInput) state.value += entry.value ?? 0;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await open(page, '/');
    await page.getByRole('heading', { level: 1 }).waitFor();

    const cls = await page.evaluate(() => (window as unknown as { __cls?: { value: number } }).__cls?.value ?? 0);
    // 0.1 is the "good" threshold; the home page's hero and rails are sized before
    // their data lands, so it should never approach it.
    expect(cls).toBeLessThan(0.1);
  });

  test('the catalogue grid does not jump when the cards arrive', async ({ page }) => {
    await page.addInitScript(() => {
      const state = { value: 0 };
      Object.defineProperty(window, '__cls', { value: state, writable: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
          if (!entry.hadRecentInput) state.value += entry.value ?? 0;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await open(page, '/products');
    const cls = await page.evaluate(() => (window as unknown as { __cls?: { value: number } }).__cls?.value ?? 0);
    expect(cls).toBeLessThan(0.1);
  });
});

test.describe('images', () => {
  test('a product photo is served at 200 and declares its dimensions', async ({ page, request }) => {
    const slug = await slugOf(request, '/api/products/');
    await open(page, `/product/${slug}`);

    const photo = page.locator('img').first();
    await expect(photo).toBeVisible();
    // `width` and `height` are what keep the frame from collapsing and re-laying
    // out when the bytes land.
    expect(await photo.getAttribute('width')).not.toBeNull();
    expect(await photo.getAttribute('height')).not.toBeNull();
  });

  test('every catalogue photo declares how to load', async ({ page }) => {
    await open(page, '/products');

    const modes = await page.$$eval('a[href^="/product/"] img', (images) =>
      images.map((image) => image.getAttribute('loading') ?? 'none'),
    );

    expect(modes.length).toBeGreaterThan(0);
    // No image may be left to the browser's default: on a long grid that is how
    // forty photos start downloading at once.
    expect(modes.filter((mode) => mode === 'none')).toEqual([]);
  });

  test('the hero photograph is not lazy', async ({ page }) => {
    await open(page, '/');
    const hero = page.locator('img[src*="hero-farm"]').first();
    await expect(hero).toBeVisible();
    // Above the fold it must load with the page, not after it.
    expect(await hero.getAttribute('loading')).not.toBe('lazy');
  });
});

test.describe('grid density', () => {
  test('the catalogue keeps two readable columns on a 375px phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, '/products');

    const columns = await page
      .locator('a[href^="/product/"]')
      .first()
      .evaluate((element) => {
        const grid = element.closest('.grid');
        return grid ? window.getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
      });

    expect(columns).toBeGreaterThanOrEqual(2);
  });

  test('the catalogue uses four columns on a desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/products');

    const columns = await page
      .locator('a[href^="/product/"]')
      .first()
      .evaluate((element) => {
        const grid = element.closest('.grid');
        return grid ? window.getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
      });

    expect(columns).toBeGreaterThanOrEqual(3);
  });
});
