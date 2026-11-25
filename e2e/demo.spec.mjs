// The public demo (/?demo): a made-up family, no sign-in, and nothing saved to a real family's data.
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort());
});

test('the demo opens without signing in and never calls the family API', async ({ page }) => {
  const apiCalls = [];
  page.on('request', r => { if (/\/api\/(session|board)/.test(r.url())) apiCalls.push(r.url()); });
  await page.goto('/?demo');
  await expect(page.locator('#lock')).toBeHidden();
  await expect(page.locator('#demoPill')).toContainText('Demo family');
  await expect(page.locator('#memberFilter')).toContainText('Mom');
  await page.waitForTimeout(1000);
  expect(apiCalls).toEqual([]);
  // a real visit to / still asks to sign in, and the demo left no family data behind
  await page.goto('/');
  await expect(page.locator('#lock')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('calendora.v1'))).toBeNull();
});

test('the sign-in screen links to the demo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'look around a demo family' }).click();
  await expect(page).toHaveURL(/\?demo$/);
  await expect(page.locator('#demoPill')).toBeVisible();
});
