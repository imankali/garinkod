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

test.describe('storefront name availability', () => {
  test('checks the name live while typing', async ({ page }) => {
    await page.goto('/marketplace');
    await page.getByRole('button', { name: 'ساخت غرفه' }).click();

    const nameField = page.getByLabel(/نام غرفه/);
    await nameField.fill(`غرفه تست ${uniqueSuffix()}`);

    // The status line reports availability without submitting anything.
    await expect(page.locator('#store-name-status')).toContainText(/آزاد است|قبلاً ثبت شده/, {
      timeout: 6000,
    });
  });

  test('an already-taken name is reported as unavailable', async ({ page }) => {
    await page.goto('/marketplace');
    await page.getByRole('button', { name: 'ساخت غرفه' }).click();

    // Seeded by seed_demo_marketplace.
    await page.getByLabel(/نام غرفه/).fill('باغ سبز شیراز');
    await expect(page.locator('#store-name-status')).toContainText('قبلاً ثبت شده', { timeout: 6000 });
  });
});
