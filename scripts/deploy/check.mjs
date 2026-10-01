#!/usr/bin/env node
/**
 * Pre-deploy check. Run before every `sst deploy`:
 *
 *   npm run deploy:check
 *
 * Verifies Node, AWS credentials (and shows which account they belong to), the region,
 * WEB_ORIGIN / AUTH_PREFIX, and that you're deploying committed code from main.
 */
import { execFileSync } from 'node:child_process';

let failed = false;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ! ${msg}`);
const fail = (msg) => {
  console.log(`  ✗ ${msg}`);
  failed = true;
};
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

console.log('Pobe Coins deploy check\n');

const major = Number(process.versions.node.split('.')[0]);
major >= 22 ? ok(`Node ${process.versions.node}`) : fail(`Node ${process.versions.node}: install Node 22 or newer`);

const region = process.env.AWS_REGION ?? 'us-west-2';
ok(`Region ${region}${process.env.AWS_REGION ? '' : ' (default; set AWS_REGION to change)'}`);

try {
  const id = JSON.parse(run('aws', ['sts', 'get-caller-identity', '--output', 'json']));
  ok(`AWS account ${id.Account} as ${id.Arn.split('/').pop()}${process.env.AWS_PROFILE ? ` (profile ${process.env.AWS_PROFILE})` : ''}`);
  if (id.Arn.endsWith(':root')) fail('You are using root credentials. Create an IAM user (see docs/deploy/going-live.md).');
} catch (e) {
  const msg = String(e.stderr ?? e.message ?? e);
  if (msg.includes('ENOENT')) fail('AWS CLI not found. Install AWS CLI v2: https://aws.amazon.com/cli/');
  else fail(`AWS credentials not working (${msg.trim().split('\n').pop()}). Try: export AWS_PROFILE=pobe`);
}

const origin = process.env.WEB_ORIGIN;
if (!origin) fail('WEB_ORIGIN is not set (your Netlify URL, e.g. https://pobe-coins-sam.netlify.app)');
else if (!origin.startsWith('https://')) fail(`WEB_ORIGIN must start with https:// (got ${origin})`);
else ok(`WEB_ORIGIN ${origin}`);

if (!process.env.AUTH_PREFIX) warn('AUTH_PREFIX not set: the default pobe-coins-<stage> may be taken. Use e.g. pobe-<you>-<stage>.');
else if (!/^[a-z0-9-]{3,63}$/.test(process.env.AUTH_PREFIX) || /aws|amazon|cognito/.test(process.env.AUTH_PREFIX))
  fail('AUTH_PREFIX: lowercase letters, digits and dashes only, and it must not contain aws/amazon/cognito');
else ok(`AUTH_PREFIX ${process.env.AUTH_PREFIX}`);

try {
  run('node', ['scripts/check-sst-names.mjs']);
  ok('sst.config.ts component names');
} catch (e) {
  fail(
    String(e.stderr ?? e.message)
      .trim()
      .split('\n')
      .slice(1)
      .join(' ') || 'sst.config.ts component names are invalid',
  );
}

process.env.BUDGET_EMAIL ? ok(`Budget alerts to ${process.env.BUDGET_EMAIL}`) : warn('BUDGET_EMAIL not set: no AWS spending alerts');

try {
  const branch = run('git', ['branch', '--show-current']);
  branch === 'main' ? ok('On main') : warn(`On branch ${branch} (usually deploy from main)`);
  run('git', ['status', '--porcelain']) ? warn('Uncommitted changes will be deployed') : ok('Working tree clean');
} catch {
  warn('Not a git checkout');
}

console.log(failed ? '\nFix the ✗ items, then run this again.' : '\nReady. Next: npx sst deploy --stage <dev|prod>');
process.exit(failed ? 1 : 0);
