#!/usr/bin/env node
/**
 * One-command deploy of the backend from your own computer, then a live check.
 *
 *   npm run deploy:dev                      # stage dev
 *   npm run deploy:prod -- --confirm-prod   # stage prod (asks you to confirm)
 *
 * Steps:
 *  1. Loads your deploy settings from .deploy/<stage>.json (gitignored; asked for on first run)
 *  2. Pulls main and installs dependencies if the lockfile changed
 *  3. Pre-flight (scripts/deploy/check.mjs)
 *  4. Confirms the stage's secrets exist (never prints them; only the public VAPID key)
 *  5. npx sst deploy
 *  6. Checks the live API: /health, and CORS from your web origin
 *  7. Says whether Netlify's environment variables need changing
 *
 * Flags: --stage dev|prod, --yes (no prompts: for Claude Code / scripts), --skip-pull,
 *        --verify-only (skip deploy, just check), --any-branch, --confirm-prod,
 *        --web-origin, --auth-prefix, --aws-profile, --region, --budget-email (saved for next time)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const isWindows = process.platform === 'win32';
const args = process.argv.slice(2);
const has = (f) => args.includes(`--${f}`);
const flag = (f) => {
  const i = args.indexOf(`--${f}`);
  return i === -1 ? undefined : args[i + 1];
};

const stage = flag('stage') ?? 'dev';
const yes = has('yes') || !process.stdin.isTTY;
if (!/^[a-z0-9-]+$/.test(stage)) fail(`Invalid --stage "${stage}"`);

const step = (n, text) => console.log(`\n\x1b[1m${n}. ${text}\x1b[0m`);
const ok = (text) => console.log(`  ✓ ${text}`);
const warn = (text) => console.log(`  ! ${text}`);
function fail(text) {
  console.error(`\n✗ ${text}`);
  process.exit(1);
}

/** Runs a command. On Windows, npm/npx are .cmd shims that need a shell; args here are fixed or validated. */
function run(cmd, cmdArgs, { env, capture, input } = {}) {
  const shim = isWindows && (cmd === 'npm' || cmd === 'npx');
  return spawnSync(shim ? `${cmd}.cmd ${cmdArgs.join(' ')}` : cmd, shim ? [] : cmdArgs, {
    cwd: ROOT,
    shell: shim,
    env: { ...process.env, SST_TELEMETRY_DISABLED: '1', ...env },
    encoding: 'utf8',
    input,
    stdio: capture ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'inherit', 'inherit'],
  });
}

