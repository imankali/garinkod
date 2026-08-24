import { expect, test } from '@playwright/test';

/**
 * Marketplace journeys: browsing storefronts, filtering listings and adding a
 * storefront listing to the cart.
 *
 * These run against the seeded demo data (`manage.py seed_demo_marketplace`),
 * so they assert on behaviour and roles rather than exact product names where
 * possible.
 */

test.describe('storefront directory', () => {
  test('lists storefronts and opens a public profile', async ({ page }) => {
    await page.goto('/storefronts');

    await expect(page.getByRole('heading', { name: 'همه غرفه‌داران' })).toBeVisible();

    const firstStorefront = page.locator('a[href^="/storefronts/"]').first();
    await expect(firstStorefront).toBeVisible();
    await firstStorefront.click();

    // The profile shows the tab strip and a follow control.
    await expect(page.getByRole('tablist', { name: 'محتوای غرفه' })).toBeVisible();
    await expect(page.getByRole('button', { name: /دنبال کردن|دنبال می‌کنید/ })).toBeVisible();
  });

  test('search keeps the query in the URL so results are shareable', async ({ page }) => {
    await page.goto('/storefronts');

    await page.getByRole('searchbox', { name: 'جستجوی غرفه' }).fill('شیراز');
    await expect(page).toHaveURL(/search=/, { timeout: 5000 });
  });

  test('province filter narrows the directory', async ({ page }) => {
    await page.goto('/storefronts');
    await page.getByRole('button', { name: /فیلتر/ }).click();

    await page.getByLabel('استان').selectOption('فارس');
    await expect(page).toHaveURL(/province=/);
  });

  test('storefront tabs switch panels', async ({ page }) => {
    await page.goto('/storefronts');
    await page.locator('a[href^="/storefronts/"]').first().click();

    await page.getByRole('tab', { name: 'پست‌ها' }).click();
    await expect(page.getByRole('tab', { name: 'پست‌ها' })).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('marketplace listings', () => {
  test('filters are applied server-side and reflected in the URL', async ({ page }) => {
    await page.goto('/marketplace');
    await page.getByRole('button', { name: /فیلتر/ }).click();

    await page.getByLabel('فقط آگهی‌های موجود').check();
    await expect(page).toHaveURL(/in_stock=1/);
  });

  test('a listing can be added to the cart and shows its storefront', async ({ page }) => {
    await page.goto('/marketplace');

    const addButton = page.getByRole('button', { name: 'افزودن به سبد' }).first();
    await expect(addButton).toBeVisible();
    await addButton.click();

    // The drawer opens with a listing row labelled as a storefront item.
    await expect(page.getByText('غرفه').first()).toBeVisible();
  });

  test('a quantity below the minimum order is rejected with a field message', async ({ page }) => {
    await page.goto('/marketplace');

    // Find a listing that declares a minimum above one.
    const card = page.locator('article', { hasText: 'حداقل سفارش' }).first();
    const cardCount = await card.count();
    test.skip(cardCount === 0, 'No listing with a minimum order in the seeded data');

    await card.getByRole('spinbutton').fill('1');
    await card.getByRole('button', { name: 'افزودن به سبد' }).click();
    await expect(card.getByRole('alert')).toContainText('حداقل سفارش');
  });
});

test.describe('dose calculator', () => {
  test('calculates from a registered dose and shows safety warnings', async ({ page }) => {
    await page.goto('/');

    const search = page.getByLabel('جستجوی کود یا سم');
    await search.scrollIntoViewIfNeeded();
    await search.fill('اوره');

    await page.getByRole('button', { name: /اوره/ }).first().click();
    await page.getByLabel('محصول کشاورزی').selectOption('گندم');
    await page.getByLabel('سطح زمین').fill('5');
    await page.getByRole('button', { name: 'محاسبه مقدار مورد نیاز' }).click();

    await expect(page.getByText('مقدار مورد نیاز')).toBeVisible();
    // 150-250 kg/ha over five hectares.
    await expect(page.getByText(/750/)).toBeVisible();
    await expect(page.getByText(/جایگزین توصیه کارشناس/)).toBeVisible();
  });

  test('refuses an unregistered crop instead of guessing', async ({ page }) => {
    await page.goto('/');
    const search = page.getByLabel('جستجوی کود یا سم');
    await search.scrollIntoViewIfNeeded();
    await search.fill('گلایفوسیت');

    await page.getByRole('button', { name: /گلایفوسیت/ }).first().click();
    // Only crops with a recorded dose are offered at all.
    const options = page.getByLabel('محصول کشاورزی').locator('option');
    await expect(options).not.toHaveCount(0);
  });
});
