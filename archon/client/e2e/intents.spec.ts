import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'agent@archon.test';
const PASSWORD = process.env.E2E_PASSWORD ?? '';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 15_000 });
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

test('replays the original response for a duplicate idempotency key', async ({ page }) => {
  await login(page);
  const results = await page.evaluate(async () => {
    const organizationId = localStorage.getItem('archon:orgId')!;
    const key = `e2e-idempotency-${Date.now()}`;
    const request = () => fetch('http://localhost:4000/v1/intents', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-organization-id': organizationId, 'x-environment': 'test', 'Idempotency-Key': key },
      body: JSON.stringify({ type: 'swap', chain: 'demo', sell_asset: 'USDC', buy_asset: 'ETH', amount: '1000', constraints: { maximum_slippage_bps: 50 } }),
    }).then((response) => response.json());
    return [await request(), await request()];
  });
  expect(results[1].intent.id).toBe(results[0].intent.id);
  expect(results[1].context.hash).toBe(results[0].context.hash);
  expect(results[1].replayed).toBe(true);
});

test('requotes and simulates the selected intent', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/intents');
  await page.getByLabel('Amount').fill('1000');
  await page.getByRole('button', { name: /submit intent/i }).click();
  await expect(page.getByRole('heading', { name: 'DIRECT' })).toBeVisible();

  await page.getByRole('button', { name: /^requote$/i }).click();
  await expect(page.getByRole('cell', { name: 'demo-amm' }).last()).toBeVisible();

  await page.getByRole('button', { name: /simulate plan/i }).click();
  // Panel copy (not the Sonner toast, which also says "Simulation passed").
  await expect(page.getByText(/plan ready for|plan blocked/i)).toBeVisible();
  await expect(page.getByText('intent.received').first()).toBeVisible();
});

test('surfaces backend validation for an invalid amount', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/intents');
  await page.getByLabel('Amount').fill('0');
  await page.getByRole('button', { name: /submit intent/i }).click();
  await expect(page.locator('form p[role="alert"]')).toContainText(/amount must be a positive decimal string/i);
});

test('a blocked intent shows the deterministic fallback banner', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/intents');
  await page.getByLabel('Amount').fill('999999999');
  await page.getByRole('button', { name: /submit intent/i }).click();
  await expect(page.getByRole('heading', { name: 'REVIEW' })).toBeVisible();
  await expect(page.getByText(/Jev (did not decide|recommended|is rate-limited|is overloaded|timed out|rejected|is unreachable|API key)|deterministic policy decided alone/i).first()).toBeVisible();
});

test('deletes an intent and its evidence', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/intents');
  await page.getByLabel('Amount').fill('1000');
  await page.getByRole('button', { name: /submit intent/i }).click();
  await expect(page.getByRole('heading', { name: 'DIRECT' })).toBeVisible();
  page.on('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: /delete intent/i }).click();
  await expect(page.getByText('Intent deleted').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /delete intent/i })).toHaveCount(0);
});
