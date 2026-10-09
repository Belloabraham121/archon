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
  await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 15_000 });
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
  await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 15_000 });
  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('new user completes signup, organization, key, and intent onboarding', async ({ page }) => {
  const stamp = Date.now();
  await page.goto('/signup');
  await page.getByLabel('First name').fill('Phase');
  await page.getByLabel('Last name').fill('Tester');
  await page.getByLabel('Email').fill(`phase-onboarding-${stamp}@archon.test`);
  await page.getByLabel('Password').fill('Phase-Onboarding-2026!');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 15_000 });

  await page.goto('/dashboard/organizations');
  await page.getByLabel('Organization name').fill(`Onboarding ${stamp}`);
  await page.getByRole('button', { name: /create organization/i }).click();
  await page.waitForURL((url) => url.pathname === '/dashboard/intents', { timeout: 15_000 });
  await expect(page.locator('#organization')).toHaveValue(/.+/);

  await page.goto('/dashboard/developers');
  await page.getByPlaceholder('Production router').fill('Onboarding key');
  await page.getByRole('button', { name: /create api key/i }).click();
  await expect(page.locator('code.break-all')).toContainText(/^ak_test_/);

  await page.goto('/dashboard/intents');
  await page.getByRole('button', { name: /submit intent/i }).click();
  await expect(page.getByRole('cell', { name: 'demo-amm' }).last()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('cell', { name: 'demo-rfq' }).last()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'DIRECT' })).toBeVisible();

  await page.goto('/dashboard/policies');
  const policyName = `Onboarding cap ${stamp}`;
  await page.getByLabel('New policy name').fill(policyName);
  await page.getByRole('button', { name: /^create$/i }).click();
  await expect(page.getByText(policyName).first()).toBeVisible();
  await page.getByPlaceholder('100000').fill('1');
  await page.getByRole('button', { name: /save draft version/i }).click();
  await page.getByRole('button', { name: /^publish$/i }).click();
  await expect(page.getByText('published').first()).toBeVisible();

  await page.goto('/dashboard/intents');
  await page.getByRole('button', { name: /submit intent/i }).click();
  await expect(page.getByRole('heading', { name: 'REVIEW' })).toBeVisible({ timeout: 20_000 });
  const decisions = page.locator('table').first().locator('tbody tr td:nth-child(4)');
  await expect(decisions.filter({ hasText: 'DIRECT' })).toHaveCount(1);
  await expect(decisions.filter({ hasText: 'REVIEW' })).toHaveCount(1);
});
