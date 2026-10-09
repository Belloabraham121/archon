import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'agent@archon.test';
const PASSWORD = process.env.E2E_PASSWORD ?? '';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 15_000 });
  await expect(page.locator('#organization')).toHaveValue(/.+/);
  await page.goto('/dashboard/intents');
}

test.beforeEach(() => {
  test.skip(!PASSWORD, 'E2E_PASSWORD is required');
});

test('close quotes escalate: judgment evidence is recorded', async ({ page }) => {
  await login(page);
  await page.getByLabel('Amount').fill('1000');
  await page.getByLabel(/maximum slippage/i).fill('50');
  await page.getByRole('button', { name: /submit intent/i }).click();
  await expect(page.getByRole('heading', { name: 'DIRECT' })).toBeVisible({ timeout: 20_000 });
  // Live strategy or deterministic fallback — both prove the Tier-3 path ran.
  await expect(
    page.getByText(/Jev (DIRECT|SPLIT|MULTI_HOP|WAIT|REQUOTE|ABORT|REVIEW) · confidence|Jev (did not decide|is rate-limited|is overloaded|timed out|rejected|is unreachable)/i).first(),
  ).toBeVisible();
});

test('a clear winner never calls Jev', async ({ page }) => {
  await login(page);
  await page.getByLabel('Amount').fill('200000');
  await page.getByLabel(/maximum slippage/i).fill('500');
  await page.getByRole('button', { name: /submit intent/i }).click();
  await expect(page.getByRole('heading', { name: 'DIRECT' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/deterministic policy decided alone/i).first()).toBeVisible();
});

test('decisions workspace makes provider activation and a full intent decision observable', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/decisions');
  await expect(page.getByRole('heading', { name: 'Decisions' })).toBeVisible();
  await expect(page.getByText(/Jev provider: (configured|not configured)/i)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Selected intent decision detail' })).toBeVisible();
  await expect(page.getByText('Deterministic decision')).toBeVisible();
  await expect(page.getByText('Jev judgment')).toBeVisible();
});
