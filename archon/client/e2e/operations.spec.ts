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

test.beforeEach(() => test.skip(!PASSWORD, 'E2E_PASSWORD is required'));

test('shows execution-quality, Tempo connector controls, and tamper-evident audit evidence', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/operations');
  await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
  await expect(page.getByText('Attempts')).toBeVisible();

  await page.goto('/dashboard/connections');
  await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();
  const tempo = page.getByRole('row').filter({ hasText: 'tempo-payments' });
  await expect(tempo).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await tempo.getByRole('button', { name: 'Disable' }).click();
  await expect(tempo.getByRole('button', { name: 'Enable' })).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await tempo.getByRole('button', { name: 'Enable' }).click();
  await expect(tempo.getByRole('button', { name: 'Disable' })).toBeVisible();

  await page.goto('/dashboard/audit');
  await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
  await page.getByRole('button', { name: /verify export/i }).click();
  await expect(page.getByRole('alert')).toContainText(/Verified export root/i);
});
