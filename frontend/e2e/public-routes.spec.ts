// frontend/e2e/public-routes.spec.ts
//
// Every public route renders, names itself, and fails loudly rather than blankly.
//
// This runs in every browser project in `playwright.config.ts`, so it is also the
// cross-engine smoke test: a route that only works in Chromium is a route that is
// broken on somebody's phone.

import { expect, test } from '@playwright/test';

import { open, slugOf } from './support';

const PUBLIC_ROUTES = [
  '/',
  '/products',
  '/offers',
  '/storefronts',
  '/services',
  '/farmers',
  '/magazine',
  '/support',
  '/about',
  '/contact',
  '/legal',
  '/brands',
  '/track',
  '/login',
] as const;

test.describe('public routes', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} renders with one h1 and no crash`, async ({ page }) => {
      await open(page, route);

      await expect(page.locator('#root')).not.toBeEmpty();
      // The rebuilt site has no generic error copy; the boundary's own words are
      // the thing a crash would print.
      await expect(page.locator('text=این صفحه باز نشد')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page).toHaveTitle(/گرین‌کود/);
    });
  }

  test('the catalogue shows real cards that link to real products', async ({ page, request }) => {
    const slug = await slugOf(request, '/api/products/');
    await open(page, '/products');

    await expect(page.locator(`a[href="/product/${slug}"]`).first()).toBeVisible();
  });

  test('a product page opens from the catalogue and states its price', async ({ page, request }) => {
    const slug = await slugOf(request, '/api/products/');
    await open(page, `/product/${slug}`);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'مشخصات' })).toBeVisible();
    // Price or quote, never a blank: `price_on_request` products say «تماس بگیرید».
    await expect(page.getByText(/تومان|تماس بگیرید/).first()).toBeVisible();
  });

  test('a storefront opens and lists its own آگهی‌ها', async ({ page, request }) => {
    const slug = await slugOf(request, '/api/marketplace/storefronts/');
    await open(page, `/storefront/${slug}`);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'محصولات این غرفه' })).toBeVisible();
  });

  test('a signed-out storefront page offers login instead of a dead thread', async ({ page, request }) => {
    const slug = await slugOf(request, '/api/marketplace/storefronts/');
    await open(page, `/storefront/${slug}`);

    // The chat panel is for signed-in buyers; signed out, the same button is the
    // way in rather than a thread with nobody to reply to it.
    await expect(page.getByRole('link', { name: /گفتگو با غرفه/ })).toHaveAttribute('href', '/login');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('an آگهی page states the minimum order and the unit', async ({ page, request }) => {
    const slug = await slugOf(request, '/api/marketplace/listings/');
    await open(page, `/listing/${slug}`);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'شرایط فروش' })).toBeVisible();
    await expect(page.getByText('کمینهٔ سفارش')).toBeVisible();
  });

  test('an article opens from the magazine', async ({ page, request }) => {
    const slug = await slugOf(request, '/api/articles/');
    await open(page, `/magazine/${slug}`);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'مجله' })).toBeVisible();
  });

  test('the legal hub lists documents and each one reads in full', async ({ page }) => {
    await open(page, '/legal');

    const first = page.locator('a[href^="/legal/"]').first();
    await expect(first).toBeVisible();
    const href = await first.getAttribute('href');
    expect(href).toBeTruthy();

    await open(page, href!);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('nav[aria-label="اسناد"]')).toBeVisible();
  });

  test('a brand row in the index reaches the shop with that brand already filtered', async ({ page }) => {
    await open(page, '/brands');

    const brand = page.locator('a[href^="/products?brand_slug="]').first();
    await expect(brand).toBeVisible();
    const href = await brand.getAttribute('href');

    await open(page, href!);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The filter is announced, not silently applied.
    await expect(page.getByRole('button', { name: /برند: / })).toBeVisible();
  });

  test('a catalogue landing page opens from the brand list', async ({ page }) => {
    await open(page, '/brands');

    const landing = page.locator('a[href^="/catalog/"]').first();
    await expect(landing).toBeVisible();
    const href = await landing.getAttribute('href');

    await open(page, href!);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('an address that does not exist is a page, not a crash', async ({ page }) => {
    await page.goto('/no-such-page');

    await expect(page.getByRole('heading', { name: 'این نشانی وجود ندارد' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'صفحهٔ اصلی' })).toBeVisible();
  });

  test('a product that does not exist offers the catalogue instead of a blank page', async ({ page }) => {
    await open(page, '/product/no-such-product');

    await expect(page.getByRole('heading', { name: 'این کالا پیدا نشد' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'بازگشت به فروشگاه' })).toBeVisible();
  });

  test('tracking asks for both the code and the phone before it asks the server', async ({ page }) => {
    await open(page, '/track');

    const submit = page.getByRole('button', { name: /پیدا کردن سفارش/ });
    await expect(submit).toBeDisabled();

    await page.getByLabel('کد سفارش').fill('GK-000000');
    await expect(submit).toBeDisabled();

    await page.getByLabel('شمارهٔ همراه').fill('09120000000');
    await expect(submit).toBeEnabled();
  });

  test('login offers the mobile path first and keeps the password path available', async ({ page }) => {
    await open(page, '/login');

    await expect(page.getByLabel(/شمارهٔ همراه/)).toBeVisible();
    await expect(page.getByRole('button', { name: /دریافت کد/ })).toBeVisible();

    // The password path is one tab away, not a different page.
    await page.getByRole('tab', { name: 'رمز عبور' }).click();
    await expect(page.getByLabel(/نام کاربری/)).toBeVisible();
    await expect(page.getByLabel(/رمز عبور/)).toBeVisible();
  });
});
