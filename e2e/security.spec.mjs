// Security headers from _headers, and the Content-Security-Policy doesn't object to anything the app does.
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort());
});

test('pages carry the security headers', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['content-security-policy-report-only']).toContain("object-src 'none'");
  expect(h['content-security-policy-report-only']).toContain('report-uri /api/csp-report');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect((await request.get('/_headers')).status()).toBe(404); // the rules file itself isn't served
});

test('using the app breaks no Content-Security-Policy rule', async ({ page }) => {
  const violations = [];
  page.on('console', m => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
  const reports = [];
  page.on('request', r => { if (r.url().includes('/api/csp-report')) reports.push(r.postData()); });

  await page.goto('/?demo');
  await expect(page.locator('#demoPill')).toBeVisible();
  for (const view of ['Month', 'Chores', 'Meals', 'Lists']) {
    await page.getByRole('button', { name: view }).first().click();
  }
  await page.goto('/');
  await page.getByText('Wall tablet? Sign in with a family code').click();
  await page.getByPlaceholder('Family code (from Settings)').fill('E2ETEST');
  await page.getByPlaceholder('Tablet passcode').fill('e2e-pass');
  await page.getByRole('button', { name: 'Open Calendora' }).click();
  await expect(page.locator('#lock')).toBeHidden();
  await page.waitForTimeout(1500);
  expect(violations).toEqual([]);
  expect(reports).toEqual([]);
});

test('the report endpoint accepts browser reports', async ({ request }) => {
  const res = await request.post('/api/csp-report', {
    headers: { 'Content-Type': 'application/csp-report' },
    data: JSON.stringify({ 'csp-report': { 'document-uri': 'https://calendora.test/?x=1', 'effective-directive': 'script-src-elem', 'blocked-uri': 'https://evil.example/x.js' } }),
  });
  expect(res.status()).toBe(204);
});
