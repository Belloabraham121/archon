import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'agent@archon.test';
const PASSWORD = process.env.E2E_PASSWORD ?? '';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test.beforeEach(() => {
  test.skip(!PASSWORD, 'E2E_PASSWORD is required');
});

test('unauthenticated dashboard visit redirects to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test('agent account logs in and sees its identity', async ({ page }) => {
  await login(page, EMAIL, PASSWORD);
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(page.getByText('E2E Agent').first()).toBeVisible();
  await expect(page.locator('#organization')).toContainText('E2E Test Org');
});

test('wrong password is rejected with a message', async ({ page }) => {
  await login(page, EMAIL, 'definitely-wrong-password');
  await expect(page.locator('form p[role="alert"]')).toContainText(/invalid/i);
  await expect(page).toHaveURL(/\/login/);
});

test('sign out returns to login and dashboard is guarded again', async ({
  page,
}) => {
  await login(page, EMAIL, PASSWORD);
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
