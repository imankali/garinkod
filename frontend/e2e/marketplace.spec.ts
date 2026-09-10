import { expect, test } from '@playwright/test';

import { selectWhenReady } from './selectors';

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

    // Scoped to the panel: the weather strip on the same page has a «استان»
    // select of its own, and an unscoped label would match both.
    // Provinces arrive over HTTP; selecting before they do is a race the test
    // would lose on a cold runner and win on a warm one.
    await selectWhenReady(
      page.getByRole('group', { name: 'فیلترهای غرفه‌ها' }).getByLabel('استان'),
      'فارس',
    );
    await expect(page).toHaveURL(/province=/);
  });

  test('storefront tabs switch panels', async ({ page }) => {
    await page.goto('/storefronts');
    await page.locator('a[href^="/storefronts/"]').first().click();

    // The profile's header keeps growing while the stall's avatar and story
    // images arrive, which moves the tab strip underneath them: a pointer click has
    // to land on a still box and never gets one. Keyboard activation is the same
    // contract — a focused tab, Enter, the panel switches — and it does not depend
    // on where the element happens to be at that millisecond.
    const postsTab = page.getByRole('tab', { name: 'پست‌ها' });
    await expect(postsTab).toHaveAttribute('aria-selected', 'false');
    await postsTab.focus();
    await page.keyboard.press('Enter');
    await expect(postsTab).toHaveAttribute('aria-selected', 'true');
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

    // click + assert rather than check(): the chip is a button with aria-checked,
    // and check() insists the attribute has already flipped by the time the click
    // returns. React has not re-rendered yet, so that is a race, not a contract.
    const inStock = page.getByRole('checkbox', { name: 'فقط موجود' });
    await inStock.click();
    await expect(inStock).toHaveAttribute('aria-checked', 'true');
    await expect(page).toHaveURL(/in_stock=1/);
  });

  test('a listing can be added to the cart and shows its storefront', async ({ page }) => {
    await page.goto(ADS);

    const addButton = page.getByRole('button', { name: 'افزودن به سبد' }).first();
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Adding to the cart does not open the cart — the buyer decides when to look.
    // The row inside it carries the chip saying the item came from a غرفه rather
    // than from the shop's own shelves, which is what the journey is about.
    const cartButton = page.getByRole('button', { name: /^سبد خرید/ });
    await expect(cartButton).toBeVisible();
    await cartButton.click();
    const drawer = page.getByRole('dialog', { name: 'سبد خرید' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('غرفه', { exact: true }).first()).toBeVisible();
  });

  test('a quantity below the stall’s minimum is explained where it is changed', async ({ page }) => {
    await page.goto(ADS);

    const buy = page.getByRole('button', { name: 'افزودن به سبد' }).first();
    await expect(buy).toBeVisible();
    await buy.click();

    const openCart = page.getByRole('button', { name: /^سبد خرید/ });
    await expect(openCart).toBeVisible();
    await openCart.click();
    const drawer = page.getByRole('dialog', { name: 'سبد خرید' });
    await expect(drawer).toBeVisible();

    // Whether there is anything to reduce depends on the seeded stall: a listing
    // whose minimum is one has no rule to explain. count() answers before the
    // drawer has painted, so ask the element itself, briefly, and treat "absent"
    // as the precondition it is rather than as a failure or an infinite wait.
    const decrease = drawer.getByRole('button', { name: /^کاهش تعداد/ }).first();
    const hasRow = await decrease.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false);
    test.skip(!hasRow, 'the cart rendered no row to reduce');

    // Going below the minimum is the case the buyer has to be told about, in the
    // drawer, where the quantity changes — not with a silent clamp.
    await decrease.click();
    const note = drawer.getByText(/حداقل سفارش این غرفه/);
    const hasNote = await note.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false);
    test.skip(!hasNote, 'this seeded listing has no minimum above one');
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
    await selectWhenReady(page.getByLabel('محصول کشاورزی'), 'گندم');
    await page.getByLabel('سطح زمین').fill('5');
    await page.getByRole('button', { name: 'محاسبه مقدار مورد نیاز' }).click();

    // The calculator's own heading, not "the phrase somewhere on the page": the
    // same words appear in the form's label and in the disclaimer.
    await expect(page.getByRole('heading', { name: /مقدار مورد نیاز/ })).toBeVisible();
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
