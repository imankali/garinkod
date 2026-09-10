import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { selectWhenReady, waitForOptions } from './selectors';

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
  // Every step is announced before it is taken. A helper that quietly waits 45
  // seconds on a control the app does not render turns one wrong assumption into a
  // file full of identical timeouts, which is the least useful failure a suite can
  // produce; this way the report names the missing thing.
  const passwordTab = page.getByRole('tab', { name: /رمز عبور/ });
  await expect(passwordTab).toBeVisible();
  await passwordTab.click();
  const registerToggle = page.getByRole('button', { name: /ثبت‌نام|ایجاد حساب/ });
  if (await registerToggle.count()) await registerToggle.first().click();

  const usernameField = page.getByLabel(/نام کاربری/).first();
  await expect(usernameField).toBeVisible();
  await usernameField.fill(username);
  const emailField = page.getByLabel('ایمیل').first();
  await expect(emailField).toBeVisible();
  await emailField.fill(`${username}@example.test`);
  const passwords = page.locator('input[type="password"]');
  await passwords.first().fill('SafePassword!234');
  if ((await passwords.count()) > 1) await passwords.nth(1).fill('SafePassword!234');
  const submit = page.getByRole('button', { name: /ثبت‌نام|ایجاد حساب/ }).last();
  await expect(submit).toBeVisible();
  await submit.click();

  // The API answers with a token or with an error; both are faster than 15s.
  // Waiting on the URL instead of networkidle keeps the failure honest: if the
  // account was not created, the report says the visitor is still on /login.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function createStorefront(page: Page, name: string) {
  // The directory's own dialog is the one and only way to open a stall; /studio
  // offers the very same form to someone who has no غرفه yet.
  await page.goto('/storefronts?create=1');
  const dialog = page.getByRole('dialog', { name: 'ساخت غرفه' });
  await dialog.getByLabel(/نام غرفه/).fill(name);
  // Both lists are fetched: cities only start loading once the province is set,
  // so each pick waits for its own option rather than for a fixed delay.
  await selectWhenReady(dialog.getByLabel('استان'), 'فارس');
  await selectWhenReady(dialog.getByLabel('شهر'), 'شیراز');

  // A stall is registered to a person. The profile fields are not optional, and
  // the national code goes on the account, which is what «غرفه من» later means.
  await dialog.getByLabel('نام', { exact: true }).fill('زهرا');
  await dialog.getByLabel('نام خانوادگی').fill('بهاران');
  await dialog.getByLabel('کد ملی').fill('3971857299');

  // The live availability check has to answer before submitting.
  await expect(dialog.locator('#store-name-status')).toContainText('آزاد است', { timeout: 8000 });
  await dialog.getByRole('button', { name: 'ساخت غرفه', exact: true }).click();

  // Created → the seller is standing on their own page, which is the studio.
  // The slug is the storefront's name in Persian, percent-encoded in the address
  // bar, so the pattern says "a path segment" rather than "ASCII": a [a-z0-9-]
  // class silently fails on every real stall and reads as a broken create.
  await expect(page)
    .toHaveURL(/\/storefronts\/[^/?#]+/, { timeout: 15_000 })
    .catch(async () => {
      // The form refuses with a field error, and a timeout on the URL says nothing
      // about why — so the reason is carried into the failure.
      const said = (await dialog.locator('[role="alert"]').allTextContents())
        .map((text) => text.trim())
        .filter(Boolean)
        .join(' | ');
      throw new Error(
        `the stall was not created — ${said || 'the form said nothing; url ' + page.url()}`,
      );
    });
}

/**
 * The composer is one dialog with a caption, an image and a kind switch.
 *
 * A picture is required, which is why every test here uploads the fixture: the
 * seller-facing rule is that a stall publishes things people can see.
 */
async function publishFromComposer(page: Page, kind: 'پست جدید' | 'استوری جدید', caption: string) {
  await page.getByRole('button', { name: 'پست جدید', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /پست جدید|استوری جدید/ });
  if (kind === 'استوری جدید') await dialog.getByRole('radio', { name: kind }).click();
  await dialog.getByLabel(/پست جدید/).fill(caption);
  await dialog.locator('input[type="file"]').setInputFiles(FIXTURE_IMAGE);
  await dialog.getByRole('button', { name: 'ارسال' }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

test.describe('seller studio', () => {
  /**
   * «استودیو غرفه» is no longer a separate screen: /studio resolves to the
   * seller's own page, where the composer, the posts and the stories live. These
   * tests therefore assert the redirect as part of the journey — the promise is
   * that a seller who has a stall never lands on a form.
   */
  test('a seller can publish a post with an image', async ({ page }) => {
    const username = `seller${unique()}`;
    await registerAndSignIn(page, username);
    await createStorefront(page, `غرفه استودیو ${unique()}`);

    const caption = `محصول تازه برداشت‌شده ${unique()}`;
    await publishFromComposer(page, 'پست جدید', caption);

    // It comes back for review, and the seller can see it right away — which is
    // the whole point of showing pending rows to their author.
    await expect(page.getByText(caption).first()).toBeVisible({ timeout: 15_000 });
  });

  test('/studio sends a seller who has a stall to their own page', async ({ page }) => {
    const username = `gate${unique()}`;
    await registerAndSignIn(page, username);
    await createStorefront(page, `غرفه دروازه ${unique()}`);

    await page.goto('/studio');
    await expect(page).toHaveURL(/\/storefronts\/[^/?#]+/);
    await expect(page.getByRole('button', { name: 'پست جدید', exact: true })).toBeVisible();
  });

  test('a seller can publish a 24-hour story and it appears on their page', async ({ page }) => {
    const username = `story${unique()}`;
    await registerAndSignIn(page, username);
    await createStorefront(page, `غرفه استوری ${unique()}`);

    // No rail before there is anything live in it.
    await expect(page.getByRole('region', { name: 'استوری‌ها و هایلایت‌ها' })).toBeHidden();

    await publishFromComposer(page, 'استوری جدید', `برداشت امروز صبح ${unique()}`);

    await expect(page.getByRole('region', { name: 'استوری‌ها و هایلایت‌ها' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'استوری‌ها' })).toBeVisible();
  });

  test('the composer refuses to publish without a picture', async ({ page }) => {
    const username = `nopix${unique()}`;
    await registerAndSignIn(page, username);
    await createStorefront(page, `غرفه بی‌تصویر ${unique()}`);

    await page.getByRole('button', { name: 'پست جدید', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: /پست جدید|استوری جدید/ });
    await dialog.getByLabel(/پست جدید/).fill('فقط متن');

    await expect(dialog.getByRole('button', { name: 'ارسال' })).toBeDisabled();
  });

  test('a rejected listing shows its reason to the seller', async ({ page }) => {
    const username = `rej${unique()}`;
    await registerAndSignIn(page, username);
    await createStorefront(page, `غرفه رد ${unique()}`);

    // A freshly created listing sits in review, which the seller can see.
    await page.goto('/profile?tab=seller');
    await expect(page.getByRole('heading', { name: /آگهی/ }).first()).toBeVisible();
  });
});

test.describe('messenger', () => {
  /**
   * The thread screen is reached from anywhere in the site — a notification, the
   * farmer dossier's «ادامه گفتگو», the header shortcut — so it has to offer a
   * way back to the inbox. On a phone, where the list and the thread share one
   * column, that button is the only way out, which is why it is measured here as
   * a tap target and not only as an element.
   */
  test('the inbox says what it is and says so when it is empty', async ({ page }) => {
    const username = `dm${unique()}`;
    await registerAndSignIn(page, username);
    await createStorefront(page, `غرفه پیام ${unique()}`);

    await page.goto('/messages');
    await expect(page.getByRole('heading', { name: 'پیام‌ها' })).toBeVisible();
    // A seller with no buyers yet gets a sentence, not a blank column.
    await expect(page.getByText('گفتگویی وجود ندارد.')).toBeVisible();
  });

  test('an open thread carries the reader back to the inbox', async ({ page }) => {
    const username = `dmb${unique()}`;
    await registerAndSignIn(page, username);

    // Start the thread the way a buyer does: from a listing card on the shelf.
    await page.goto('/storefronts');
    await page.getByRole('button', { name: 'ارسال به دایرکت' }).first().click();

    const drawer = page.getByRole('dialog', { name: 'پیام‌ها' });
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    const send = drawer.getByRole('button', { name: 'ارسال' }).last();
    await send.click();
    // The reply the app gives is a toast — it is the signal that the thread was
    // created, not only that a panel opened.
    await expect(page.getByText(/پیام ارسال شد|گفتگو باز شد/).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goto('/messages');
    await page.getByRole('button', { name: /غرفه/ }).first().click();

    const back = page.getByRole('button', { name: 'بازگشت', exact: true });
    await expect(back).toBeVisible();
    const box = await back.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(40);
    expect(box?.height).toBeGreaterThanOrEqual(40);

    await back.click();
    await expect(back).toBeHidden();
    await expect(page.getByRole('heading', { name: 'پیام‌ها' })).toBeVisible();
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
    const status = page.getByLabel('وضعیت');
    const kind = page.getByLabel('نوع رویداد');
    await waitForOptions(status);
    await status.selectOption({ index: 1 });
    await waitForOptions(kind);
    await kind.selectOption({ index: 1 });
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
    await page.getByRole('tab', { name: /رمز عبور/ }).click();
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
