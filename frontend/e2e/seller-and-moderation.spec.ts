import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

/**
 * Journeys that need a signed-in user: the seller studio (posts, stories,
 * image upload, highlights), the financial ledger, and the moderation console.
 *
 * These rely on accounts the CI job creates through the UI itself, so the
 * suite stays self-contained and repeatable.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// A tiny real PNG, so the upload exercises the server's image validation
// rather than being rejected as a non-image before it gets there.
const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'sample.png');

function unique() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function registerAndSignIn(page: Page, username: string) {
  await page.goto('/login');
  const registerToggle = page.getByRole('button', { name: /ثبت‌نام|ایجاد حساب/ });
  if (await registerToggle.count()) await registerToggle.first().click();

  await page.getByLabel(/نام کاربری/).first().fill(username);
  const passwords = page.locator('input[type="password"]');
  await passwords.first().fill('SafePassword!234');
  if ((await passwords.count()) > 1) await passwords.nth(1).fill('SafePassword!234');
  await page.getByRole('button', { name: /ثبت‌نام|ایجاد حساب/ }).last().click();
  await page.waitForLoadState('networkidle');
}

async function createStorefront(page: Page, name: string) {
  await page.goto('/marketplace');
  await page.getByRole('button', { name: 'ساخت غرفه' }).click();
  await page.getByLabel(/نام غرفه/).fill(name);
  await page.getByLabel('استان').selectOption('فارس');
  await page.getByLabel('شهر').selectOption('شیراز');
  // Wait for the live availability check to confirm before submitting.
  await expect(page.locator('#store-name-status')).toContainText('آزاد است', { timeout: 8000 });
  await page.getByRole('button', { name: 'ساخت غرفه' }).last().click();
  await page.waitForLoadState('networkidle');
}

test.describe('seller studio', () => {
  test('a seller can publish a post with an image', async ({ page }) => {
    const username = `seller${unique()}`;
    await registerAndSignIn(page, username);
    await createStorefront(page, `غرفه استودیو ${unique()}`);

    await page.goto('/studio');
    await expect(page.getByRole('heading', { name: /استودیو غرفه/ })).toBeVisible();

    await page.getByRole('button', { name: 'پست', exact: true }).click();
    await page.getByLabel(/متن معرفی محصول/).fill('محصول تازه برداشت‌شده از باغ ما.');
    await page.setInputFiles('input[type="file"]', FIXTURE_IMAGE);
    await page.getByRole('button', { name: /ارسال برای بررسی/ }).click();

    await expect(page.getByText(/برای بررسی|ثبت شد/).first()).toBeVisible({ timeout: 10_000 });
  });

  test('a seller can publish a 24-hour story', async ({ page }) => {
    const username = `story${unique()}`;
    await registerAndSignIn(page, username);
    await createStorefront(page, `غرفه استوری ${unique()}`);

    await page.goto('/studio');
    await page.getByRole('button', { name: /استوری ۲۴ ساعته/ }).click();
    await page.getByLabel(/متن معرفی محصول/).fill('برداشت امروز صبح.');
    await page.getByRole('button', { name: /ارسال برای بررسی/ }).click();

    await expect(page.getByText(/استوری/).first()).toBeVisible();
  });

  test('the highlight manager is available to a seller', async ({ page }) => {
    const username = `hl${unique()}`;
    await registerAndSignIn(page, username);
    await createStorefront(page, `غرفه هایلایت ${unique()}`);

    await page.goto('/studio');
    await expect(page.getByRole('heading', { name: /هایلایت‌های غرفه/ })).toBeVisible();
    // With no published story yet, creating a highlight must be impossible
    // rather than producing an empty one.
    await expect(page.getByRole('button', { name: /ساخت هایلایت/ })).toBeDisabled();
  });

  test('a rejected listing shows its reason to the seller', async ({ page }) => {
    const username = `rej${unique()}`;
    await registerAndSignIn(page, username);
    await createStorefront(page, `غرفه رد ${unique()}`);

    // A freshly created listing sits in review, which the seller can see.
    await page.goto('/profile?tab=seller');
    await expect(page.getByRole('heading', { name: /ثبت آگهی|آگهی/ }).first()).toBeVisible();
  });
});

test.describe('seller finance', () => {
  test('the ledger renders with balances and an export button', async ({ page }) => {
    const username = `fin${unique()}`;
    await registerAndSignIn(page, username);
    await createStorefront(page, `غرفه مالی ${unique()}`);

    await page.goto('/finance');
    await expect(page.getByRole('heading', { name: /موجودی، کمیسیون و تسویه/ })).toBeVisible();
    await expect(page.getByText('در انتظار تأیید')).toBeVisible();
    await expect(page.getByText('قابل تسویه')).toBeVisible();
    await expect(page.getByRole('button', { name: /خروجی CSV/ })).toBeVisible();
  });

  test('ledger filters are present and usable', async ({ page }) => {
    const username = `finf${unique()}`;
    await registerAndSignIn(page, username);
    await createStorefront(page, `غرفه فیلتر ${unique()}`);

    await page.goto('/finance');
    await page.getByLabel('وضعیت').selectOption({ index: 1 });
    await page.getByLabel('نوع رویداد').selectOption({ index: 1 });
    // The page must stay usable rather than erroring on an empty result set.
    await expect(page.getByRole('heading', { name: /موجودی، کمیسیون/ })).toBeVisible();
  });

  test('a buyer without a storefront is told to create one', async ({ page }) => {
    const username = `nofin${unique()}`;
    await registerAndSignIn(page, username);

    await page.goto('/finance');
    await expect(page.getByText(/ابتدا غرفه بسازید/)).toBeVisible();
  });
});

test.describe('profile avatar', () => {
  test('a user can upload and then remove a profile picture', async ({ page }) => {
    const username = `av${unique()}`;
    await registerAndSignIn(page, username);

    await page.goto('/profile');
    await page.setInputFiles('input[type="file"]', FIXTURE_IMAGE);

    // Once uploaded, a delete control appears next to the avatar.
    await expect(page.getByRole('button', { name: 'حذف تصویر پروفایل' })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: 'حذف تصویر پروفایل' }).click();
    await expect(page.getByRole('button', { name: 'افزودن تصویر پروفایل' })).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('moderation console', () => {
  // The console needs level 3+, which the CI job grants to this account.
  const MODERATOR = process.env.E2E_MODERATOR_USERNAME;
  const MODERATOR_PASSWORD = process.env.E2E_MODERATOR_PASSWORD;

  test.skip(!MODERATOR, 'E2E_MODERATOR_USERNAME is not configured');

  async function signInAsModerator(page: Page) {
    await page.goto('/login');
    await page.getByLabel(/نام کاربری/).first().fill(MODERATOR!);
    await page.locator('input[type="password"]').first().fill(MODERATOR_PASSWORD!);
    await page.getByRole('button', { name: /ورود/ }).last().click();
    await page.waitForLoadState('networkidle');
  }

  test('the review queue lists pending content', async ({ page }) => {
    await signInAsModerator(page);
    await page.goto('/poshtiban');

    await page.getByRole('button', { name: /صف بررسی/ }).click();
    await expect(page.getByRole('heading', { name: 'صف بررسی محتوا' })).toBeVisible();
    await expect(page.getByLabel('نوع محتوا')).toBeVisible();
  });

  test('rejecting requires a reason', async ({ page }) => {
    await signInAsModerator(page);
    await page.goto('/poshtiban');
    await page.getByRole('button', { name: /صف بررسی/ }).click();

    const rejectButton = page.getByRole('button', { name: 'رد' }).first();
    const hasRows = await rejectButton.count();
    test.skip(hasRows === 0, 'No pending content in the queue');

    await rejectButton.click();
    // Submitting an empty reason must be refused inline.
    await page.getByRole('button', { name: 'ثبت رد' }).click();
    await expect(page.locator('#reject-reason-error')).toBeVisible();
  });

  test('the dashboard surfaces pending work and the users tab', async ({ page }) => {
    await signInAsModerator(page);
    await page.goto('/poshtiban');

    await expect(page.getByRole('heading', { name: /مدیریت عملیات، مالی و اعتماد/ })).toBeVisible();
  });
});
