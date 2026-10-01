/**
 * Screenshot tour: signs in to the demo household and captures the main screens at phone and
 * desktop widths, so UI changes can be checked by eye (humans and agents alike).
 *
 *   SEED=1 npm run dev:api        (terminal 1)
 *   npm run web -w @pobe/mobile    (terminal 2)
 *   npm run screens                (terminal 3) → .claude/.cache/screens/*.png
 *
 * Env: BASE_URL (default http://localhost:8081), OUT (output dir), ONLY (comma-separated route
 * names, e.g. ONLY=home,shop), USER_NAME (demo member, default sam), SCHEMES (light,dark; default
 * light), PLAYWRIGHT_MODULE.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const OUT = resolve(process.env.OUT ?? '.claude/.cache/screens');
const ONLY = process.env.ONLY?.split(',');
const month = new Date().toISOString().slice(0, 7);
const SCHEMES = (process.env.SCHEMES ?? 'light').split(',');

const ROUTES = [
  ['home', '/'],
  ['tasks', '/tasks'],
  ['shop', '/shop'],
  ['timeline', '/timeline'],
  ['more', '/more'],
  ['spend', '/spend'],
  ['approvals', '/approvals'],
  ['stats', '/stats'],
  ['settings', '/settings'],
  ['admin', '/admin'],
  ['task-edit', '/task/edit'],
  ['challenges', '/challenges'],
  ['wrapped', `/wrapped/${month}`],
].filter(([name]) => !ONLY || ONLY.includes(name));

const VIEWPORTS = SCHEMES.flatMap((scheme) =>
  [
    { tag: 'phone', width: 390, height: 844, scale: 1.5 },
    { tag: 'desktop', width: 1280, height: 820, scale: 1 },
  ].map((vp) => ({ ...vp, scheme, tag: scheme === 'light' ? vp.tag : `${vp.tag}-${scheme}` })),
);

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const errors = new Set();
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.scale,
      colorScheme: vp.scheme,
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.add(`${vp.tag}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.add(`${vp.tag}: ${m.text().slice(0, 200)}`));
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForTimeout(1500);
    const skip = page.getByText('Skip', { exact: true });
    if (await skip.count()) await skip.click();
    await page.getByLabel('Dev sign-in name').fill(process.env.USER_NAME ?? 'sam');
    await page.getByText('Dev sign-in', { exact: true }).last().click();
    await page.waitForTimeout(3500);
    for (const [name, path] of ROUTES) {
      if (path !== '/') await page.goto(BASE + path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      const file = `${OUT}/${vp.tag}-${name}.png`;
      await page.screenshot({ path: file });
      console.log(file);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
if (errors.size) {
  console.log('\nConsole/page errors:\n' + [...errors].join('\n'));
  process.exitCode = 1;
}
