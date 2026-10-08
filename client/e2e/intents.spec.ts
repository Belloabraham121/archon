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

test('submits an intent and shows quotes, context, and deterministic decision', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/intents');
  await page.getByLabel('Amount').fill('2500');
  await page.getByRole('button', { name: /submit intent/i }).click();

  await expect(page.getByRole('heading', { name: 'DIRECT' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'demo-amm' }).last()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'demo-rfq' }).last()).toBeVisible();
  await expect(page.getByText(/selected for the highest valid net output/)).toBeVisible();
  await expect(page.getByText(/sha256:/)).toBeVisible();
});

test('surfaces backend validation for an invalid amount', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/intents');
  await page.getByLabel('Amount').fill('0');
  await page.getByRole('button', { name: /submit intent/i }).click();
  await expect(page.locator('form p[role="alert"]')).toContainText(/amount must be a positive decimal string/i);
});
