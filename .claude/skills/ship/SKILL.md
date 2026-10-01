---
name: ship
description: Deploy the Pobe Coins backend and verify it live, either from the user's own computer (npm run deploy:dev) or from the cloud through the GitHub Actions Deploy workflow (OIDC, no stored keys). Covers pre-flight, secrets check, sst deploy to dev or prod, health and CORS checks, and the Netlify follow-up. Use when the user says deploy, ship, release or redeploy the API/backend.
---

# Ship (deploy from the user's machine)

One command does the whole run: `npm run deploy:dev` (or `deploy:prod`). It is `scripts/deploy/ship.mjs`, and it:

1. loads settings from `.deploy/<stage>.json` (gitignored);
2. pulls `main` and installs packages;
3. runs the pre-flight;
4. confirms the secrets exist without printing them;
5. runs `sst deploy`;
6. checks `/health`, CORS from the web origin, and the 401 without sign-in;
7. prints exactly which Netlify variables need changing.

## 0. Where am I? Pick the route

- **Cloud sandbox (Claude Code on the web):** deploy through GitHub Actions; no AWS keys are involved.
  - `.github/workflows/deploy.yml` deploys `dev` on every push to `main`.
  - Stage `prod` runs through `workflow_dispatch` (input `stage`). Trigger it with the GitHub MCP `actions_run_trigger` tool (workflow `deploy.yml`, ref `main`), only after the user's explicit go-ahead.
  - Follow the run with `actions_list` and `get_job_logs`. The run's summary page lists the API URL and the Netlify values.
  - The job is skipped until the repo variable `AWS_DEPLOY_ROLE_ARN` exists. If it's missing, ask the user to run `npm run deploy:setup-ci` on their computer once. It creates the OIDC role and the GitHub environments and variables.
  - Never ask for AWS keys, and never put them in the sandbox.
- **User's computer:** run the script directly, as below.

## 1. Before deploying

- Get an explicit go-ahead for this deploy in this conversation ("yes, deploy dev"). `npm run deploy:*` is on the ask list in `.claude/settings.json`, so the user also approves the command itself.
- **prod** needs the user to say "prod" explicitly, and it holds real household data. Never deploy prod as a side effect of anything else.
- The working tree must be clean and on `main` (the script enforces this). If there are local changes, they go through a PR first; don't deploy unmerged work.

## 2. Run it

```bash
npm run deploy:dev -- --yes
# first run on this machine, if .deploy/dev.json doesn't exist yet (values are not secret):
npm run deploy:dev -- --yes --web-origin https://pobe-coins.netlify.app --auth-prefix pobe-<you>-dev --aws-profile pobe
# production:
npm run deploy:prod -- --yes --confirm-prod
# check only, no deploy:
npm run deploy:dev -- --yes --verify-only
```

`--yes` means no interactive prompts; Claude's Bash has no terminal input. Ask the user for any missing setting, then pass it as a flag. It's saved for next time.

## 3. Read the result

- **`✓ "<stage>" is deployed and healthy`:** report the API URL. If the Netlify step listed changed variables, tell the user to set exactly those in Netlify and then Trigger deploy. Otherwise say Netlify needs nothing.
- **Missing secrets:** never run `deploy:secrets` for the user. It's interactive, and the Google client secret must not pass through Claude. Tell them to run `npm run deploy:secrets -- --stage <stage>` in their own terminal, then re-run `/ship`.
- **`sst deploy` failed:** read the error. Known causes:
  - reserved or duplicate component names (`node scripts/check-sst-names.mjs`);
  - expired AWS credentials (`aws sts get-caller-identity --profile <p>`);
  - Cognito domain prefix taken (choose a new `--auth-prefix`, and add its redirect URI in Google Cloud).

  Fix code issues on a branch with a PR (skills `deploy`, `verify`), get them merged, then re-run.

- **CORS check fails:** API Gateway CORS in `sst.config.ts` must list the web origin. Never use `cors: false`; SST turns it into an empty config that blocks browsers. Check that `.deploy/<stage>.json` has the right `webOrigin`.

## Never

- Print, paste or log secret values. `sst secret list` is denied for Claude; the script reads it internally and only shows names plus the public VAPID key.
- Run `sst remove`, or deploy prod, without the user's explicit words for it.
- Commit `.deploy/` or `.sst/`. Both are gitignored.
