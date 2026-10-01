#!/usr/bin/env node
/**
 * Offline check of SST component names in sst.config.ts, so a bad name fails in CI instead of
 * halfway through a deploy. SST rejects the name "App" (any case) and duplicate names among
 * top-level components.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../sst.config.ts');
const src = readFileSync(file, 'utf8');
const names = [...src.matchAll(/(?:new sst\.[\w.]+|\.add(?:Client|IdentityProvider))\(\s*'([^']+)'/g)].map((m) => m[1]);

const problems = [];
const seen = new Map();
for (const name of names) {
  const key = name.toLowerCase();
  if (key === 'app') problems.push(`"${name}" is reserved by SST; pick another name`);
  if (seen.has(key)) problems.push(`"${name}" is used twice (names must be unique, ignoring case)`);
  seen.set(key, name);
}
if (!names.length) problems.push('no SST components found; did the config format change?');

if (problems.length) {
  console.error(`✗ sst.config.ts component names:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${names.length} SST component names OK`);
