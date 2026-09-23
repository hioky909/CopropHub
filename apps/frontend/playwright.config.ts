import { defineConfig, devices } from '@playwright/test'

/**
 * T-17 (F-01 à F-09) : tests E2E contre un backend et une base PostgreSQL
 * réels — pas de mock. `DATABASE_URL` doit pointer vers une base dont le
 * nom finit par `_test` (même garde-fou que les tests d'intégration
 * backend, appliqué par `apps/backend/scripts/e2e-seed.ts`).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run e2e:serve --workspace=apps/backend',
      url: 'http://localhost:3000/health',
      cwd: '../..',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        SESSION_SECRET: process.env.SESSION_SECRET ?? 'e2e-secret-not-for-production-0000000000',
        FRONTEND_ORIGIN: 'http://localhost:5173',
        PORT: '3000',
        NODE_ENV: 'development',
        // La suite entière tourne contre UN SEUL processus backend : elle
        // enchaîne légitimement plus de 5 connexions réelles (NF-05, limite
        // de production inchangée par ailleurs — cf. auth.controller.ts).
        AUTH_RATE_LIMIT_MAX: '1000',
      },
    },
    {
      command: 'npm run dev --workspace=apps/frontend',
      url: 'http://localhost:5173',
      cwd: '../..',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
