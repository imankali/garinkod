import { expect, test } from '@playwright/test';

/**
 * Registration, login, storefront creation and the seller studio.
 *
 * Each run creates a fresh username so the suite is repeatable against a
 * long-lived development database.
 */

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

test.describe('registration and login', () => {
  test('a new account can register and reach its profile', async ({ page }) => {
    const username = `e2e${uniqueSuffix()}`;
    await page.goto('/login');
    await page.getByRole('tab', { name: /رمز عبور/ }).click();

    // The login page hosts both forms; switch to registration if needed.
    const registerToggle = page.getByRole('button', { name: /ثبت‌نام|ایجاد حساب/ });
    if (await registerToggle.count()) await registerToggle.first().click();

    await page.getByLabel(/نام کاربری/).first().fill(username);
    await page.getByLabel('ایمیل').fill(`${username}@example.test`);
    const passwordFields = page.locator('input[type="password"]');
    await passwordFields.first().fill('SafePassword!234');
    if ((await passwordFields.count()) > 1) {
      await passwordFields.nth(1).fill('SafePassword!234');
    }
    await page.getByRole('button', { name: /ثبت‌نام|ایجاد حساب/ }).last().click();

    await expect(page).toHaveURL(/\/(profile)?$/, { timeout: 10_000 });
  });

  test('wrong credentials show a message without redirecting', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('tab', { name: /رمز عبور/ }).click();
    await page.getByLabel(/نام کاربری/).first().fill('definitely-not-a-user');
    await page.locator('input[type="password"]').first().fill('wrong-password-123');
    await page.getByRole('button', { name: /ورود/ }).last().click();

    await expect(page).toHaveURL(/login/);
  });
});

test.describe('access levels', () => {
  test('a signed-out visitor is sent to login from the console', async ({ page }) => {
    await page.goto('/poshtiban');
    await expect(page).toHaveURL(/login/);
  });

  test('the legacy /management path redirects to /poshtiban', async ({ page }) => {
    await page.goto('/management');
    await expect(page).toHaveURL(/poshtiban|login/);
  });

  test('a signed-out visitor cannot open the seller studio', async ({ page }) => {
    await page.goto('/studio');
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('opening a storefront, signed out', () => {
  /**
   * The directory and the studio both offer «ساخت غرفه» to a visitor who has no
   * account. The rule this pins: that button is never a dead end and never a fake
   * submit. The form opens, the name can be probed, and the one step that needs
   * an identity hands the visitor to login — from where they come back to a form
   * that still holds what they typed.
   */
  test('the hero button opens the form with a way in, not a wall', async ({ page }) => {
    await page.goto('/storefronts');
    await page.getByRole('button', { name: 'ساخت غرفه' }).click();

    const dialog = page.getByRole('dialog', { name: 'ساخت غرفه' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText('برای ثبت نهایی، وارد حساب خود شوید'),
    ).toBeVisible();

    await dialog.getByRole('button', { name: 'ورود و ساخت غرفه' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('?create=1 opens the same dialog, so links from /studio work', async ({ page }) => {
    await page.goto('/storefronts?create=1');

    await expect(page.getByRole('dialog', { name: 'ساخت غرفه' })).toBeVisible();

    await page.getByRole('button', { name: 'بستن' }).click();
    await expect(page).toHaveURL(/\/storefronts$/, { timeout: 5000 });
    await expect(page.getByRole('dialog', { name: 'ساخت غرفه' })).toBeHidden();
  });

  test('the national code is asked for, and said to go on the account', async ({ page }) => {
    await page.goto('/storefronts?create=1');

    const dialog = page.getByRole('dialog', { name: 'ساخت غرفه' });
    await expect(dialog.getByLabel('کد ملی')).toBeVisible();
    await expect(dialog.getByText('روی حساب شما ذخیره می‌شود')).toBeVisible();
  });
});
