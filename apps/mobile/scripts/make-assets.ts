/**
 * Renders app icons, splash, PWA icons and the coin sound from @pobe/core art.
 * Run from the repo root:  npx tsx apps/mobile/scripts/make-assets.ts
 * (uses the Playwright Chromium that's available in the dev environment)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, THEME_NAMES, chubbybaraSvg, coinSvg } from '../../../packages/core/src/index';

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, '..', 'assets');
const pub = join(here, '..', 'public');
mkdirSync(join(assets, 'icons'), { recursive: true });
mkdirSync(join(assets, 'sounds'), { recursive: true });
mkdirSync(join(pub, 'icons'), { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node22/lib/node_modules/playwright');

function page(size: number, bg: string, inner: string, scale = 0.78) {
  return `<html><body style="margin:0;width:${size}px;height:${size}px;background:${bg};display:grid;place-items:center;overflow:hidden">
  <div style="width:${size * scale}px;height:${size * scale}px">${inner.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  async function shot(html: string, size: number, out: string, transparent = false) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(html);
    await p.screenshot({ path: out, omitBackground: transparent });
  }
  // One app icon per theme (alternate icons), Chubbybara on the theme's signature pastel.
  for (const name of THEME_NAMES) {
    const t = THEMES[name].light;
    const art = chubbybaraSvg({ pose: 'happy', accent: t.primary, id: name });
    const bg = `radial-gradient(circle at 50% 35%, ${t.surfaceAlt}, ${t.primary})`;
    await shot(page(1024, bg, art, 0.74), 1024, join(assets, 'icons', `icon-${name}.png`));
  }
  const pink = THEMES.pink.light;
  const happy = chubbybaraSvg({ pose: 'happy', accent: pink.primary, id: 'x' });
  // Android adaptive icon: foreground inside the 66% safe zone on transparent.
  await shot(page(1024, 'transparent', happy, 0.56), 1024, join(assets, 'icons', 'adaptive-foreground.png'), true);
  // Splash: waving Chubbybara on transparent (background color set in config).
  await shot(page(512, 'transparent', chubbybaraSvg({ pose: 'wave', accent: pink.primary, id: 's' }), 0.9), 512, join(assets, 'icons', 'splash.png'), true);
  // Android notification icon: white coin silhouette.
  const coinWhite = coinSvg(25).replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="#FFFFFF"').replace(/stroke="#[0-9A-Fa-f]{6}"/g, 'stroke="#FFFFFF"');
  await shot(page(96, 'transparent', coinWhite, 0.8), 96, join(assets, 'icons', 'notification.png'), true);
  // Web / PWA
  const bg = `radial-gradient(circle at 50% 35%, ${pink.surfaceAlt}, ${pink.primary})`;
  await shot(page(48, bg, happy, 0.86), 48, join(assets, 'icons', 'favicon.png'));
  await shot(page(192, bg, happy, 0.8), 192, join(pub, 'icons', 'icon-192.png'));
  await shot(page(512, bg, happy, 0.8), 512, join(pub, 'icons', 'icon-512.png'));
  await shot(page(512, pink.primary, happy, 0.6), 512, join(pub, 'icons', 'maskable-512.png'));
  await shot(page(180, bg, happy, 0.8), 180, join(pub, 'icons', 'apple-touch-icon.png'));
  // Coin art as PNG for the Android widget and notifications.
  for (const d of [1, 5, 10, 25, 50, 100]) await shot(page(128, 'transparent', coinSvg(d), 1), 128, join(assets, 'icons', `coin-${d}.png`), true);
  await browser.close();
  writeFileSync(join(assets, 'sounds', 'coin.wav'), coinSound());
  console.log('assets written');
}

/** A short two-note "cha-ching" synthesized as 16-bit mono WAV. */
function coinSound() {
  const rate = 22050;
  const notes = [
    { f: 1318.5, start: 0, dur: 0.12 },
    { f: 1975.5, start: 0.07, dur: 0.35 },
  ];
  const length = Math.ceil(rate * 0.45);
  const samples = new Float32Array(length);
  for (const n of notes) {
    const s0 = Math.floor(n.start * rate);
    for (let i = 0; i < n.dur * rate && s0 + i < length; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 9) * Math.min(1, t * 400);
      samples[s0 + i]! += 0.35 * env * (Math.sin(2 * Math.PI * n.f * t) + 0.3 * Math.sin(2 * Math.PI * n.f * 2.01 * t));
    }
  }
  const buf = Buffer.alloc(44 + length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) buf.writeInt16LE(Math.max(-1, Math.min(1, samples[i]!)) * 32767, 44 + i * 2);
  return buf;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
