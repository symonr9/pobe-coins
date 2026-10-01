/**
 * End-to-end smoke test of the web app against the local dev API (demo household).
 *
 *   SEED=1 npm run dev:api            (repo root, terminal 1)
 *   npm run web -w @pobe/mobile        (terminal 2)   or serve a built dist/ on :8081
 *   node apps/mobile/e2e/smoke.mjs    (terminal 3)
 *
 * Env: BASE_URL (default http://localhost:8081), PLAYWRIGHT_MODULE (path to playwright).
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8081';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

async function step(name, fn) {
  process.stdout.write(`• ${name} … `);
  await fn();
  console.log('ok');
}

try {
  await step('onboarding and dev sign-in', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByText('Skip', { exact: true }).click();
    await page.getByLabel('Dev sign-in name').fill('alex');
    await page.getByText('Dev sign-in', { exact: true }).last().click();
    await page.getByText('Your purse').waitFor({ timeout: 15000 });
  });

  let before = 0;
  await step('home shows the purse', async () => {
    const total = await page
      .getByLabel(/^\d+ coins$/)
      .first()
      .getAttribute('aria-label');
    before = Number(total?.split(' ')[0]);
    assert.ok(before >= 0);
  });

  await step('complete a chore and celebrate', async () => {
    await page.goto(`${BASE}/tasks`, { waitUntil: 'networkidle' });
    await page.getByText('Pool', { exact: true }).click();
    await page.getByRole('checkbox').first().waitFor();
    await page.getByRole('checkbox').first().click();
    await page
      .getByText(/^\+\d+$/)
      .first()
      .waitFor({ timeout: 5000 });
  });

  await step('log a purchase with change', async () => {
    await page.goto(`${BASE}/spend`, { waitUntil: 'networkidle' });
    await page.getByLabel('What is it?').fill('Iced coffee');
    await page.getByLabel('Add 5', { exact: true }).click();
    await page.getByLabel('Add 1', { exact: true }).click();
    await page.getByText(/You hand over/).waitFor();
    await page.getByText('Spend 6 coins').click();
    await page.getByText('Iced coffee').first().waitFor({ timeout: 8000 });
  });

  await step('timeline shows the purchase', async () => {
    await page.goto(`${BASE}/timeline`, { waitUntil: 'networkidle' });
    await page.getByText('Iced coffee').first().waitFor({ timeout: 8000 });
  });

  await step('approvals screen loads', async () => {
    await page.goto(`${BASE}/approvals`, { waitUntil: 'networkidle' });
    await page.getByText('Approvals').first().waitFor();
  });

  assert.deepEqual(errors, [], `page errors: ${errors.join('\n')}`);
  console.log('✅ smoke test passed');
} catch (err) {
  await page.screenshot({ path: 'e2e-failure.png', fullPage: true }).catch(() => undefined);
  console.error('\n❌', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
