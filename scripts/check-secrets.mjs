#!/usr/bin/env node
/**
 * Fails if a credential-looking value or file is in the repo. The repo is public, so this runs in CI
 * and in the Claude stop hook. Scans tracked + new (non-ignored) files.
 *
 *   node scripts/check-secrets.mjs
 *
 * False positive? Put `pobe-secrets-ignore` on that line (and explain why in a comment).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const PATTERNS = [
  ['AWS access key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['AWS secret key assignment', /aws_secret_access_key\s*[=:]\s*\S{20,}/i],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Google OAuth client secret', /\bGOCSPX-[A-Za-z0-9_-]{10,}/],
  ['Google OAuth client id', /\b\d{6,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['GitHub token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ['Stripe live key', /\b(sk|rk)_live_[A-Za-z0-9]{16,}/],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['Expo access token', /\bEXPO_TOKEN\s*[=:]\s*["']?[A-Za-z0-9_-]{30,}/],
];
const FORBIDDEN_FILES = [
  /(^|\/)\.env(\.(?!example$)[^/]+)?$/,
  /\.(pem|p8|p12|pfx|key|keystore|jks|mobileprovision)$/,
  /(^|\/)google-services\.json$/,
  /(^|\/)GoogleService-Info\.plist$/,
  /(^|\/)\.aws\/credentials$/,
];
const BINARY = /\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|mp3|wav|zip|gz|lockb)$/i;

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const problems = [];
for (const file of files) {
  if (FORBIDDEN_FILES.some((re) => re.test(file))) problems.push(`${file}: this kind of file holds credentials; keep it out of git`);
  if (BINARY.test(file)) continue;
  let text;
  try {
    if (statSync(file).size > 2_000_000) continue;
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted in the working tree
  }
  text.split('\n').forEach((line, i) => {
    if (line.includes('pobe-secrets-ignore')) return;
    for (const [name, re] of PATTERNS) if (re.test(line)) problems.push(`${file}:${i + 1}: looks like a ${name}`);
  });
}

if (problems.length) {
  console.error(`✗ Possible secrets found (the repo is public):\n  ${problems.join('\n  ')}`);
  console.error('\nRemove them, rotate the credential if it was ever pushed, and keep secrets in SST (npm run deploy:secrets).');
  process.exit(1);
}
console.log(`✓ No secrets found in ${files.length} files`);
