// Post-export checks for the web build: the PWA files must be in dist/.
import { existsSync } from 'node:fs';
const required = ['dist/manifest.json', 'dist/sw.js', 'dist/icons/icon-512.png', 'dist/index.html'];
const missing = required.filter((f) => !existsSync(f));
if (missing.length) {
  console.error('Missing from web build:', missing.join(', '));
  process.exit(1);
}
console.log('PWA files present:', required.join(', '));
