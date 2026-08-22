import { expect, test } from '@playwright/test';

const publicRoutes = [
  '/',
  '/products',
  '/products/load-test-fertilizer',
  '/checkout',
  '/orders',
  '/services',
  '/farmer-sell',
  '/marketplace',
  '/support',
  '/affiliate',
  '/finance',
  '/studio',
  '/rewards',
  '/management',
  '/login',
];

test('home renders key public controls', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/گرین کود/);
  await expect(page.getByRole('textbox', { name: 'جستجوی محصولات' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'سبد خرید' }).first()).toBeVisible();
});

test('all public routes render without a browser crash', async ({ page }) => {
  for (const route of publicRoutes) {
    await page.goto(route);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.locator('text=خطای غیرمنتظره')).toHaveCount(0);
  }
});

test('language selector changes document direction safely', async ({ page }) => {
  await page.goto('/');
  const language = page.getByLabel('زبان').first();
  await language.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await language.selectOption('fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('mobile navigation is reachable and opens the menu', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only assertion');
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'منوی پایین موبایل' })).toBeVisible();
  await page.getByRole('button', { name: 'باز کردن منو' }).click();
  await expect(page.getByRole('complementary')).toBeVisible();
});
