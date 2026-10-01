#!/usr/bin/env node
/**
 * Generates and stores the secrets a Pobe Coins stage needs, without echoing them.
 *
 *   npm run deploy:secrets -- --stage dev             # everything
 *   npm run deploy:secrets -- --stage dev --only google
 *   npm run deploy:secrets -- --stage dev --dry-run   # show what would be set, change nothing
 *
 * Sets: DeviceTokenSecret (random), VapidPublicKey/VapidPrivateKey (web push key pair),
 * GoogleClientId/GoogleClientSecret (you paste them; input is hidden).
 * Values go to SST over stdin, so they never appear in your shell history or process list.
 * Only the VAPID *public* key is printed: Netlify needs it and it isn't secret.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(ROOT, 'packages/functions/package.json'));

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : (args[i + 1] ?? '');
};
const stage = flag('stage');
const dryRun = args.includes('--dry-run');
const only = flag('only')?.split(',');
if (!stage || !/^[a-z0-9-]+$/.test(stage)) {
  console.error('Usage: npm run deploy:secrets -- --stage <dev|prod> [--only device,vapid,google] [--dry-run]');
  process.exit(1);
}
// On Windows, npx is npx.cmd, which Node can only start through a shell. The arguments are fixed
// names plus a validated stage, and the secret value goes over stdin, so the shell never sees it.
const isWindows = process.platform === 'win32';
const want = (group) => !only || only.includes(group);

/** Asks questions without echoing the answers. One interface, so pasted/piped lines aren't lost. */
function hiddenPrompts(questions) {
  return new Promise((done) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    const answers = [];
    let current = '';
    rl._writeToOutput = (s) => {
      if (s.includes(current)) rl.output.write(current);
    };
    const ask = () => {
      if (answers.length === questions.length) {
        rl.close();
        return done(answers);
      }
      current = questions[answers.length];
      rl.question(current, (answer) => {
        process.stdout.write('\n');
        answers.push(answer.trim());
        ask();
      });
    };
    ask();
  });
}

function setSecret(name, value) {
  if (!value) throw new Error(`${name} is empty`);
  if (dryRun) {
    console.log(`  would set ${name} (${value.length} chars)`);
    return;
  }
  const args = ['sst', 'secret', 'set', name, '--stage', stage];
  // Windows: pass one command string (all parts are fixed names or the validated stage), which
  // avoids Node's DEP0190 warning about shell + argument arrays.
  const r = spawnSync(isWindows ? `npx.cmd ${args.join(' ')}` : 'npx', isWindows ? [] : args, {
    cwd: ROOT,
    shell: isWindows,
    input: value,
    encoding: 'utf8',
    env: { ...process.env, SST_TELEMETRY_DISABLED: '1' },
  });
  if (r.error || r.status !== 0) {
    const output = `${r.stderr ?? ''}${r.stdout ?? ''}`.trim();
    const why = r.error ? r.error.message : output.split('\n').slice(-3).join(' ') || `exit code ${r.status}`;
    console.error(`  ✗ ${name}: ${why}`);
    process.exit(1);
  }
  console.log(`  ✓ ${name}`);
}

console.log(`Setting secrets for stage "${stage}"${dryRun ? ' (dry run)' : ''}\n`);

if (want('device')) {
  setSecret('DeviceTokenSecret', randomBytes(48).toString('base64'));
}

let vapidPublic;
if (want('vapid')) {
  const { generateVAPIDKeys } = require('web-push');
  const keys = generateVAPIDKeys();
  setSecret('VapidPublicKey', keys.publicKey);
  setSecret('VapidPrivateKey', keys.privateKey);
  vapidPublic = keys.publicKey;
}

if (want('google')) {
  console.log('\nGoogle OAuth client (Google Cloud → APIs & Services → Credentials). Input is hidden.');
  const [id, secret] = await hiddenPrompts(['  Client ID: ', '  Client secret: ']);
  if (!id.endsWith('.apps.googleusercontent.com'))
    console.warn('  (that client ID looks unusual; it normally ends in .apps.googleusercontent.com)');
  setSecret('GoogleClientId', id);
  setSecret('GoogleClientSecret', secret);
}

if (vapidPublic) {
  console.log(`\nNetlify needs this (not secret):\n  EXPO_PUBLIC_VAPID_PUBLIC_KEY=${vapidPublic}`);
  console.log('\nNote: re-running with vapid creates a NEW key pair; existing web push subscriptions stop working.');
}
console.log('\nDone. Next: npx sst deploy --stage ' + stage);
