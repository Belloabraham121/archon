import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'agent@archon.test';
const PASSWORD = process.env.E2E_PASSWORD ?? '';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(page.locator('#organization')).toContainText('E2E Test Org');
}

test.beforeEach(() => {
  test.skip(!PASSWORD, 'E2E_PASSWORD is required');
});

test('creates, versions, and publishes a policy', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/policies');
  const name = `e2e-policy-${Date.now().toString(36)}`;
  await page.getByLabel('New policy name').fill(name);
  await page.getByRole('button', { name: /^create$/i }).click();
  await expect(page.getByText(name).first()).toBeVisible();

  await page.getByRole('button', { name: /save draft version/i }).click();
  await expect(page.getByText('v1').first()).toBeVisible();

  await page.getByRole('button', { name: /^publish$/i }).click();
  await expect(page.getByText('published').first()).toBeVisible();

  await page.getByRole('button', { name: /run test/i }).click();
  await expect(page.getByText(/DIRECT|REVIEW/).first()).toBeVisible();
});

test('replay workspace renders runs', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/replays');
  await expect(page.getByRole('heading', { name: /replay workspace/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /run replay/i })).toBeVisible();
});
