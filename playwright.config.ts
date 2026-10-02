import { defineConfig, devices } from '@playwright/test';

/** `worker` corre a suíte contra a entrada Cloudflare Workers + D1 local; por omissão, Node + SQLite. */
const target = process.env.TENTO_E2E_TARGET === 'worker' ? 'worker' : 'node';

/** Sessão do dono criada por tests/e2e/auth.setup.ts; os testes com sessão começam daqui. */
const OWNER_STATE = 'tests/e2e/.auth/owner.json';

export default defineConfig({
  testDir: './tests/e2e',
  // Uma única base de dados partilhada: os testes correm um de cada vez.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
        storageState: OWNER_STATE,
      },
    },
    {
      name: 'movel',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Pixel 7'], storageState: OWNER_STATE },
    },
  ],
  // O servidor REAL de produção (API + dist/) com uma base de dados nova; ver scripts/e2e-server.mjs
  // (Node + SQLite) e scripts/e2e-worker.mjs (workerd + D1).
  webServer: {
    command: target === 'worker' ? 'node scripts/e2e-worker.mjs' : 'node scripts/e2e-server.mjs',
    url: 'http://localhost:4173/api/setup',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
