/**
 * Post-build guard: every EXPO_PUBLIC_* variable set for this build must be baked into the web
 * bundle. Catches a stale Metro cache or aliased process.env, either of which would silently ship
 * an app pointing at localhost. Runs as part of `npm run build:web`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist/_expo/static/js/web';
const bundle = readdirSync(dir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n');

const vars = Object.entries(process.env).filter(([k, v]) => k.startsWith('EXPO_PUBLIC_') && v);
const missing = vars.filter(([, v]) => !bundle.includes(v.replace(/\/$/, ''))).map(([k]) => k);
if (missing.length) {
  console.error(`✗ Not found in the web bundle: ${missing.join(', ')}. Rebuild with a clean cache (expo export --clear).`);
  process.exit(1);
}
console.log(`EXPO_PUBLIC values in the bundle: ${vars.length ? vars.map(([k]) => k).join(', ') : 'none set (local defaults)'}`);
