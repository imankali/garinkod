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

test('checkout clearly communicates the five purchase stages', async ({ page }) => {
  await page.goto('/checkout');

  const steps = page.getByRole('navigation', { name: 'مراحل خرید' });
  await expect(steps).toBeVisible();
  await expect(steps.getByRole('listitem')).toHaveCount(5);
  for (const label of ['فروشگاه', 'سبد خرید', 'اطلاعات', 'پرداخت', 'تکمیل']) {
    await expect(steps.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(steps.locator('[aria-current="step"]')).toHaveCount(1);
});

test('login defaults to mobile OTP and keeps password compatibility', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('tab', { name: /کد یک‌بارمصرف/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('شماره موبایل')).toBeVisible();
  await page.getByRole('tab', { name: /رمز عبور/ }).click();
  await expect(page.getByLabel('نام کاربری')).toBeVisible();
  await expect(page.getByLabel('رمز عبور', { exact: true })).toBeVisible();
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