// ---------- 1. settings ----------
step(1, `Settings for stage "${stage}"`);
const settingsFile = join(ROOT, '.deploy', `${stage}.json`);
const saved = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) : {};
const settings = {
  awsProfile: flag('aws-profile') ?? process.env.AWS_PROFILE ?? saved.awsProfile ?? 'pobe',
  region: flag('region') ?? process.env.AWS_REGION ?? saved.region ?? 'us-west-2',
  webOrigin: flag('web-origin') ?? process.env.WEB_ORIGIN ?? saved.webOrigin,
  authPrefix: flag('auth-prefix') ?? process.env.AUTH_PREFIX ?? saved.authPrefix,
  budgetEmail: flag('budget-email') ?? process.env.BUDGET_EMAIL ?? saved.budgetEmail,
};
const questions = {
  webOrigin: 'Web app URL (e.g. https://pobe-coins.netlify.app)',
  authPrefix: `Sign-in domain prefix (e.g. pobe-yourname-${stage})`,
  budgetEmail: 'Email for AWS spending alerts (optional)',
};
for (const [key, question] of Object.entries(questions)) {
  if (settings[key]) continue;
  if (yes) {
    if (key === 'budgetEmail') continue;
    fail(
      `Missing ${key}. Pass --${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} <value> once; it's saved in .deploy/${stage}.json.`,
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  settings[key] = (await rl.question(`  ${question}: `)).trim() || undefined;
  rl.close();
}
settings.webOrigin = settings.webOrigin?.replace(/\/$/, '');
mkdirSync(dirname(settingsFile), { recursive: true });
writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
for (const [k, v] of Object.entries(settings)) ok(`${k}: ${v ?? '(not set)'}`);
console.log(`  (saved in .deploy/${stage}.json, which is not committed)`);

const env = {
  AWS_PROFILE: settings.awsProfile,
  AWS_REGION: settings.region,
  WEB_ORIGIN: settings.webOrigin,
  AUTH_PREFIX: settings.authPrefix,
  ...(settings.budgetEmail ? { BUDGET_EMAIL: settings.budgetEmail } : {}),
};

if (stage === 'prod' && !has('verify-only')) {
  if (!has('confirm-prod')) fail('Deploying prod needs --confirm-prod (it holds your real household data).');
  if (!yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question('  Type "prod" to deploy production: ')).trim();
    rl.close();
    if (answer !== 'prod') fail('Cancelled.');
  }
}

// ---------- 2. code ----------
step(2, 'Code');
if (!has('skip-pull')) {
  const branch = run('git', ['branch', '--show-current'], { capture: true }).stdout.trim();
  if (branch !== 'main' && !has('any-branch')) fail(`You're on "${branch}". Run: git checkout main  (or pass --any-branch)`);
  if (run('git', ['status', '--porcelain'], { capture: true }).stdout.trim())
    fail('You have uncommitted changes. Commit or stash them first, so you deploy exactly what is on GitHub.');
  const pull = run('git', ['pull', '--ff-only'], { capture: true });
  if (pull.status !== 0) fail(`git pull failed: ${(pull.stderr || pull.stdout).trim()}`);
  ok(`main is up to date (${run('git', ['rev-parse', '--short', 'HEAD'], { capture: true }).stdout.trim()})`);
}
const marker = join(ROOT, 'node_modules/.package-lock.json');
if (!existsSync(marker) || statSync(join(ROOT, 'package-lock.json')).mtimeMs > statSync(marker).mtimeMs + 1000) {
  console.log('  Installing dependencies (npm 11)…');
  if (run('npx', ['-y', 'npm@11.20.0', 'ci', '--no-audit', '--no-fund']).status !== 0) fail('npm ci failed (see above).');
}
ok('dependencies installed');

// ---------- 3. pre-flight ----------
step(3, 'Pre-flight');
if (run(process.execPath, ['scripts/deploy/check.mjs'], { env }).status !== 0) fail('Pre-flight failed (see the ✗ lines above).');

// ---------- 4. secrets (names only) ----------
step(4, 'Secrets');
// Reads the stage's secrets to check they exist, without printing any value. Only the VAPID
// *public* key is shown, because Netlify needs it and it isn't secret.
const list = run('npx', ['sst', 'secret', 'list', '--stage', stage], { env, capture: true });
const values = Object.fromEntries(
  `${list.stdout ?? ''}`
    .split('\n')
    .map((l) => l.trim().match(/^([A-Za-z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
if (list.status !== 0) warn("Couldn't list secrets; continuing (the deploy will fail clearly if one is missing).");
else {
  const required = ['DeviceTokenSecret', 'VapidPublicKey', 'VapidPrivateKey', 'GoogleClientId', 'GoogleClientSecret'];
  const missing = required.filter((n) => !values[n] || values[n] === 'unset');
  if (missing.length)
    fail(`Missing secrets for "${stage}": ${missing.join(', ')}.\n  Run in your own terminal: npm run deploy:secrets -- --stage ${stage}`);
  ok(`all ${required.length} secrets are set (values not shown)`);
}
const vapidPublic = values.VapidPublicKey;

// ---------- 5. deploy ----------
if (!has('verify-only')) {
  step(5, `Deploying "${stage}" to AWS (${settings.region})`);
  if (run('npx', ['sst', 'deploy', '--stage', stage], { env }).status !== 0) fail('sst deploy failed (see the error above).');
} else {
  step(5, 'Deploy skipped (--verify-only)');
}

// ---------- 6. verify ----------
step(6, 'Checking the live API');
const outputsFile = join(ROOT, '.sst', 'outputs.json');
if (!existsSync(outputsFile)) fail('No .sst/outputs.json yet. Deploy once without --verify-only.');
const out = JSON.parse(readFileSync(outputsFile, 'utf8'));
const api = String(out.api ?? '').replace(/\/$/, '');
if (!api) fail('The deploy outputs have no "api" URL.');

let problems = 0;
try {
  const health = await (await fetch(`${api}/health`, { signal: AbortSignal.timeout(15000) })).json();
  if (health.ok && health.stage === stage) ok(`API is up: ${api}`);
  else {
    problems++;
    warn(`/health answered ${JSON.stringify(health)}`);
  }
} catch (e) {
  problems++;
  warn(`API not reachable: ${e.message}`);
}
try {
  const res = await fetch(`${api}/me`, {
    method: 'OPTIONS',
    headers: { Origin: settings.webOrigin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
    signal: AbortSignal.timeout(15000),
  });
  const allowed = res.headers.get('access-control-allow-origin');
  if (allowed === settings.webOrigin) ok(`browsers on ${settings.webOrigin} may call the API (CORS)`);
  else {
    problems++;
    warn(`CORS: expected access-control-allow-origin "${settings.webOrigin}", got "${allowed}". Sign-in will fail in the browser.`);
  }
} catch (e) {
  problems++;
  warn(`CORS check failed: ${e.message}`);
}
try {
  const res = await fetch(`${api}/me`, { signal: AbortSignal.timeout(15000) });
  if (res.status === 401) ok('requests without sign-in are refused (401)');
  else {
    problems++;
    warn(`/me without sign-in returned ${res.status}, expected 401`);
  }
} catch (e) {
  problems++;
  warn(`auth check failed: ${e.message}`);
}

// ---------- 7. Netlify ----------
step(7, 'Netlify');
const netlify = {
  EXPO_PUBLIC_API_URL: api,
  EXPO_PUBLIC_WEB_URL: settings.webOrigin,
  EXPO_PUBLIC_COGNITO_DOMAIN: out.authDomain,
  EXPO_PUBLIC_COGNITO_CLIENT_ID: out.userPoolClientId,
  ...(vapidPublic ? { EXPO_PUBLIC_VAPID_PUBLIC_KEY: vapidPublic } : {}),
};
const lastFile = join(ROOT, '.deploy', `${stage}.netlify.json`);
const last = existsSync(lastFile) ? JSON.parse(readFileSync(lastFile, 'utf8')) : null;
const changed = Object.keys(netlify).filter((k) => !last || last[k] !== netlify[k]);
if (last && !changed.length) ok('Netlify needs no changes (same values as the last deploy).');
else {
  console.log(
    last
      ? '  These values changed. Update them in Netlify → Site configuration → Environment variables, then Trigger deploy:'
      : '  Make sure Netlify (Site configuration → Environment variables) has exactly these, then Trigger deploy:',
  );
  for (const k of changed.length ? changed : Object.keys(netlify)) console.log(`    ${k} = ${netlify[k]}`);
}
writeFileSync(lastFile, JSON.stringify(netlify, null, 2) + '\n');

console.log(
  problems
    ? `\n✗ ${has('verify-only') ? '' : 'Deployed, but '}${problems} live check(s) failed (see ! lines above).`
    : `\n✓ "${stage}" is deployed and healthy. Open ${settings.webOrigin} and sign in.`,
);
process.exit(problems ? 1 : 0);
