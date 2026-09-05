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
  '/legal',
  '/legal/terms',
  '/legal/shipping',
  '/legal/complaints',
  // The older addresses must keep answering: they are printed in e-mails and
  // saved in bookmarks.
  '/privacy',
  '/terms',
  '/returns',
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

test('route metadata indexes public pages and protects account pages', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page).toHaveTitle(/حریم خصوصی/);
  // The legacy address answers, and points at the canonical copy of the same text.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/legal\/privacy$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index,follow/);

  await page.goto('/orders');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
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

test('legal hub lists every document and each document reads in full', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByRole('heading', { name: 'اسناد حقوقی گرین کود' })).toBeVisible();
  // A fingerprint of the text in force is shown, because that number is what the
  // checkout stamps on the order.
  await expect(page.getByText(/GK-[0-9A-F]{10}/)).toBeVisible();

  const cards = page.locator('a[href^="/legal/"]', { hasText: 'خواندن سند' });
  expect(await cards.count()).toBeGreaterThanOrEqual(6);
  for (const slug of ['terms', 'privacy', 'returns', 'shipping', 'warranty', 'marketplace', 'loyalty', 'complaints']) {
    await expect(page.locator(`a[href="/legal/${slug}"]`)).not.toHaveCount(0);
  }

  await page.locator('a[href="/legal/returns"]').first().click();
  await expect(page).toHaveURL(/\/legal\/returns$/);
  await expect(
    page.getByRole('heading', { level: 1, name: /شرایط خرید، لغو و بازگشت کالا/ }),
  ).toBeVisible();
  expect(await page.locator('section[id^="part-"]').count()).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole('navigation', { name: 'فهرست این سند' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'اسناد حقوقی' })).toBeVisible();

  // Every document is one click away from any other one.
  await page.locator('nav[aria-label="اسناد حقوقی"] a[href="/legal/loyalty"]').first().click();
  await expect(page).toHaveURL(/\/legal\/loyalty$/);
  await expect(page.getByRole('heading', { level: 1, name: /امتیاز وفاداری/ })).toBeVisible();
});

test('the terms a buyer accepts are readable from the checkout itself', async ({ page }) => {
  await page.goto('/checkout');
  const acceptance = page
    .locator('label')
    .filter({ hasText: 'صحت اطلاعات تحویل و مبلغ را تأیید می‌کنم' })
    .first();
  await expect(acceptance.getByRole('checkbox')).toBeVisible();
  for (const label of ['قوانین و مقررات', 'حریم خصوصی', 'شرایط خرید و بازگشت کالا']) {
    await expect(acceptance.getByRole('link', { name: label })).toBeVisible();
  }
  await acceptance.getByRole('link', { name: 'قوانین و مقررات' }).click();
  await expect(page).toHaveURL(/\/legal\/terms$/);
});
