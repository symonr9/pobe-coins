#!/usr/bin/env node
/**
 * SessionStart hook: make sure dependencies are installed, then print a short
 * status (branch, uncommitted work, local servers) that gets added to Claude's context.
 */
import { appendFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readInput, sh } from './lib.mjs';

await readInput();
const remote = process.env.CLAUDE_CODE_REMOTE === 'true';
const lines = [];

// Env for every Bash call in this session.
if (process.env.CLAUDE_ENV_FILE) {
  const env = ['export EXPO_NO_TELEMETRY=1'];
  if (remote) env.push('export EXPO_OFFLINE=1'); // cloud sandboxes can't reach Expo's version API
  appendFileSync(process.env.CLAUDE_ENV_FILE, env.join('\n') + '\n');
}

// Dependencies: install when missing or older than the lockfile. npm 10 crashes on this
// workspace ("reading 'edgesOut'"), so always use npm 11.
const marker = join(ROOT, 'node_modules/.package-lock.json');
const stale = !existsSync(marker) || statSync(join(ROOT, 'package-lock.json')).mtimeMs > statSync(marker).mtimeMs + 1000;
if (stale) {
  try {
    sh('npx', ['-y', 'npm@11.20.0', 'ci', '--no-audit', '--no-fund'], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 540_000 });
    lines.push('Installed dependencies with npm 11.');
  } catch (e) {
    lines.push(`Dependency install FAILED; run \`npx -y npm@11.20.0 ci\` and check the error: ${String(e.stderr ?? e).slice(-400)}`);
  }
}

try {
  const branch = sh('git', ['branch', '--show-current']).trim();
  const dirty = sh('git', ['status', '--porcelain']).split('\n').filter(Boolean).length;
  lines.push(`Branch ${branch}; ${dirty ? `${dirty} uncommitted file(s)` : 'clean working tree'}.`);
} catch {}

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) lines.push(`Node ${process.versions.node} detected; this repo expects Node 22+.`);

async function up(port, path = '/') {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch {
    return false;
  }
}
const [api, web] = await Promise.all([up(3001, '/health'), up(8081)]);
lines.push(
  `Local servers: API ${api ? 'up on :3001' : 'down (SEED=1 npm run dev:api)'}, web ${web ? 'up on :8081' : 'down (npm run dev:web)'}.`,
);
lines.push(
  'Project guide: CLAUDE.md. Task playbooks live in .claude/skills/ (dev-setup, verify, api-endpoint, money-changes, ui-screen, chubbybara, deploy, release-mobile, expo-upgrade).',
);

console.log(lines.join('\n'));
