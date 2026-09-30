#!/usr/bin/env node
/**
 * Stop hook: before Claude finishes, typecheck + test the workspaces touched since the last
 * green run, and check formatting of changed files. On failure, block the stop with the errors
 * so they get fixed. Results are cached so an unchanged tree is never re-checked.
 * Skip with POBE_SKIP_STOP_CHECKS=1.
 */
import { createHash } from 'node:crypto';
import { readCache, readInput, sh, writeCache } from './lib.mjs';

const input = await readInput();
if (input.stop_hook_active || process.env.POBE_SKIP_STOP_CHECKS === '1') process.exit(0);

const lines = (s) => s.split('\n').filter(Boolean);
const head = sh('git', ['rev-parse', 'HEAD']).trim();
const status = sh('git', ['status', '--porcelain', '--untracked-files=all']);
const fingerprint = createHash('sha1')
  .update(head)
  .update(status)
  .update(sh('git', ['diff', 'HEAD']))
  .digest('hex');
const last = readCache('stop-checks.json', null);
if (last?.fingerprint === fingerprint) process.exit(0);

// Changed = uncommitted changes + commits since the last green run.
const changed = new Set(lines(status).map((l) => l.slice(3).replace(/^.* -> /, '')));
if (last?.head && last.head !== head) {
  try {
    for (const f of lines(sh('git', ['diff', '--name-only', `${last.head}..HEAD`]))) changed.add(f);
  } catch {}
}
if (!changed.size) {
  writeCache('stop-checks.json', { fingerprint, head });
  process.exit(0);
}

const ws = new Set();
for (const f of changed) {
  if (f.startsWith('packages/core/')) ['@pobe/core', '@pobe/functions', '@pobe/mobile'].forEach((w) => ws.add(w));
  else if (f.startsWith('packages/functions/')) ws.add('@pobe/functions');
  else if (f.startsWith('apps/mobile/')) ws.add('@pobe/mobile');
}

const failures = [];
function run(label, cmd, args) {
  try {
    sh(cmd, args, { timeout: 240_000, maxBuffer: 20 * 1024 * 1024 });
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');
    failures.push(`### ${label} failed\n${out}`);
  }
}
for (const w of ws) {
  run(`typecheck ${w}`, 'npm', ['run', '-s', 'typecheck', '-w', w]);
  run(`tests ${w}`, 'npm', ['run', '-s', 'test', '-w', w]);
}
const formattable = [...changed].filter((f) => /\.(m?[jt]sx?|json|md|ya?ml|css)$/.test(f));
if (formattable.length) {
  const existing = formattable.filter((f) => {
    try {
      sh('git', ['ls-files', '--error-unmatch', '--others', '--cached', '--exclude-standard', f]);
      return true;
    } catch {
      return false;
    }
  });
  if (existing.length)
    run('prettier --check (fix: npm run format)', 'npx', ['--no-install', 'prettier', '--check', '--ignore-unknown', ...existing]);
}

run('secret scan (the repo is public)', 'node', ['scripts/check-secrets.mjs']);

if (failures.length) {
  console.log(
    JSON.stringify({
      decision: 'block',
      reason:
        `Checks failed for the files you changed. Fix these before finishing (or explain why they are unrelated):\n\n${failures.join('\n\n')}`.slice(
          0,
          9000,
        ),
    }),
  );
} else {
  writeCache('stop-checks.json', { fingerprint, head });
}
