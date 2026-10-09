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
  const organizationId = await page.locator('#organization').inputValue();
  const switched = await page.request.post(`http://localhost:4000/v1/organizations/${organizationId}/switch`, {
    headers: {
      'x-organization-id': organizationId,
      'x-environment': 'test',
      'Idempotency-Key': crypto.randomUUID(),
    },
  });
  expect(switched.ok()).toBeTruthy();

  const crossTenant = await page.request.get('http://localhost:4000/v1/intents', {
    headers: { 'x-organization-id': 'not-the-callers-organization', 'x-environment': 'test' },
  });
  expect(crossTenant.status()).toBe(403);

  const wrongEnvironment = await page.request.get('http://localhost:4000/v1/intents', {
    headers: { 'x-api-key': value, 'x-organization-id': organizationId, 'x-environment': 'live' },
  });
  expect(wrongEnvironment.status()).toBe(403);

  await row.getByRole('button', { name: /revoke/i }).click();
  await expect(row.getByText('Revoked')).toBeVisible();

  const rejected = await page.request.get('http://localhost:4000/v1/intents', {
    headers: { 'x-api-key': value, 'x-organization-id': organizationId, 'x-environment': 'test' },
  });
  expect(rejected.status()).toBe(401);
});
