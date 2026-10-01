#!/usr/bin/env node
/**
 * Offline checks of sst.config.ts (component names, API CORS), so a bad name fails in CI instead of
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
// SST turns `cors: false` on ApiGatewayV2 into an empty CORS config: the gateway then answers
// preflights itself and strips the app's CORS headers, so every browser call fails.
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
if (/\bcors:\s*false\b/.test(code)) problems.push('ApiGatewayV2 `cors: false` breaks browser calls; configure allowOrigins instead');

if (problems.length) {
  console.error(`✗ sst.config.ts component names:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${names.length} SST component names OK`);
