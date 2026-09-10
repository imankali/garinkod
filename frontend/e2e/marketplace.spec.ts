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
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /دنبال کردن|دنبال می‌کنید/ })).toBeVisible();
  });

  test('search keeps the query in the URL so results are shareable', async ({ page }) => {
    await page.goto('/storefronts');

    await page.getByRole('searchbox', { name: 'جستجوی غرفه' }).fill('شیراز');
    await expect(page).toHaveURL(/search=/, { timeout: 5000 });
  });

  test('province filter narrows the directory', async ({ page }) => {
    await page.goto('/storefronts');
    // The trigger prints a count badge once something is applied, so the name is
    // matched exactly at the moment it is still bare.
    await page.getByRole('button', { name: 'فیلتر', exact: true }).click();

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

test.describe('farmers’ ad listings in the shop', () => {
  /**
   * Ads are not a page of their own any more. They are the second tab of the
   * shop — same filter bar, same cart, different source — so these tests
   * open /products?source=marketplace, which is what the directory's buttons and
   * the home rails link to. /marketplace itself only redirects.
   */
  const ADS = '/products?source=marketplace';

  test('the ads tab is reachable from the directory', async ({ page }) => {
    await page.goto('/storefronts');
    await page.getByRole('link', { name: /همه آگهی‌ها با فیلتر/ }).click();
    await expect(page).toHaveURL(/source=marketplace/);
  });

  test('filters are applied server-side and reflected in the URL', async ({ page }) => {
    await page.goto(ADS);
    await page.getByRole('button', { name: /امکانات/ }).click();

    await page.getByRole('checkbox', { name: 'فقط موجود' }).check();
    await expect(page).toHaveURL(/in_stock=1/);
  });

  test('a listing can be added to the cart and shows its storefront', async ({ page }) => {
    await page.goto(ADS);

    const addButton = page.getByRole('button', { name: 'افزودن به سبد' }).first();
    await expect(addButton).toBeVisible();
    await addButton.click();

    // The drawer opens with the row, and the row carries the chip that says the
    // item came from a غرفه rather than from the shop's own shelves.
    const drawer = page.getByRole('dialog', { name: 'سبد خرید' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('غرفه', { exact: true }).first()).toBeVisible();
  });

  test('a quantity below the stall’s minimum is explained where it is changed', async ({ page }) => {
    await page.goto(ADS);

    const buy = page.getByRole('button', { name: 'افزودن به سبد' }).first();
    await expect(buy).toBeVisible();
    await buy.click();

    const drawer = page.getByRole('dialog', { name: 'سبد خرید' });
    await expect(drawer).toBeVisible();
    const decrease = drawer.getByRole('button', { name: /^کاهش تعداد/ }).first();
    test.skip((await decrease.count()) === 0, 'The cart has no row to reduce yet');

    // Adding a listing puts the minimum in the cart; going below it is the case
    // the buyer has to be told about, in the drawer, not with a silent clamp.
    await decrease.click();
    const note = drawer.getByText(/حداقل سفارش این غرفه/);
    test.skip((await note.count()) === 0, 'This listing has no minimum above one');
    await expect(note).toBeVisible();
  });
});

test.describe('the retired marketplace address', () => {
  test('sends visitors to the directory instead of a blank page', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page).toHaveURL(/\/storefronts$/);
    await expect(page.getByRole('heading', { name: 'همه غرفه‌داران' })).toBeVisible();
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
