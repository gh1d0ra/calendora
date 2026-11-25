// Browser tests: the real Worker (wrangler dev, local D1, remote bindings off) on a fresh database per run.
// scripts/e2e-seed.mjs adds a family with code E2ETEST and tablet passcode e2e-pass.
import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 8789;
process.env.E2E_PERSIST ??= mkdtempSync(path.join(tmpdir(), 'calendora-e2e-'));
const persist = process.env.E2E_PERSIST;
const wrangler = 'node node_modules/wrangler/bin/wrangler.js';

export default defineConfig({
  testDir: 'e2e',
  // wrangler dev serves (and watches) this folder, so test output must go elsewhere or it restarts mid-run
  outputDir: path.join(tmpdir(), 'calendora-test-results'),
  fullyParallel: false,
  workers: 1, // one shared family board
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never', outputFolder: path.join(tmpdir(), 'calendora-playwright-report') }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'America/New_York',
  },
  projects: [
    { name: 'tablet', use: { ...devices['iPad Pro 11 landscape'], browserName: 'chromium' } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `node scripts/e2e-seed.mjs "${persist}" && ${wrangler} dev --local --port ${PORT} --ip 127.0.0.1 --persist-to "${persist}" --var OWNER_EMAILS:`,
    url: `http://127.0.0.1:${PORT}/api/session`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
