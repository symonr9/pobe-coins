#!/usr/bin/env node
/**
 * One-time setup so GitHub Actions can deploy (.github/workflows/deploy.yml) without storing any
 * AWS keys. Run on your computer with your AWS profile:
 *
 *   npm run deploy:setup-ci
 *
 * It creates (or updates):
 *  - the GitHub OIDC identity provider in your AWS account
 *  - the IAM role "pobe-coins-github-deploy", which only this repo's `dev` and `prod` GitHub
 *    environments can assume, with AdministratorAccess (what SST needs; tighten later if you like)
 * Then, if the GitHub CLI (`gh`) is installed and logged in, it also creates the `dev` and `prod`
 * environments and sets their variables (role ARN, region, WEB_ORIGIN, AUTH_PREFIX, BUDGET_EMAIL)
 * from .deploy/<stage>.json. Otherwise it prints exactly what to enter in GitHub.
 *
 * Flags: --aws-profile <name> (default: from .deploy/dev.json, else "pobe"), --repo owner/name
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const flag = (f) => {
  const i = args.indexOf(`--${f}`);
  return i === -1 ? undefined : args[i + 1];
};
const readSettings = (stage) => {
  const file = join(ROOT, '.deploy', `${stage}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
};
const dev = readSettings('dev');
const prod = readSettings('prod');
const profile = flag('aws-profile') ?? dev.awsProfile ?? 'pobe';
const region = dev.region ?? 'us-west-2';
const ROLE = 'pobe-coins-github-deploy';
const OIDC_HOST = 'token.actions.githubusercontent.com';

const ok = (t) => console.log(`  ✓ ${t}`);
const fail = (t) => {
  console.error(`\n✗ ${t}`);
  process.exit(1);
};
const aws = (cmdArgs) =>
  execFileSync('aws', [...cmdArgs, '--profile', profile, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const tryAws = (cmdArgs) => {
  try {
    return JSON.parse(aws(cmdArgs) || '{}');
  } catch {
    return null;
  }
};

// Which GitHub repo may deploy
let repo = flag('repo');
if (!repo) {
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' }).trim();
  repo = url.match(/github\.com[:/]([^/]+\/[^/.]+)/)?.[1];
}
if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) fail('Could not tell which GitHub repo this is. Pass --repo owner/name.');

console.log(`Setting up GitHub Actions deploys for ${repo} (AWS profile "${profile}")\n`);

const identity = tryAws(['sts', 'get-caller-identity']);
if (!identity) fail(`AWS credentials for profile "${profile}" don't work. Check: aws sts get-caller-identity --profile ${profile}`);
const account = identity.Account;
ok(`AWS account ${account}`);

// 1. GitHub's OIDC identity provider (one per account)
const providers = tryAws(['iam', 'list-open-id-connect-providers'])?.OpenIDConnectProviderList ?? [];
let providerArn = providers.map((p) => p.Arn).find((arn) => arn.endsWith(`/${OIDC_HOST}`));
if (providerArn) ok('GitHub OIDC provider already exists');
else {
  providerArn = JSON.parse(
    aws([
      'iam',
      'create-open-id-connect-provider',
      '--url',
      `https://${OIDC_HOST}`,
      '--client-id-list',
      'sts.amazonaws.com',
      // AWS verifies GitHub's certificate itself; the thumbprint is required but not used for GitHub.
      '--thumbprint-list',
      '6938fd4d98bab03faadb97b34396831e3780aea1',
    ]),
  ).OpenIDConnectProviderArn;
  ok('created GitHub OIDC provider');
}

// 2. The deploy role: only this repo's `dev` / `prod` environments can assume it
const trust = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { Federated: providerArn },
      Action: 'sts:AssumeRoleWithWebIdentity',
      Condition: {
        StringEquals: { [`${OIDC_HOST}:aud`]: 'sts.amazonaws.com' },
        StringLike: { [`${OIDC_HOST}:sub`]: [`repo:${repo}:environment:dev`, `repo:${repo}:environment:prod`] },
      },
    },
  ],
});
const existing = tryAws(['iam', 'get-role', '--role-name', ROLE]);
if (existing) {
  aws(['iam', 'update-assume-role-policy', '--role-name', ROLE, '--policy-document', trust]);
  ok(`role ${ROLE} exists; trust policy updated`);
} else {
  aws([
    'iam',
    'create-role',
    '--role-name',
    ROLE,
    '--description',
    `GitHub Actions deploys for ${repo}`,
    '--max-session-duration',
    '3600',
    '--assume-role-policy-document',
    trust,
  ]);
  ok(`created role ${ROLE}`);
}
aws(['iam', 'attach-role-policy', '--role-name', ROLE, '--policy-arn', 'arn:aws:iam::aws:policy/AdministratorAccess']);
ok('role has AdministratorAccess (needed by SST to create resources)');
const roleArn = `arn:aws:iam::${account}:role/${ROLE}`;

// 3. GitHub environments + variables
const variables = {
  dev: {
    AWS_REGION: region,
    WEB_ORIGIN: dev.webOrigin,
    AUTH_PREFIX: dev.authPrefix,
    BUDGET_EMAIL: dev.budgetEmail,
  },
  prod: {
    AWS_REGION: prod.region ?? region,
    WEB_ORIGIN: prod.webOrigin,
    AUTH_PREFIX: prod.authPrefix,
    BUDGET_EMAIL: prod.budgetEmail ?? dev.budgetEmail,
  },
};
let gh = false;
try {
  execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  gh = true;
} catch {}

console.log('');
// The role ARN is a repository variable: the workflow's job-level `if` runs before environment
// variables load, so it can only see repository-level ones.
if (gh) {
  execFileSync('gh', ['variable', 'set', 'AWS_DEPLOY_ROLE_ARN', '--repo', repo, '--body', roleArn], { stdio: 'ignore' });
  ok('repository variable AWS_DEPLOY_ROLE_ARN set');
  for (const [envName, vars] of Object.entries(variables)) {
    execFileSync('gh', ['api', '-X', 'PUT', `repos/${repo}/environments/${envName}`], { stdio: 'ignore' });
    for (const [k, v] of Object.entries(vars)) {
      if (!v) continue;
      execFileSync('gh', ['variable', 'set', k, '--env', envName, '--repo', repo, '--body', v], { stdio: 'ignore' });
    }
    const missing = Object.entries(vars)
      .filter(([k, v]) => !v && k !== 'BUDGET_EMAIL')
      .map(([k]) => k);
    ok(`GitHub environment "${envName}" ready${missing.length ? ` (still missing: ${missing.join(', ')})` : ''}`);
  }
} else {
  console.log('GitHub CLI (gh) not found or not logged in, so set these by hand:');
  console.log(`  https://github.com/${repo}/settings/variables/actions → New repository variable:`);
  console.log(`    AWS_DEPLOY_ROLE_ARN = ${roleArn}`);
  console.log(`  https://github.com/${repo}/settings/environments → New environment "dev" (and later "prod")`);
  console.log('  In each environment, under "Environment variables", add:');
  for (const [envName, vars] of Object.entries(variables)) {
    console.log(`\n  ${envName}:`);
    for (const [k, v] of Object.entries(vars)) console.log(`    ${k} = ${v ?? `<set when you first deploy ${envName}>`}`);
  }
}

console.log(`
Done. Recommended: in https://github.com/${repo}/settings/environments/ → prod, add yourself under
"Required reviewers", so production deploys wait for your click.

Deploys now run from GitHub:
  - every merge to main deploys dev
  - Actions → Deploy → Run workflow → stage: prod  (for production)`);
