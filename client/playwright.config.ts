import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Agent E2E suite. Requires, in order:
 *   1. backend services:      (backend/) docker compose up -d
 *   2. backend API:           (backend/) npm run start:dev   (.env present)
 *   3. seeded agent account:  (backend/) E2E_PASSWORD=... npm run seed:e2e
 *   4. frontend:              (client/)  npm run dev
 *   5. this suite:            (client/)  E2E_PASSWORD=... npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
