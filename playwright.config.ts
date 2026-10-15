import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '*.smoke.ts',
  timeout: 30_000,
  retries: 1,
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:8787',
      env: { PORT: '8787', VITE_LIDORA_MIGRATION_TARGET_ORIGIN: 'http://lidora.localhost:8788', LIDORA_DATA_DIR: '/tmp/lidora-rebrand-browser-source' },
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:8788',
      env: { PORT: '8788', LIDORA_DATA_DIR: '/tmp/lidora-rebrand-browser-target' },
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  use: {
    baseURL: 'http://localhost:8787',
    headless: true,
    launchOptions: { args: ['--host-resolver-rules=MAP lidora.localhost 127.0.0.1'] },
  },
});
