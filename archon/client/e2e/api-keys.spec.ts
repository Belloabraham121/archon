import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'agent@archon.test';
const PASSWORD = process.env.E2E_PASSWORD ?? '';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

test.beforeEach(() => {
  test.skip(!PASSWORD, 'E2E_PASSWORD is required');
});

test('API key lifecycle: create, copy-once, revoke', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/developers');
  await expect(
    page.getByRole('heading', { name: /api keys/i }),
  ).toBeVisible();

  const keyName = `e2e-${Date.now()}`;
  await page.getByPlaceholder('Production router').fill(keyName);
  await page.getByRole('button', { name: /create api key/i }).click();

  // Secret is shown exactly once…
  const secret = page.locator('code.break-all');
  await expect(secret).toContainText(/^ak_test_/);
  const value = (await secret.textContent())?.trim() ?? '';
  expect(value.length).toBeGreaterThan(20);

  await page.getByRole('button', { name: /done/i }).click();
  await expect(secret).toHaveCount(0);

  // …then only the masked row remains, which can be revoked.
  const row = page.locator('tbody tr', { hasText: keyName });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /revoke/i }).click();
  await expect(row.getByText('Revoked')).toBeVisible();
});
