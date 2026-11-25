// README screenshots, with the app's built-in demo family (made up; no real data).
// Not part of the normal test run:  SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.mjs
// Images go to the temp folder first (wrangler dev restarts when files in the app folder change).
import { test } from '@playwright/test';
import { tmpdir } from 'node:os';
import path from 'node:path';

test.skip(!process.env.SCREENSHOTS, 'only when SCREENSHOTS=1');
const out = name => path.join(tmpdir(), 'calendora-shots', name);

test('screenshots', async ({ page }, info) => {
  await page.context().route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), r => r.abort());
  await page.route('**/api/**', r => r.abort()); // no server → local-only mode with the demo family
  await page.goto('/');
  await page.locator('#view').waitFor();
  await page.waitForTimeout(800);
  const shot = async name => { await page.waitForTimeout(500); await page.screenshot({ path: out(`${info.project.name}-${name}.png`) }); };

  await shot('week');
  if (info.project.name === 'phone') return;
  await page.getByRole('button', { name: 'Month' }).click();
  await shot('month');
  await page.getByRole('button', { name: 'Chores' }).click();
  await shot('chores');
  await page.getByRole('button', { name: 'Meals' }).click();
  await shot('meals');
  await page.getByRole('button', { name: 'Lists' }).click();
  await shot('lists');
});
