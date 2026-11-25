// A wall tablet signs in with the family code, adds events, and a second device sees them.
import { expect, test } from '@playwright/test';

const offline = url => !['127.0.0.1', 'localhost'].includes(url.hostname);

// Keep tests off the internet: Google's sign-in script, weather, news pictures and so on.
test.beforeEach(async ({ context }) => {
  await context.route(offline, route => route.abort());
});

async function signInTablet(page) {
  await page.goto('/');
  await page.getByText('Wall tablet? Sign in with a family code').click();
  await page.getByPlaceholder('Family code (from Settings)').fill('e2etest'); // lower case is fine
  await page.getByPlaceholder('Tablet passcode').fill('e2e-pass');
  await page.getByRole('button', { name: 'Open Calendora' }).click();
  await expect(page.locator('#lock')).toBeHidden();
}

async function addEvent(page, title, { time = '10:00', recur } = {}) {
  await page.locator('#fab').click();
  const form = page.locator('.event-modal');
  await expect(form.getByText('New event')).toBeVisible();
  await form.locator('input[name=title]').fill(title);
  await form.locator('input[name=startTime]').fill(time);
  if (recur) await form.locator('select[name=recur]').selectOption(recur);
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form).toBeHidden();
}

const boardText = async page => JSON.stringify((await (await page.request.get('/api/board')).json()).data);

test('wrong passcode shows an error', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Wall tablet? Sign in with a family code').click();
  await page.getByPlaceholder('Family code (from Settings)').fill('E2ETEST');
  await page.getByPlaceholder('Tablet passcode').fill('not-it');
  await page.getByRole('button', { name: 'Open Calendora' }).click();
  await expect(page.locator('#lock .lock-error')).toContainText('not right');
});

test('add an event; it is saved and shows on another device', async ({ page, browser }, info) => {
  const title = `Dentist ${info.project.name} ${Date.now()}`;
  await signInTablet(page);
  await addEvent(page, title);
  await expect(page.locator('#view').getByText(title)).toBeVisible();

  // saved to the family board (not just this browser): a reload and a second device both show it
  await expect.poll(() => boardText(page), { timeout: 10_000 }).toContain(title);
  await page.reload();
  await expect(page.locator('#view').getByText(title)).toBeVisible();

  const otherContext = await browser.newContext({ timezoneId: 'America/New_York' });
  await otherContext.route(offline, route => route.abort());
  const other = await otherContext.newPage();
  await signInTablet(other);
  await expect(other.locator('#view').getByText(title)).toBeVisible();
  await otherContext.close();
});

test('a weekly event repeats next week', async ({ page }, info) => {
  const title = `Piano ${info.project.name} ${Date.now()}`;
  await signInTablet(page);
  await addEvent(page, title, { time: '16:00', recur: 'weekly' });
  await expect(page.locator('#view').getByText(title).first()).toBeVisible();
  // → moves one week in week view; the phone shows one day at a time, so step 7 days
  const steps = info.project.name === 'phone' ? 7 : 1;
  for (let i = 0; i < steps; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('#view').getByText(title).first()).toBeVisible();
});
