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
  '/brands',
  '/faq',
  '/customers',
  // A group page that does not exist must still answer with its own empty state,
  // not with a blank document — the catalog renames slugs and old links survive.
  '/c/fertilizer',
  '/brand/no-such-brand',
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

test('the retired /marketplace address lands on the storefront directory', async ({ page }) => {
  await page.goto('/marketplace');

  await expect(page).toHaveURL(/\/storefronts$/);
  await expect(page.getByRole('heading', { name: 'بازار مستقیم کشاورزی' })).toBeVisible();
});

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

test('a brand page that does not exist offers the catalogue instead of a blank page', async ({ page }) => {
  await page.goto('/brand/no-such-brand');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /همه محصولات/ })).toBeVisible();
});

test("the buyers' page says where its quotes came from", async ({ page }) => {
  await page.goto('/customers');
  // Whichever tier the server is on, the page has to name it.
  await expect(page.getByText(/منتخب تیم گرین کود|دیدگاه خریداران با پرداخت تأییدشده|بازخوردهای امتیازدار/)).toBeVisible();
});

test('the faq page renders the questions the admin publishes', async ({ page }) => {
  await page.goto('/faq');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/سؤالات متداول|پرسش‌های/);

  // The questions come from a page block over HTTP, so "is the list empty?" can
  // only be answered once that has landed. Poll for either outcome the page is
  // allowed to produce: published questions, or the page admitting it has none.
  await expect
    .poll(
      async () =>
        (await page.locator('details > summary').count()) > 0 ||
        (await page.getByRole('link', { name: /میز پشتیبانی/ }).count()) > 0,
      { timeout: 15_000 },
    )
    .toBe(true);

  const questions = page.locator('details > summary');
  if ((await questions.count()) === 0) {
    // Nothing configured is an answer, as long as the page says so and still hands
    // the visitor to the support desk instead of a blank card.
    await expect(page.getByRole('link', { name: /میز پشتیبانی/ })).toBeVisible();
    return;
  }

  // Each question opens to its own answer, and the structured data the crawlers
  // get mirrors exactly that list — the two must not drift apart.
  const first = questions.first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(first.locator('xpath=following-sibling::p').first()).toBeVisible();

  const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents())
    .filter(Boolean)
    .map((raw) => JSON.parse(raw) as { '@type'?: string; mainEntity?: unknown[] })
    .filter((data) => data['@type'] === 'FAQPage');
  expect(schemas, 'the faq page publishes FAQPage structure').toHaveLength(1);
  expect(schemas[0]?.mainEntity?.length).toBe(await questions.count());
});

test('route metadata indexes public pages and protects account pages', async ({ page }) => {
  await page.goto('/privacy');
  // The short address keeps working — it is printed on paperwork — but it names the
  // legal hub as the canonical copy of the same text, so the site does not present
  // two documents where it means one. Exactly one <link rel="canonical"> may exist.
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page).toHaveTitle(/حریم خصوصی/);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
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
  // exact, because the footer's newsletter field is labelled «شماره موبایل برای
  // خبرنامه» and a substring search cannot tell the two apart — a lesson worth
  // keeping in the test rather than rediscovering next time.
  await expect(page.getByLabel('شماره موبایل', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /رمز عبور/ }).click();
  await expect(page.getByLabel('نام کاربری', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('رمز عبور', { exact: true }).first()).toBeVisible();
});

test('a saved language preference is applied before first paint', async ({ page }) => {
  // There is no language <select> in the public chrome: the switch is a radio group
  // on the profile page (the signed-in journey for it lives in auth-and-seller.spec),
  // and the choice is persisted under `garinkood_locale`. What the public routes owe
  // a visitor is reading that preference while the app boots, so the document never
  // paints RTL and then flips — that is a layout shift as well as a flash of the
  // wrong mirror, and it is exactly what a late locale read looks like in the wild.
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');

  await page.evaluate(() => window.localStorage.setItem('garinkood_locale', 'en'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.evaluate(() => window.localStorage.setItem('garinkood_locale', 'fa'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
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
  // Checkout with an empty cart has nothing to accept: it shows the way back to the
  // catalogue, not the acceptance box. So the journey starts where a buyer's does.
  await page.goto('/products?source=marketplace');
  await page.waitForResponse((response) => response.url().includes('/api/marketplace/'));
  const add = page.getByRole('button', { name: 'افزودن به سبد' }).first();
  await expect(add).toBeVisible();
  await add.click();
  await page.goto('/checkout');
  const acceptance = page
    .locator('label')
    .filter({ hasText: 'صحت اطلاعات تحویل و مبلغ را تأیید می‌کنم' })
    .first();
  // The input is visually replaced (sr-only) with a styled box beside the text,
  // so "visible" is the wrong verb for it: the label is read, the control exists.
  // The box is an <input type="checkbox"> inside a wrapping <label>, sized with
  // min-h-11 so the label text and the box are one target. Asking for the control
  // by its own name is the contract; reaching it through the wrapper's first match
  // was an accident of markup.
  await expect(page.getByRole('checkbox', { name: /صحت اطلاعات تحویل و مبلغ را تأیید می‌کنم/ })).toBeAttached();

  // The buyer is pointed at every document they are agreeing to. Where those links
  // go is the contract; how each one is phrased is copy, and copy changes.
  const hrefs = await acceptance
    .getByRole('link')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  expect(hrefs).toEqual(
    expect.arrayContaining(['/legal/terms', '/legal/privacy', '/legal/returns']),
  );

  await acceptance.getByRole('link', { name: 'قوانین و مقررات' }).click();
  await expect(page).toHaveURL(/\/legal\/terms$/);
});
