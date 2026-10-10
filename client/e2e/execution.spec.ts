import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'agent@archon.test';
const PASSWORD = process.env.E2E_PASSWORD ?? '';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 15_000 });
}

test.beforeEach(() => {
  test.skip(!PASSWORD, 'E2E_PASSWORD is required');
});

test('submits only explicitly authorized demo execution attempts', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/intents');
  await page.getByLabel('Amount').fill('1000');
  await page.getByRole('button', { name: /submit intent/i }).click();
  await expect(page.getByRole('heading', { name: 'DIRECT' })).toBeVisible();
  await page.getByRole('button', { name: /simulate plan/i }).click();
  await expect(page.getByText(/plan ready for/i)).toBeVisible();

  await page.goto('/dashboard/executions');
  await expect(page.getByRole('heading', { name: 'Executions' })).toBeVisible();
  await expect(page.getByLabel('Execution plan')).not.toHaveValue('');

  await page.getByLabel('Explicit authorization').fill('not-authorized');
  await page.getByRole('button', { name: /submit authorized execution/i }).click();
  await expect(page.getByRole('alert')).toContainText(/demo execution requires explicit demo authorization/i);

  await page.getByLabel('Explicit authorization').fill('demo-authorized');
  await page.getByRole('button', { name: /submit authorized execution/i }).click();
  await expect(page.getByText('confirmed').first()).toBeVisible();
  await expect(page.getByText(/demo_[a-f0-9]+/i).first()).toBeVisible();
});
